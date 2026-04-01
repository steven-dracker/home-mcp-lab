'use strict';

/**
 * Records emitter failures to stderr.
 *
 * Failures observed here are audit gaps — they represent tool call events
 * that could not be emitted. They must not propagate to the tool call.
 *
 * Output format: structured JSON on stderr, prefixed with [emitter-failure].
 * These are local operational logs, not platform audit events.
 */
function record(err, context) {
  const entry = {
    timestamp: new Date().toISOString(),
    error: err && err.message ? err.message : String(err),
    context: context || {}
  };
  process.stderr.write('[emitter-failure] ' + JSON.stringify(entry) + '\n');
}

module.exports = { record };
