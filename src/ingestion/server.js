'use strict';

/**
 * Phase 2 ingestion boundary — minimal HTTP server.
 *
 * Accepts POST /events, validates Content-Type, logs received events.
 * This is the platform ingestion boundary for Phase 2.
 * It does not persist events — persistence is a future slice.
 *
 * Usage:
 *   node src/ingestion/server.js
 *   EVENT_INGESTION_URL=http://localhost:4318/events node src/emitter/demo-session.js
 *
 * Default port: 4318 (configurable via PORT env var)
 */

const http = require('http');

const PORT = parseInt(process.env.PORT || '4318', 10);
let receivedCount = 0;

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

    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_json' }));
      return;
    }

    if (!req.headers['content-type'] || !req.headers['content-type'].includes('application/json')) {
      res.writeHead(415, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unsupported_media_type' }));
      return;
    }

    receivedCount++;
    console.log(`\n[${new Date().toISOString()}] Event #${receivedCount} received`);
    console.log(JSON.stringify(event, null, 2));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ accepted: true, event_id: event.event_id || null }));
  });

  req.on('error', (err) => {
    console.error('Request error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal_error' }));
  });
}

server.listen(PORT, () => {
  console.log(`Ingestion boundary listening on http://localhost:${PORT}/events`);
  console.log('Waiting for events...\n');
});
