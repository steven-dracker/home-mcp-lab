'use strict';

// Validation tests for TD-HMCP-000003 — Event Completeness Validation
//
// Validates:
//   1. Complete traces are recognized as complete
//   2. Missing session framing is flagged
//   3. Correlation inconsistencies are flagged
//   4. Approval path gaps are flagged
//   5. Approval evidence gaps are flagged
//   6. Field integrity failures are flagged
//   7. Edge cases: empty input, non-array input, unknown tools
//
// No network required. Run: node tests/validate-event-completeness.js

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

const CID = 'sess-20260407-test001';

// Minimal valid event factory — only sets required fields.
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
    correlation_id: CID,
    metadata:       { tool_name: 'get_me' },
    ...overrides,
  };
}

// Full happy-path session fixture: start → LOW invocation → end
function happyPathSession() {
  return [
    evt({ event_id: 'evt-001', event_type: 'session.start',  action: 'mcp_session_init', metadata: { session_type: 'interactive' } }),
    evt({ event_id: 'evt-002', event_type: 'tool.invocation', action: 'get_me',           metadata: { tool_name: 'get_me' } }),
    evt({ event_id: 'evt-003', event_type: 'session.end',    action: 'mcp_session_close', status: 'success', metadata: { completion_reason: 'task_complete' } }),
  ];
}

// Approval-required tool (merge_pull_request) — correct approval path
function approvalGrantedSession() {
  return [
    evt({ event_id: 'evt-001', event_type: 'session.start',         action: 'mcp_session_init',  metadata: { session_type: 'interactive' } }),
    evt({ event_id: 'evt-002', event_type: 'tool.approval_granted', action: 'merge_pull_request', metadata: { tool_name: 'merge_pull_request', risk_level: 'HIGH', policy_basis: 'high_risk_tool_allowed_by_explicit_approval', approval_mechanism: 'context_flag' } }),
    evt({ event_id: 'evt-003', event_type: 'tool.invocation',       action: 'merge_pull_request', metadata: { tool_name: 'merge_pull_request', risk_level: 'HIGH' } }),
    evt({ event_id: 'evt-004', event_type: 'session.end',           action: 'mcp_session_close',  metadata: { completion_reason: 'task_complete' } }),
  ];
}

// Denial-only session (tool.denial is self-contained evidence)
function denialSession() {
  return [
    evt({ event_id: 'evt-001', event_type: 'session.start', action: 'mcp_session_init', metadata: { session_type: 'interactive' } }),
    evt({ event_id: 'evt-002', event_type: 'tool.denial',   action: 'delete_branch',    status: 'failure', metadata: { tool_name: 'delete_branch', risk_level: 'DESTRUCTIVE', denial_reason: 'policy_denied', policy_basis: 'destructive_tool_not_allowed_by_default' } }),
    evt({ event_id: 'evt-003', event_type: 'session.end',   action: 'mcp_session_close', metadata: { completion_reason: 'task_complete' } }),
  ];
}

// ── Load validator ─────────────────────────────────────────────────────────────

const {
  validate,
  ISSUE_CODES,
  checkRequiredFields,
  checkSessionCoverage,
  checkCorrelationConsistency,
  checkApprovalPathCompleteness,
  checkApprovalEvidenceForInvocations,
} = require('../src/detection/event-completeness-validator');

// ── 1. Complete traces ─────────────────────────────────────────────────────────

