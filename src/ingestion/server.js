'use strict';

/**
 * Phase 2 ingestion boundary — HTTP server with persistence, readback, and deduplication.
 *
 * Routes:
 *   POST /events          Accept and persist a single audit event.
 *                         Deduplicates by event_id: if the event_id has already been
 *                         persisted, returns 200 with {"accepted":false,"duplicate":true}
 *                         and does not write again.
 *                         Returns 200 {"accepted":true} only after the event is durably written.
 *                         Returns 500 if persistence fails.
 *
 *   GET  /events          Read back persisted events.
 *                         Query parameters (all optional):
 *                           correlation_id  — filter to a single session
 *                           event_type      — filter to a specific event type
 *                           limit           — max events to return (default: 100, max: 1000)
 *                         If the store file does not exist, returns {"events":[],"count":0}.
 *                         If the store file cannot be read, returns 500.
 *
 * Deduplication scope:
 *   The seen-event_id set is populated at startup from the store file and updated
 *   on every successful write. Duplicates from before a server restart are also
 *   detected. Events without an event_id field are accepted without dedup.
 *
 * Storage:
 *   ingestion-store/events.jsonl  — append-only; one JSON event per line.
 *   Excluded from git.
 *
 * Usage:
 *   node src/ingestion/server.js
 *   EVENT_INGESTION_URL=http://localhost:4318/events node src/emitter/demo-session.js
 *
 * Default port: 4318 (configurable via PORT env var)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = parseInt(process.env.PORT || '4318', 10);

const STORE_DIR = path.join(__dirname, '..', '..', 'ingestion-store');
const STORE_FILE = path.join(STORE_DIR, 'events.jsonl');

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

// In-memory deduplication set — populated from store at startup.
const seenEventIds = new Set();

let receivedCount = 0;
let persistedCount = 0;
let duplicateCount = 0;

// ── Startup ──────────────────────────────────────────────────────────────────

// Ensure the storage directory exists.
if (!fs.existsSync(STORE_DIR)) {
  fs.mkdirSync(STORE_DIR, { recursive: true });
}

// Populate seen set from existing store so dedup survives server restarts.
if (fs.existsSync(STORE_FILE)) {
  const lines = fs.readFileSync(STORE_FILE, 'utf8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.event_id) seenEventIds.add(event.event_id);
    } catch {
      // Skip malformed lines — do not prevent startup.
    }
  }
  console.log(`Loaded ${seenEventIds.size} known event_ids from store.`);
}

// ── Server ───────────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'POST' && reqUrl.pathname === '/events') {
    handlePost(req, res);
    return;
  }

  if (req.method === 'GET' && reqUrl.pathname === '/events') {
    handleGet(reqUrl, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

// ── POST /events ─────────────────────────────────────────────────────────────

function handlePost(req, res) {
  const chunks = [];

  req.on('data', chunk => chunks.push(chunk));

  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');

    if (!req.headers['content-type'] || !req.headers['content-type'].includes('application/json')) {
      res.writeHead(415, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unsupported_media_type' }));
      return;
    }

    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_json' }));
      return;
    }

    receivedCount++;

    // Deduplication — only when event_id is present.
    if (event.event_id && seenEventIds.has(event.event_id)) {
      duplicateCount++;
      console.log(`[${new Date().toISOString()}] duplicate event_id=${event.event_id} (suppressed; total duplicates: ${duplicateCount})`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ accepted: false, duplicate: true, event_id: event.event_id }));
      return;
    }

    // Persist before responding — 200 means durably written.
    try {
      fs.appendFileSync(STORE_FILE, raw + '\n', 'utf8');
      persistedCount++;
      if (event.event_id) seenEventIds.add(event.event_id);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] persistence_failure event_id=${event.event_id || 'unknown'} error=${err.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'persistence_failure' }));
      return;
    }

    console.log(`[${new Date().toISOString()}] accepted event_id=${event.event_id} event_type=${event.event_type} correlation_id=${event.correlation_id} (total persisted: ${persistedCount})`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ accepted: true, event_id: event.event_id || null }));
  });

  req.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] request_error: ${err.message}`);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal_error' }));
  });
}

// ── GET /events ──────────────────────────────────────────────────────────────

function handleGet(reqUrl, res) {
  const correlationId = reqUrl.searchParams.get('correlation_id') || null;
  const eventType = reqUrl.searchParams.get('event_type') || null;
  const limitParam = parseInt(reqUrl.searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
  const limit = isNaN(limitParam) || limitParam < 1 ? DEFAULT_LIMIT : Math.min(limitParam, MAX_LIMIT);

  if (!fs.existsSync(STORE_FILE)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ events: [], count: 0 }));
    return;
  }

  let raw;
  try {
    raw = fs.readFileSync(STORE_FILE, 'utf8');
  } catch (err) {
    console.error(`[${new Date().toISOString()}] readback_failure error=${err.message}`);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'readback_failure' }));
    return;
  }

  const lines = raw.split('\n').filter(l => l.trim().length > 0);
  const events = [];

  for (const line of lines) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    if (correlationId && event.correlation_id !== correlationId) continue;
    if (eventType && event.event_type !== eventType) continue;

    events.push(event);
    if (events.length >= limit) break;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ events, count: events.length }));
}

// ── Start ────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`Ingestion boundary listening on http://localhost:${PORT}/events`);
  console.log(`Persisting to: ${STORE_FILE}`);
  console.log('Waiting for events...\n');
});
