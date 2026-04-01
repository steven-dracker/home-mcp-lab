'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { record } = require('./failure-observer');

// ── Configuration ────────────────────────────────────────────────────────────

const INGESTION_URL = process.env.EVENT_INGESTION_URL || null;
const REQUEST_TIMEOUT_MS = 5000;

// Retry policy — applies to HTTP delivery only.
// Total delivery attempts = MAX_ATTEMPTS (1 initial + MAX_ATTEMPTS-1 retries).
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

// JSONL fallback — used when INGESTION_URL is not configured.
const AUDIT_LOG_DIR = path.join(__dirname, '..', '..', 'audit-log');
const AUDIT_LOG_FILE = path.join(AUDIT_LOG_DIR, 'tool-invocations.jsonl');

// ── Public interface ─────────────────────────────────────────────────────────

/**
 * Submit a validated audit event to the configured ingestion target.
 *
 * When EVENT_INGESTION_URL is set:
 *   HTTP POST the event as JSON with bounded retry on transient failures.
 *   Delivery is async and non-blocking — the function returns before the
 *   first attempt completes. Retries and final failure are observed via
 *   the failure observer. They do not propagate to the caller.
 *
 *   Retry policy:
 *     - Max 3 attempts (1 initial + 2 retries)
 *     - Fixed 500ms delay between attempts
 *     - Retry-eligible: network errors, timeouts, HTTP 5xx
 *     - Non-retryable: HTTP 4xx (permanent client error)
 *
 * When EVENT_INGESTION_URL is not set (fallback):
 *   Append the event to the local JSONL file. Synchronous.
 *   I/O failures are thrown to the caller so the emitter can observe them.
 */
function submit(event) {
  const payload = JSON.stringify(event);

  if (INGESTION_URL) {
    _postWithRetry(payload, event.event_id);
    // Returns immediately — delivery happens asynchronously.
    return;
  }

  // Fallback: local JSONL
  if (!fs.existsSync(AUDIT_LOG_DIR)) {
    fs.mkdirSync(AUDIT_LOG_DIR, { recursive: true });
  }
  fs.appendFileSync(AUDIT_LOG_FILE, payload + '\n', 'utf8');
}

// ── Internal ─────────────────────────────────────────────────────────────────

/**
 * Async bounded retry loop. Fires and forgets from the caller's perspective.
 * On final failure, records via failure-observer.
 */
function _postWithRetry(payload, eventId) {
  _attemptDelivery(payload, eventId, 1);
}

async function _attemptDelivery(payload, eventId, attempt) {
  let statusCode;
  try {
    statusCode = await _post(payload);
    // Delivered successfully on attempt N.
    if (attempt > 1) {
      // Log recovery only when a retry was needed — keeps success path silent.
      process.stderr.write(
        `[emitter-retry-success] event_id=${eventId} delivered on attempt ${attempt}\n`
      );
    }
    return;
  } catch (err) {
    const retryable = _isRetryable(err);

    if (retryable && attempt < MAX_ATTEMPTS) {
      process.stderr.write(
        `[emitter-retry] event_id=${eventId} attempt=${attempt} error=${err.message} retrying_in=${RETRY_DELAY_MS}ms\n`
      );
      await _sleep(RETRY_DELAY_MS);
      return _attemptDelivery(payload, eventId, attempt + 1);
    }

    // Non-retryable error, or retry budget exhausted.
    record(err, {
      transport: 'http',
      event_id: eventId,
      endpoint: INGESTION_URL,
      attempts: attempt,
      retryable
    });
  }
}

/**
 * Single HTTP POST attempt with timeout.
 * Resolves with HTTP status code on 2xx.
 * Rejects with a classified error on non-2xx, network failure, or timeout.
 */
function _post(payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(INGESTION_URL);
    const lib = url.protocol === 'https:' ? https : http;
    const body = Buffer.from(payload, 'utf8');

    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body.length
        },
        timeout: REQUEST_TIMEOUT_MS
      },
      (res) => {
        res.resume();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.statusCode);
        } else if (res.statusCode >= 500) {
          const err = new Error(`server_error: HTTP ${res.statusCode}`);
          err.httpStatus = res.statusCode;
          reject(err);
        } else {
          // 4xx — permanent client error, do not retry.
          const err = new Error(`client_error: HTTP ${res.statusCode}`);
          err.httpStatus = res.statusCode;
          err.permanent = true;
          reject(err);
        }
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('delivery_timed_out'));
    });

    req.on('error', (err) => {
      reject(new Error(`delivery_network_error: ${err.message}`));
    });

    req.write(body);
    req.end();
  });
}

/**
 * Returns true if the error warrants a retry attempt.
 * Network errors, timeouts, and server-side 5xx are retryable.
 * Client errors (4xx) and explicitly flagged permanent errors are not.
 */
function _isRetryable(err) {
  if (err.permanent) return false;
  if (err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 500) return false;
  return true;
}

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { submit, AUDIT_LOG_FILE, INGESTION_URL };
