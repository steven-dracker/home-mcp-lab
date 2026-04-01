'use strict';

/**
 * Phase 2 ingestion boundary — HTTP server with persistence and readback.
 *
 * Routes:
 *   POST /events          Accept and persist a single audit event.
 *                         Returns 200 only after the event is durably written.
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

let receivedCount = 0;
let persistedCount = 0;

// Ensure the storage directory exists at startup.
if (!fs.existsSync(STORE_DIR)) {
  fs.mkdirSync(STORE_DIR, { recursive: true });
}

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

    try {
      fs.appendFileSync(STORE_FILE, raw + '\n', 'utf8');
      persistedCount++;
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

  // File not present — valid empty state (server running, no events received yet).
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
      // Skip malformed lines — do not crash or reject the response.
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
