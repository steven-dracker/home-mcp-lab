'use strict';

/**
 * Phase 2 ingestion boundary — minimal HTTP server with append-only persistence.
 *
 * Accepts POST /events, validates Content-Type, persists the event to a local
 * JSONL store, then returns 200. The 200 response means the event is durably
 * written. If persistence fails, the server returns 500 and does not crash.
 *
 * Usage:
 *   node src/ingestion/server.js
 *   EVENT_INGESTION_URL=http://localhost:4318/events node src/emitter/demo-session.js
 *
 * Persisted events: ingestion-store/events.jsonl (excluded from git)
 * Default port: 4318 (configurable via PORT env var)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '4318', 10);

const STORE_DIR = path.join(__dirname, '..', '..', 'ingestion-store');
const STORE_FILE = path.join(STORE_DIR, 'events.jsonl');

let receivedCount = 0;
let persistedCount = 0;

// Ensure the storage directory exists at startup.
if (!fs.existsSync(STORE_DIR)) {
  fs.mkdirSync(STORE_DIR, { recursive: true });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/events') {
    handleEvent(req, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

function handleEvent(req, res) {
  const chunks = [];

  req.on('data', chunk => chunks.push(chunk));

  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');

    // Validate Content-Type before parsing.
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

    // Persist before responding. 200 means durably written.
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

server.listen(PORT, () => {
  console.log(`Ingestion boundary listening on http://localhost:${PORT}/events`);
  console.log(`Persisting to: ${STORE_FILE}`);
  console.log('Waiting for events...\n');
});
