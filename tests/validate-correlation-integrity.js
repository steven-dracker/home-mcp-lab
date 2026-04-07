'use strict';

// Validation tests for TD-HMCP-000004 — Correlation Integrity Checks
//
// Validates:
//   1. Valid correlated traces pass
//   2. Missing correlation_id is flagged (Rule 1)
//   3. Activity events misaligned with session correlation are flagged (Rule 2)
//   4. Conflicting trace context (mixed correlation scopes) is flagged (Rule 3)
//   5. Unlinked denial/approval events are flagged (Rule 4)
//   6. Malformed inputs handled cleanly
//   7. Current event flows (completeness fixtures) continue to pass
//
// No network required. Run: node tests/validate-correlation-integrity.js

const assert = require('assert');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CID_A = 'sess-20260407-aaa';
const CID_B = 'sess-20260407-bbb';

function evt(overrides) {
  return {
    event_id:       `evt-${Math.random().toString(36).slice(2, 9)}`,
    event_type:     'tool.invocation',
    timestamp:      '2026-04-07T12:00:00Z',
    platform:       'home-mcp-lab',
    project_id:     'home-mcp-lab',
    agent_id:       'test-agent',
    mcp_server:     'github-mcp-server',
    action:         'get_me',
    status:         'success',
    correlation_id: CID_A,
    metadata:       { tool_name: 'get_me' },
    ...overrides,
  };
}

// Full clean session: start → invocation → end, all same CID.
function cleanSession(cid) {
  const c = cid || CID_A;
  return [
    evt({ event_id: 'e-001', event_type: 'session.start',  action: 'mcp_session_init',  correlation_id: c, metadata: {} }),
    evt({ event_id: 'e-002', event_type: 'tool.invocation', action: 'get_me',            correlation_id: c, metadata: { tool_name: 'get_me' } }),
    evt({ event_id: 'e-003', event_type: 'session.end',    action: 'mcp_session_close',  correlation_id: c, metadata: {} }),
  ];
}

// Approval path: start → approval_granted → invocation → end, all same CID.
function approvalSession() {
  return [
    evt({ event_id: 'e-001', event_type: 'session.start',         action: 'mcp_session_init',  correlation_id: CID_A, metadata: {} }),
    evt({ event_id: 'e-002', event_type: 'tool.approval_granted', action: 'merge_pull_request', correlation_id: CID_A, metadata: { tool_name: 'merge_pull_request' } }),
    evt({ event_id: 'e-003', event_type: 'tool.invocation',       action: 'merge_pull_request', correlation_id: CID_A, metadata: { tool_name: 'merge_pull_request' } }),
    evt({ event_id: 'e-004', event_type: 'session.end',           action: 'mcp_session_close',  correlation_id: CID_A, metadata: {} }),
  ];
}

// Denial path: start → denial → end, all same CID.
function denialSession() {
  return [
    evt({ event_id: 'e-001', event_type: 'session.start', action: 'mcp_session_init',  correlation_id: CID_A, metadata: {} }),
    evt({ event_id: 'e-002', event_type: 'tool.denial',   action: 'delete_branch',     correlation_id: CID_A, status: 'failure', metadata: { tool_name: 'delete_branch' } }),
    evt({ event_id: 'e-003', event_type: 'session.end',   action: 'mcp_session_close', correlation_id: CID_A, metadata: {} }),
  ];
}

// ── Load validator ────────────────────────────────────────────────────────────

const {
  validate,
  ISSUE_CODES,
  checkCorrelationPresence,
  checkSessionActivityAlignment,
  checkTraceContextConsistency,
  checkUnlinkedControlEvents,
} = require('../src/detection/correlation-integrity-validator');

// ── 1. Valid traces pass ──────────────────────────────────────────────────────

