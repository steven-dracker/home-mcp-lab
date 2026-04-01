'use strict';

const fs = require('fs');
const path = require('path');

const AUDIT_LOG_DIR = path.join(__dirname, '..', '..', 'audit-log');
const AUDIT_LOG_FILE = path.join(AUDIT_LOG_DIR, 'tool-invocations.jsonl');

/**
 * Submits a validated audit event to the local JSONL audit log.
 *
 * Phase 2 transport: local append-only JSONL file.
 * The platform ingestion boundary (HTTP endpoint) is not yet implemented.
 * When the ingestion boundary is available, this module is replaced
 * without changes to the emitter interface.
 *
 * Throws on I/O failure. Callers must catch — transport failure must
 * be handled by the failure observer, not propagated to the tool call.
 */
function submit(event) {
  if (!fs.existsSync(AUDIT_LOG_DIR)) {
    fs.mkdirSync(AUDIT_LOG_DIR, { recursive: true });
  }
  fs.appendFileSync(AUDIT_LOG_FILE, JSON.stringify(event) + '\n', 'utf8');
}

module.exports = { submit, AUDIT_LOG_FILE };