(async () => {

  console.log('\n1. Complete traces — recognized as complete');

  await test('complete happy-path session (start → invocation → end) is complete', async () => {
    const result = validate(happyPathSession());
    assert.strictEqual(result.complete, true);
    assert.strictEqual(result.issues.length, 0);
  });

  await test('complete approval-path session (start → approval_granted → invocation → end) is complete', async () => {
    const result = validate(approvalGrantedSession());
    assert.strictEqual(result.complete, true);
    assert.strictEqual(result.issues.length, 0);
  });

  await test('complete denial session (start → tool.denial → end) is complete', async () => {
    const result = validate(denialSession());
    assert.strictEqual(result.complete, true);
    assert.strictEqual(result.issues.length, 0);
  });

  await test('empty trace is complete (no events — no rule violations)', async () => {
    const result = validate([]);
    assert.strictEqual(result.complete, true);
    assert.strictEqual(result.issues.length, 0);
  });

  await test('result always has issues and warnings arrays', async () => {
    const result = validate([]);
    assert.ok(Array.isArray(result.issues));
    assert.ok(Array.isArray(result.warnings));
  });

  // ── 2. Session coverage ────────────────────────────────────────────────────

  console.log('\n2. Session coverage — missing framing');

  await test('missing session.start is flagged when activity events are present', async () => {
    const events = [
      evt({ event_id: 'evt-001', event_type: 'tool.invocation', action: 'get_me', metadata: { tool_name: 'get_me' } }),
      evt({ event_id: 'evt-002', event_type: 'session.end',     action: 'mcp_session_close', metadata: {} }),
    ];
    const result = validate(events);
    assert.strictEqual(result.complete, false);
    const codes = result.issues.map(i => i.code);
    assert.ok(codes.includes(ISSUE_CODES.MISSING_SESSION_START), `Expected missing_session_start; got: ${codes}`);
  });

  await test('missing session.end is flagged when session.start is present', async () => {
    const events = [
      evt({ event_id: 'evt-001', event_type: 'session.start',  action: 'mcp_session_init', metadata: {} }),
      evt({ event_id: 'evt-002', event_type: 'tool.invocation', action: 'get_me',           metadata: { tool_name: 'get_me' } }),
    ];
    const result = validate(events);
    assert.strictEqual(result.complete, false);
    const codes = result.issues.map(i => i.code);
    assert.ok(codes.includes(ISSUE_CODES.MISSING_SESSION_END), `Expected missing_session_end; got: ${codes}`);
  });

  await test('missing_session_end issue includes correlation_id context', async () => {
    const events = [
      evt({ event_id: 'evt-001', event_type: 'session.start', action: 'mcp_session_init', metadata: {}, correlation_id: 'sess-test-999' }),
    ];
    const result = validate(events);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.MISSING_SESSION_END);
    assert.ok(issue, 'Expected missing_session_end issue');
    assert.strictEqual(issue.context.correlation_id, 'sess-test-999');
  });

  await test('session without any activity events does not require session.start', async () => {
    // Only session.start and session.end — no activity — this is fine (no start required by activity rule)
    const events = [
      evt({ event_id: 'evt-001', event_type: 'session.start', action: 'mcp_session_init', metadata: {} }),
      evt({ event_id: 'evt-002', event_type: 'session.end',   action: 'mcp_session_close', metadata: {} }),
    ];
    const result = validate(events);
    // Should pass the session coverage rule (both present)
    const sessionIssues = result.issues.filter(i =>
      i.code === ISSUE_CODES.MISSING_SESSION_START || i.code === ISSUE_CODES.MISSING_SESSION_END
    );
    assert.strictEqual(sessionIssues.length, 0);
  });

  await test('tool.denial is a session-activity event and triggers missing_session_start when no start', async () => {
    const events = [
      evt({ event_id: 'evt-001', event_type: 'tool.denial', action: 'delete_branch', status: 'failure', metadata: {} }),
    ];
    const result = validate(events);
    const codes = result.issues.map(i => i.code);
    assert.ok(codes.includes(ISSUE_CODES.MISSING_SESSION_START));
  });

  // ── 3. Correlation consistency ─────────────────────────────────────────────

  console.log('\n3. Correlation consistency');

  await test('mismatched correlation_id between session.start and session.end is flagged', async () => {
    const events = [
      evt({ event_id: 'evt-001', event_type: 'session.start', action: 'mcp_session_init', correlation_id: 'sess-aaa', metadata: {} }),
      evt({ event_id: 'evt-002', event_type: 'session.end',   action: 'mcp_session_close', correlation_id: 'sess-bbb', metadata: {} }),
    ];
    const result = validate(events);
    assert.strictEqual(result.complete, false);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.INCONSISTENT_SESSION_CORRELATION);
    assert.ok(issue, 'Expected inconsistent_session_correlation issue');
    assert.strictEqual(issue.context.session_start_correlation_id, 'sess-aaa');
    assert.strictEqual(issue.context.session_end_correlation_id,   'sess-bbb');
  });

  await test('matching correlation_ids between session.start and session.end is not flagged', async () => {
    const events = [
      evt({ event_id: 'evt-001', event_type: 'session.start', action: 'mcp_session_init',  correlation_id: 'sess-same', metadata: {} }),
      evt({ event_id: 'evt-002', event_type: 'session.end',   action: 'mcp_session_close', correlation_id: 'sess-same', metadata: {} }),
    ];
    const result = validate(events);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.INCONSISTENT_SESSION_CORRELATION);
    assert.strictEqual(issue, undefined);
  });

  // ── 4. Approval path completeness ─────────────────────────────────────────

  console.log('\n4. Approval path — approval_without_invocation');

  await test('tool.approval_granted without matching tool.invocation is flagged', async () => {
    const events = [
      evt({ event_id: 'evt-001', event_type: 'session.start',         action: 'mcp_session_init',  metadata: {} }),
      evt({ event_id: 'evt-002', event_type: 'tool.approval_granted', action: 'merge_pull_request', metadata: { tool_name: 'merge_pull_request' } }),
      // No tool.invocation follows
      evt({ event_id: 'evt-003', event_type: 'session.end',           action: 'mcp_session_close',  metadata: {} }),
    ];
    const result = validate(events);
    assert.strictEqual(result.complete, false);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.APPROVAL_WITHOUT_INVOCATION);
    assert.ok(issue, 'Expected approval_without_invocation issue');
    assert.strictEqual(issue.context.tool_name, 'merge_pull_request');
  });

  await test('tool.approval_granted with matching tool.invocation (same tool, same correlation_id) is not flagged', async () => {
    const result = validate(approvalGrantedSession());
    const issue = result.issues.find(i => i.code === ISSUE_CODES.APPROVAL_WITHOUT_INVOCATION);
    assert.strictEqual(issue, undefined);
  });

  await test('tool.approval_granted with invocation under different correlation_id is flagged', async () => {
    const events = [
      evt({ event_id: 'evt-001', event_type: 'tool.approval_granted', action: 'merge_pull_request', correlation_id: 'sess-aaa', metadata: { tool_name: 'merge_pull_request' } }),
      evt({ event_id: 'evt-002', event_type: 'tool.invocation',       action: 'merge_pull_request', correlation_id: 'sess-bbb', metadata: { tool_name: 'merge_pull_request' } }),
    ];
    const result = validate(events);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.APPROVAL_WITHOUT_INVOCATION);
    assert.ok(issue, 'Expected approval_without_invocation when correlation_ids differ');
  });

  // ── 5. Approval evidence for invocations ──────────────────────────────────

  console.log('\n5. Approval evidence — missing_approval_evidence');

  await test('tool.invocation for approval-required tool without approval_granted is flagged', async () => {
    const events = [
      evt({ event_id: 'evt-001', event_type: 'session.start',   action: 'mcp_session_init',  metadata: {} }),
      evt({ event_id: 'evt-002', event_type: 'tool.invocation', action: 'merge_pull_request', metadata: { tool_name: 'merge_pull_request', risk_level: 'HIGH' } }),
      evt({ event_id: 'evt-003', event_type: 'session.end',     action: 'mcp_session_close',  metadata: {} }),
    ];
    const result = validate(events);
    assert.strictEqual(result.complete, false);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.MISSING_APPROVAL_EVIDENCE);
    assert.ok(issue, 'Expected missing_approval_evidence issue');
    assert.strictEqual(issue.context.tool_name, 'merge_pull_request');
  });

  await test('tool.invocation for approval-required tool WITH approval_granted is not flagged', async () => {
    const result = validate(approvalGrantedSession());
    const issue = result.issues.find(i => i.code === ISSUE_CODES.MISSING_APPROVAL_EVIDENCE);
    assert.strictEqual(issue, undefined);
  });

  await test('tool.invocation for LOW tool (get_me) without approval_granted is not flagged', async () => {
    const result = validate(happyPathSession());
    const issue = result.issues.find(i => i.code === ISSUE_CODES.MISSING_APPROVAL_EVIDENCE);
    assert.strictEqual(issue, undefined);
  });

  await test('tool.invocation for unregistered/unknown tool is not flagged for missing approval', async () => {
    const events = [
      evt({ event_id: 'evt-001', event_type: 'session.start',   action: 'mcp_session_init',       metadata: {} }),
      evt({ event_id: 'evt-002', event_type: 'tool.invocation', action: 'some_unregistered_tool',  metadata: { tool_name: 'some_unregistered_tool' } }),
      evt({ event_id: 'evt-003', event_type: 'session.end',     action: 'mcp_session_close',       metadata: {} }),
    ];
    const result = validate(events);
    const issue = result.issues.find(i => i.code === ISSUE_CODES.MISSING_APPROVAL_EVIDENCE);
    assert.strictEqual(issue, undefined);
  });

  // ── 6. Field integrity ─────────────────────────────────────────────────────

  console.log('\n6. Field integrity — missing_required_field');

  await test('event missing correlation_id is flagged', async () => {
    const events = [
      evt({ event_id: 'evt-001', correlation_id: null }),
    ];
    const result = validate(events);
    assert.strictEqual(result.complete, false);
    const issue = result.issues.find(i =>
      i.code === ISSUE_CODES.MISSING_REQUIRED_FIELD && i.context.field === 'correlation_id'
    );
    assert.ok(issue, 'Expected missing_required_field for correlation_id');
  });

  await test('event missing event_id is flagged', async () => {
    const events = [ evt({ event_id: '' }) ];
    const result = validate(events);
    const issue = result.issues.find(i =>
      i.code === ISSUE_CODES.MISSING_REQUIRED_FIELD && i.context.field === 'event_id'
    );
    assert.ok(issue, 'Expected missing_required_field for event_id');
  });

  await test('event with metadata as non-object is flagged', async () => {
    const events = [ evt({ metadata: 'not-an-object' }) ];
    const result = validate(events);
    const issue = result.issues.find(i =>
      i.code === ISSUE_CODES.MISSING_REQUIRED_FIELD && i.context.field === 'metadata'
    );
    assert.ok(issue, 'Expected missing_required_field for non-object metadata');
  });

  await test('fully valid event has no field integrity issues', async () => {
    const result = validate([ evt() ]);
    const fieldIssues = result.issues.filter(i => i.code === ISSUE_CODES.MISSING_REQUIRED_FIELD);
    assert.strictEqual(fieldIssues.length, 0);
  });

  // ── 7. Edge cases ─────────────────────────────────────────────────────────

  console.log('\n7. Edge cases');

  await test('non-array input returns complete:false with invalid_input issue', async () => {
    const result = validate({ not: 'an array' });
    assert.strictEqual(result.complete, false);
    assert.ok(result.issues.some(i => i.code === ISSUE_CODES.INVALID_INPUT));
  });

  await test('null input returns complete:false with invalid_input issue', async () => {
    const result = validate(null);
    assert.strictEqual(result.complete, false);
    assert.ok(result.issues.some(i => i.code === ISSUE_CODES.INVALID_INPUT));
  });

  await test('ISSUE_CODES are all stable strings', async () => {
    for (const [key, value] of Object.entries(ISSUE_CODES)) {
      assert.strictEqual(typeof value, 'string', `Expected ISSUE_CODES.${key} to be a string`);
      assert.ok(value.length > 0, `Expected ISSUE_CODES.${key} to be non-empty`);
    }
  });

  await test('all expected ISSUE_CODES are present', async () => {
    const expected = [
      'INVALID_INPUT',
      'MISSING_REQUIRED_FIELD',
      'MISSING_SESSION_START',
      'MISSING_SESSION_END',
      'INCONSISTENT_SESSION_CORRELATION',
      'APPROVAL_WITHOUT_INVOCATION',
      'MISSING_APPROVAL_EVIDENCE',
    ];
    for (const key of expected) {
      assert.ok(key in ISSUE_CODES, `Expected ISSUE_CODES.${key} to exist`);
    }
  });

  await test('secret.retrieval is treated as session-activity (triggers missing_session_start)', async () => {
    const events = [
      evt({ event_id: 'evt-001', event_type: 'secret.retrieval', action: 'keeper-commander', metadata: { secret_identifier: 'some/secret', retrieval_mechanism: 'keeper-commander', retrieval_mode: 'non-interactive', environment_context: 'service' } }),
    ];
    const result = validate(events);
    const codes = result.issues.map(i => i.code);
    assert.ok(codes.includes(ISSUE_CODES.MISSING_SESSION_START));
  });

  // ── 8. Individual rule exports ────────────────────────────────────────────

  console.log('\n8. Individual rule exports — callable and return correct shape');

  await test('checkRequiredFields returns { issues, warnings }', async () => {
    const result = checkRequiredFields([evt()]);
    assert.ok(Array.isArray(result.issues));
    assert.ok(Array.isArray(result.warnings));
  });

  await test('checkSessionCoverage returns { issues, warnings }', async () => {
    const result = checkSessionCoverage([]);
    assert.ok(Array.isArray(result.issues));
    assert.ok(Array.isArray(result.warnings));
  });

  await test('checkCorrelationConsistency returns { issues, warnings }', async () => {
    const result = checkCorrelationConsistency([]);
    assert.ok(Array.isArray(result.issues));
    assert.ok(Array.isArray(result.warnings));
  });

  await test('checkApprovalPathCompleteness returns { issues, warnings }', async () => {
    const result = checkApprovalPathCompleteness([]);
    assert.ok(Array.isArray(result.issues));
    assert.ok(Array.isArray(result.warnings));
  });

  await test('checkApprovalEvidenceForInvocations returns { issues, warnings }', async () => {
    const result = checkApprovalEvidenceForInvocations([]);
    assert.ok(Array.isArray(result.issues));
    assert.ok(Array.isArray(result.warnings));
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
