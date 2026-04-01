'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { record } = require('./failure-observer');

// ── Configuration ────────────────────────────────────────────────────────────

const INGESTION_URL = process.env.EVENT_INGESTION_URL || null;
const REQUEST_TIMEOUT_MS = 5000;

// JSONL fallback — used when INGESTION_URL is not configured.
const AUDIT_LOG_DIR = path.join(__dirname, '..', '..', 'audit-log');
const AUDIT_LOG_FILE = path.join(AUDIT_LOG_DIR, 'tool-invocations.jsonl');

// ── Public interface ─────────────────────────────────────────────────────────

/**
 * Submit a validated audit event to the configured ingestion target.
 *
 * When EVENT_INGESTION_URL is set:
 *   HTTP POST the event as JSON. Delivery is async and non-blocking.
 *   The function returns before the request completes.
 *   Delivery failures are observed via the failure observer — they do not
 *   propagate to the caller.
 *
 * When EVENT_INGESTION_URL is not set (fallback):
 *   Append the event to the local JSONL file. This is synchronous.
 *   I/O failures are thrown to the caller so the emitter can observe them.
 *
 * Throws synchronously only for events that cannot be serialized (should not
 * happen in practice given validated event objects from event-builder.js).
 */
function submit(event) {
  const payload = JSON.stringify(event);

  if (INGESTION_URL) {
    _postAsync(payload, event.event_id);
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
 * Fire-and-forget HTTP POST. All delivery failures are observed locally.
 * Never throws or rejects to the caller.
 */
function _postAsync(payload, eventId) {
  _post(payload)
    .catch(err => {
      record(err, {
        transport: 'http',
        event_id: eventId,
        endpoint: INGESTION_URL
      });
    });
}

/**
 * HTTP POST with timeout. Returns a Promise that resolves on 2xx
 * and rejects on non-2xx, network error, or timeout.
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
        // Drain the response body so the socket is released.
        res.resume();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.statusCode);
        } else {
          reject(new Error(`ingestion_endpoint_rejected: HTTP ${res.statusCode}`));
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

module.exports = { submit, AUDIT_LOG_FILE, INGESTION_URL };