(async () => {

  console.log('\n1. Valid traces — recognized as correlation-valid');

  await test('clean session (start → invocation → end, uniform CID) is valid', async () => {
    const result = validate(cleanSession());
    assert.strictEqual(result.valid, true, `Issues: ${JSON.stringify(result.issues)}`);
    assert.strictEqual(result.issues.length, 0);
  });

  await test('approval path session (uniform CID) is valid', async () => {
    const result = validate(approvalSession());
    assert.strictEqual(result.valid, true, `Issues: ${JSON.stringify(result.issues)}`);
    assert.strictEqual(result.issues.length, 0);
  });

  await test('denial path session (uniform CID) is valid', async () => {
    const result = validate(denialSession());
    assert.strictEqual(result.valid, true, `Issues: ${JSON.stringify(result.issues)}`);
    assert.strictEqual(result.issues.length, 0);
  });

  await test('empty trace is valid', async () => {
    const result = validate([]);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.issues.length, 0);
  });

  await test('single session.start-only event is valid', async () => {
    const result = validate([
      evt({ event_type: 'session.start', correlation_id: CID_A, action: 'mcp_session_init', metadata: {} }),
    ]);
    assert.strictEqual(result.valid, true);
  });

  await test('result always has valid, issues, and warnings fields', async () => {
    const result = validate([]);
    assert.ok('valid'    in result);
    assert.ok(Array.isArray(result.issues));
    assert.ok(Array.isArray(result.warnings));
  });

  // ── 2. Rule 1 — Correlation presence ─────────────────────────────────────

  console.log('\n2. Rule 1 — missing_correlation_id');

  await test('event with null correlation_id is flagged', async () => {
    const result = validate([ evt({ correlation_id: null }) ]);
    assert.strictEqual(result.valid, false);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.MISSING_CORRELATION_ID);
    assert.ok(issue, 'Expected missing_correlation_id issue');
  });

  await test('event with empty-string correlation_id is flagged', async () => {
    const result = validate([ evt({ correlation_id: '' }) ]);
    assert.strictEqual(result.valid, false);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.MISSING_CORRELATION_ID);
    assert.ok(issue, 'Expected missing_correlation_id issue');
  });

  await test('issue context includes event_id and event_type', async () => {
    const events = [ evt({ event_id: 'e-xyz', event_type: 'tool.invocation', correlation_id: null }) ];
    const result = validate(events);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.MISSING_CORRELATION_ID);
    assert.ok(issue);
    assert.strictEqual(issue.context.event_id, 'e-xyz');
    assert.strictEqual(issue.context.event_type, 'tool.invocation');
  });

  await test('multiple events with missing correlation_ids each produce an issue', async () => {
    const events = [
      evt({ event_id: 'e-001', correlation_id: null }),
      evt({ event_id: 'e-002', correlation_id: null }),
    ];
    const result = validate(events);
    const missing = result.issues.filter(i => i.code === ISSUE_CODES.MISSING_CORRELATION_ID);
    assert.strictEqual(missing.length, 2);
  });

  await test('event with valid correlation_id is not flagged', async () => {
    const result = validate([ evt({ correlation_id: CID_A }) ]);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.MISSING_CORRELATION_ID);
    assert.strictEqual(issue, undefined);
  });

  // ── 3. Rule 2 — Session activity alignment ────────────────────────────────

  console.log('\n3. Rule 2 — inconsistent_correlation_id');

  await test('activity event with different CID from session.start is flagged', async () => {
    const events = [
      evt({ event_id: 'e-001', event_type: 'session.start',   correlation_id: CID_A, action: 'mcp_session_init', metadata: {} }),
      evt({ event_id: 'e-002', event_type: 'tool.invocation', correlation_id: CID_B, action: 'get_me',           metadata: { tool_name: 'get_me' } }),
      evt({ event_id: 'e-003', event_type: 'session.end',     correlation_id: CID_A, action: 'mcp_session_close', metadata: {} }),
    ];
    const result = validate(events);
    assert.strictEqual(result.valid, false);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.INCONSISTENT_CORRELATION_ID);
    assert.ok(issue, 'Expected inconsistent_correlation_id issue');
    assert.strictEqual(issue.context.event_correlation_id,   CID_B);
    assert.strictEqual(issue.context.session_correlation_id, CID_A);
  });

  await test('denial event with different CID from session.start is flagged', async () => {
    const events = [
      evt({ event_id: 'e-001', event_type: 'session.start', correlation_id: CID_A, action: 'mcp_session_init', metadata: {} }),
      evt({ event_id: 'e-002', event_type: 'tool.denial',   correlation_id: CID_B, action: 'delete_branch',    status: 'failure', metadata: { tool_name: 'delete_branch' } }),
      evt({ event_id: 'e-003', event_type: 'session.end',   correlation_id: CID_A, action: 'mcp_session_close', metadata: {} }),
    ];
    const result = validate(events);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.INCONSISTENT_CORRELATION_ID);
    assert.ok(issue, 'Expected inconsistent_correlation_id for misaligned denial');
    assert.strictEqual(issue.context.event_type, 'tool.denial');
  });

  await test('approval event with different CID from session.start is flagged', async () => {
    const events = [
      evt({ event_id: 'e-001', event_type: 'session.start',         correlation_id: CID_A, action: 'mcp_session_init',  metadata: {} }),
      evt({ event_id: 'e-002', event_type: 'tool.approval_granted', correlation_id: CID_B, action: 'merge_pull_request', metadata: { tool_name: 'merge_pull_request' } }),
      evt({ event_id: 'e-003', event_type: 'tool.invocation',       correlation_id: CID_A, action: 'merge_pull_request', metadata: { tool_name: 'merge_pull_request' } }),
      evt({ event_id: 'e-004', event_type: 'session.end',           correlation_id: CID_A, action: 'mcp_session_close',  metadata: {} }),
    ];
    const result = validate(events);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.INCONSISTENT_CORRELATION_ID);
    assert.ok(issue, 'Expected inconsistent_correlation_id for misaligned approval');
    assert.strictEqual(issue.context.event_type, 'tool.approval_granted');
  });

  await test('rule 2 skipped when zero session.start events in trace', async () => {
    // No session.start → Rule 2 does not apply; no inconsistency flagged by this rule.
    const events = [
      evt({ event_id: 'e-001', event_type: 'tool.invocation', correlation_id: CID_A, metadata: { tool_name: 'get_me' } }),
      evt({ event_id: 'e-002', event_type: 'tool.invocation', correlation_id: CID_B, metadata: { tool_name: 'get_me' } }),
    ];
    const result = checkSessionActivityAlignment(events);
    assert.strictEqual(result.issues.length, 0, 'Rule 2 should not fire with no session.start');
  });

  await test('rule 2 skipped when multiple session.start events in trace', async () => {
    // Two session.starts → multi-session trace; Rule 2 is scoped to single-session only.
    const events = [
      evt({ event_id: 'e-001', event_type: 'session.start',   correlation_id: CID_A, action: 'mcp_session_init', metadata: {} }),
      evt({ event_id: 'e-002', event_type: 'session.start',   correlation_id: CID_B, action: 'mcp_session_init', metadata: {} }),
      evt({ event_id: 'e-003', event_type: 'tool.invocation', correlation_id: CID_B, metadata: { tool_name: 'get_me' } }),
    ];
    const result = checkSessionActivityAlignment(events);
    assert.strictEqual(result.issues.length, 0, 'Rule 2 should not fire with multiple session.starts');
  });

  await test('secret.retrieval with mismatched CID is flagged by rule 2', async () => {
    const events = [
      evt({ event_id: 'e-001', event_type: 'session.start',    correlation_id: CID_A, action: 'mcp_session_init', metadata: {} }),
      evt({ event_id: 'e-002', event_type: 'secret.retrieval', correlation_id: CID_B, action: 'keeper-commander', metadata: { secret_identifier: 'some/secret', retrieval_mechanism: 'keeper-commander', retrieval_mode: 'non-interactive', environment_context: 'service' } }),
    ];
    const result = validate(events);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.INCONSISTENT_CORRELATION_ID);
    assert.ok(issue, 'Expected inconsistent_correlation_id for misaligned secret.retrieval');
  });

  // ── 4. Rule 3 — Trace context consistency ────────────────────────────────

  console.log('\n4. Rule 3 — conflicting_trace_context');

  await test('trace with two distinct CIDs and one session.start is flagged', async () => {
    const events = [
      evt({ event_id: 'e-001', event_type: 'session.start',   correlation_id: CID_A, action: 'mcp_session_init', metadata: {} }),
      evt({ event_id: 'e-002', event_type: 'tool.invocation', correlation_id: CID_A, metadata: { tool_name: 'get_me' } }),
      evt({ event_id: 'e-003', event_type: 'tool.invocation', correlation_id: CID_B, metadata: { tool_name: 'get_me' } }),
    ];
    const result = validate(events);
    assert.strictEqual(result.valid, false);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.CONFLICTING_TRACE_CONTEXT);
    assert.ok(issue, 'Expected conflicting_trace_context');
    assert.strictEqual(issue.context.distinct_correlation_id_count, 2);
    assert.strictEqual(issue.context.session_start_count, 1);
  });

  await test('trace with two distinct CIDs and no session.start is flagged', async () => {
    const events = [
      evt({ event_id: 'e-001', event_type: 'tool.invocation', correlation_id: CID_A, metadata: { tool_name: 'get_me' } }),
      evt({ event_id: 'e-002', event_type: 'tool.invocation', correlation_id: CID_B, metadata: { tool_name: 'get_me' } }),
    ];
    const result = validate(events);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.CONFLICTING_TRACE_CONTEXT);
    assert.ok(issue, 'Expected conflicting_trace_context with no session.start');
  });

  await test('issue context includes correlation_ids array', async () => {
    const events = [
      evt({ event_id: 'e-001', correlation_id: CID_A, metadata: { tool_name: 'get_me' } }),
      evt({ event_id: 'e-002', correlation_id: CID_B, metadata: { tool_name: 'get_me' } }),
    ];
    const result = validate(events);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.CONFLICTING_TRACE_CONTEXT);
    assert.ok(issue);
    assert.ok(Array.isArray(issue.context.correlation_ids));
    assert.ok(issue.context.correlation_ids.includes(CID_A));
    assert.ok(issue.context.correlation_ids.includes(CID_B));
  });

  await test('single uniform CID across all events is not flagged', async () => {
    const result = validate(cleanSession());
    const issue = result.issues.find(i => i.code === ISSUE_CODES.CONFLICTING_TRACE_CONTEXT);
    assert.strictEqual(issue, undefined);
  });

  await test('two distinct CIDs with two session.starts is not flagged (multi-session)', async () => {
    // distinct_cids (2) equals session_start_count (2) → not flagged
    const events = [
      evt({ event_id: 'e-001', event_type: 'session.start',   correlation_id: CID_A, action: 'mcp_session_init', metadata: {} }),
      evt({ event_id: 'e-002', event_type: 'tool.invocation', correlation_id: CID_A, metadata: { tool_name: 'get_me' } }),
      evt({ event_id: 'e-003', event_type: 'session.start',   correlation_id: CID_B, action: 'mcp_session_init', metadata: {} }),
      evt({ event_id: 'e-004', event_type: 'tool.invocation', correlation_id: CID_B, metadata: { tool_name: 'get_me' } }),
    ];
    const result = checkTraceContextConsistency(events);
    assert.strictEqual(result.issues.length, 0, 'Two matching session starts should not trigger conflicting context');
  });

  // ── 5. Rule 4 — Unlinked control events ──────────────────────────────────

  console.log('\n5. Rule 4 — unlinked_denial_event / unlinked_approval_event');

  await test('denial event with unique CID in multi-event trace is flagged', async () => {
    const events = [
      evt({ event_id: 'e-001', event_type: 'session.start', correlation_id: CID_A, action: 'mcp_session_init', metadata: {} }),
      evt({ event_id: 'e-002', event_type: 'tool.denial',   correlation_id: CID_B, action: 'delete_branch',    status: 'failure', metadata: { tool_name: 'delete_branch' } }),
      evt({ event_id: 'e-003', event_type: 'session.end',   correlation_id: CID_A, action: 'mcp_session_close', metadata: {} }),
    ];
    const result = validate(events);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.UNLINKED_DENIAL_EVENT);
    assert.ok(issue, 'Expected unlinked_denial_event');
    assert.strictEqual(issue.context.correlation_id, CID_B);
    assert.strictEqual(issue.context.tool_name, 'delete_branch');
  });

  await test('approval event with unique CID in multi-event trace is flagged', async () => {
    const events = [
      evt({ event_id: 'e-001', event_type: 'session.start',         correlation_id: CID_A, action: 'mcp_session_init',  metadata: {} }),
      evt({ event_id: 'e-002', event_type: 'tool.approval_granted', correlation_id: CID_B, action: 'merge_pull_request', metadata: { tool_name: 'merge_pull_request' } }),
      evt({ event_id: 'e-003', event_type: 'session.end',           correlation_id: CID_A, action: 'mcp_session_close',  metadata: {} }),
    ];
    const result = validate(events);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.UNLINKED_APPROVAL_EVENT);
    assert.ok(issue, 'Expected unlinked_approval_event');
    assert.strictEqual(issue.context.correlation_id, CID_B);
  });

  await test('denial event with shared CID is not flagged as unlinked', async () => {
    const result = validate(denialSession());
    const issue = result.issues.find(i => i.code === ISSUE_CODES.UNLINKED_DENIAL_EVENT);
    assert.strictEqual(issue, undefined);
  });

  await test('approval event with shared CID is not flagged as unlinked', async () => {
    const result = validate(approvalSession());
    const issue = result.issues.find(i => i.code === ISSUE_CODES.UNLINKED_APPROVAL_EVENT);
    assert.strictEqual(issue, undefined);
  });

  await test('single-event denial trace is not flagged as unlinked (solo records are valid)', async () => {
    const events = [
      evt({ event_id: 'e-001', event_type: 'tool.denial', correlation_id: CID_A, action: 'delete_branch', status: 'failure', metadata: { tool_name: 'delete_branch' } }),
    ];
    const result = validate(events);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.UNLINKED_DENIAL_EVENT);
    assert.strictEqual(issue, undefined, 'Single-event trace should not be flagged as unlinked');
  });

  await test('single-event approval trace is not flagged as unlinked', async () => {
    const events = [
      evt({ event_id: 'e-001', event_type: 'tool.approval_granted', correlation_id: CID_A, action: 'merge_pull_request', metadata: { tool_name: 'merge_pull_request' } }),
    ];
    const result = validate(events);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.UNLINKED_APPROVAL_EVENT);
    assert.strictEqual(issue, undefined, 'Single-event trace should not be flagged as unlinked');
  });

  // ── 6. Edge cases ─────────────────────────────────────────────────────────

  console.log('\n6. Edge cases');

  await test('non-array input returns valid:false with invalid_input issue', async () => {
    const result = validate('not-an-array');
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(i => i.code === ISSUE_CODES.INVALID_INPUT));
  });

  await test('null input returns valid:false with invalid_input issue', async () => {
    const result = validate(null);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(i => i.code === ISSUE_CODES.INVALID_INPUT));
  });

  await test('ISSUE_CODES are all non-empty strings', async () => {
    for (const [key, value] of Object.entries(ISSUE_CODES)) {
      assert.strictEqual(typeof value, 'string', `Expected ISSUE_CODES.${key} to be a string`);
      assert.ok(value.length > 0, `Expected ISSUE_CODES.${key} to be non-empty`);
    }
  });

  await test('all expected ISSUE_CODES are present', async () => {
    const expected = [
      'INVALID_INPUT',
      'MISSING_CORRELATION_ID',
      'INCONSISTENT_CORRELATION_ID',
      'CONFLICTING_TRACE_CONTEXT',
      'UNLINKED_DENIAL_EVENT',
      'UNLINKED_APPROVAL_EVENT',
    ];
    for (const key of expected) {
      assert.ok(key in ISSUE_CODES, `Expected ISSUE_CODES.${key} to exist`);
    }
  });

  await test('events with undefined correlation_id (missing key) are flagged', async () => {
    const badEvt = { event_id: 'e-001', event_type: 'tool.invocation', timestamp: 't', platform: 'p', project_id: 'p', agent_id: 'a', mcp_server: 's', action: 'x', status: 'success', metadata: {} };
    // correlation_id key is entirely absent
    const result = validate([ badEvt ]);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.MISSING_CORRELATION_ID);
    assert.ok(issue, 'Expected missing_correlation_id for event with no correlation_id key');
  });

  // ── 7. Individual rule exports ────────────────────────────────────────────

  console.log('\n7. Individual rule exports — callable and return correct shape');

  await test('checkCorrelationPresence returns { issues, warnings }', async () => {
    const result = checkCorrelationPresence([evt()]);
    assert.ok(Array.isArray(result.issues));
    assert.ok(Array.isArray(result.warnings));
  });

  await test('checkSessionActivityAlignment returns { issues, warnings }', async () => {
    const result = checkSessionActivityAlignment([]);
    assert.ok(Array.isArray(result.issues));
    assert.ok(Array.isArray(result.warnings));
  });

  await test('checkTraceContextConsistency returns { issues, warnings }', async () => {
    const result = checkTraceContextConsistency([]);
    assert.ok(Array.isArray(result.issues));
    assert.ok(Array.isArray(result.warnings));
  });

  await test('checkUnlinkedControlEvents returns { issues, warnings }', async () => {
    const result = checkUnlinkedControlEvents([]);
    assert.ok(Array.isArray(result.issues));
    assert.ok(Array.isArray(result.warnings));
  });

  // ── 8. Regression: prior validator tests unaffected ──────────────────────

  console.log('\n8. Regression — completeness validator unaffected');

  await test('completeness validator still loads and validate() returns expected shape', async () => {
    const completeness = require('../src/detection/event-completeness-validator');
    const result = completeness.validate([]);
    assert.strictEqual(result.complete, true);
    assert.ok(Array.isArray(result.issues));
  });

  // ── Summary ───────────────────────────────────────────────────────────────

  const bar = '─'.repeat(40);
  console.log(`\n${bar}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);

})().catch(err => {
  console.error('\nValidation script crashed:', err.message);
  process.exit(1);
});
