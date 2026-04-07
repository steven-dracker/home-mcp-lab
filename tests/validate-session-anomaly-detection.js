'use strict';

// Validation tests for TD-HMCP-000001 — Session Anomaly Detection
//
// Validates:
//   1. Normal session traces are not flagged as anomalous
//   2. Repeated denials beyond threshold trigger repeated_policy_denials
//   3. Approval without follow-through triggers approval_without_followthrough
//   4. Denial + invocation with no approval triggers conflicting_control_outcomes
//   5. Control-heavy sessions trigger control_event_heavy_session
//   6. Excessive tool activity triggers excessive_tool_activity
//   7. Threshold boundaries (at/above/below) are correct
//   8. Malformed inputs handled cleanly
//   9. Individual rule exports return correct shape
//  10. Regression: prior validators unaffected
//
// No network required. Run: node tests/validate-session-anomaly-detection.js

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

function sessionStart()   { return evt({ event_type: 'session.start', action: 'mcp_session_init', metadata: {} }); }
function sessionEnd()     { return evt({ event_type: 'session.end',   action: 'mcp_session_close', metadata: {} }); }
function invocation(tool) { return evt({ event_type: 'tool.invocation', action: tool, metadata: { tool_name: tool } }); }
function denial(tool)     { return evt({ event_type: 'tool.denial',     action: tool, status: 'failure', metadata: { tool_name: tool } }); }
function approval(tool)   { return evt({ event_type: 'tool.approval_granted', action: tool, metadata: { tool_name: tool } }); }

// Normal happy-path session.
function normalSession() {
  return [sessionStart(), invocation('get_me'), invocation('list_issues'), sessionEnd()];
}

// Normal approval-path session (denial → approval → invocation).
function approvalPathSession() {
  return [sessionStart(), denial('merge_pull_request'), approval('merge_pull_request'), invocation('merge_pull_request'), sessionEnd()];
}

// Normal denial-only session (one denial, no invocation of that tool).
function singleDenialSession() {
  return [sessionStart(), denial('delete_branch'), sessionEnd()];
}

// ── Load detector ─────────────────────────────────────────────────────────────

const {
  detect,
  FINDING_CODES,
  THRESHOLDS,
  checkRepeatedDenials,
  checkApprovalWithoutFollowthrough,
  checkConflictingControlOutcomes,
  checkControlEventHeavySession,
  checkExcessiveToolActivity,
} = require('../src/detection/session-anomaly-detector');

// ── 1. Non-anomalous traces ───────────────────────────────────────────────────

(async () => {

  console.log('\n1. Non-anomalous traces — not flagged');

  await test('normal happy-path session is not anomalous', async () => {
    const result = detect(normalSession());
    assert.strictEqual(result.anomalous, false, `Unexpected findings: ${JSON.stringify(result.findings)}`);
    assert.strictEqual(result.findings.length, 0);
  });

  await test('approval-path session (denial → approval → invocation) is not anomalous', async () => {
    const result = detect(approvalPathSession());
    assert.strictEqual(result.anomalous, false, `Unexpected findings: ${JSON.stringify(result.findings)}`);
  });

  await test('single denial session is not anomalous (below threshold)', async () => {
    const result = detect(singleDenialSession());
    assert.strictEqual(result.anomalous, false, `Unexpected findings: ${JSON.stringify(result.findings)}`);
  });

  await test('empty trace is not anomalous', async () => {
    const result = detect([]);
    assert.strictEqual(result.anomalous, false);
    assert.strictEqual(result.findings.length, 0);
  });

  await test('result always has anomalous, findings, and warnings fields', async () => {
    const result = detect([]);
    assert.ok('anomalous' in result);
    assert.ok(Array.isArray(result.findings));
    assert.ok(Array.isArray(result.warnings));
  });

  // ── 2. Rule 1 — Repeated denials ────────────────────────────────────────

  console.log('\n2. Rule 1 — repeated_policy_denials');

  await test(`${THRESHOLDS.REPEATED_DENIALS} denials triggers repeated_policy_denials`, async () => {
    const events = [
      sessionStart(),
      ...Array.from({ length: THRESHOLDS.REPEATED_DENIALS }, () => denial('delete_branch')),
      sessionEnd(),
    ];
    const result = detect(events);
    assert.strictEqual(result.anomalous, true);
    const finding = result.findings.find(f => f.code === FINDING_CODES.REPEATED_POLICY_DENIALS);
    assert.ok(finding, 'Expected repeated_policy_denials finding');
    assert.strictEqual(finding.context.denial_count, THRESHOLDS.REPEATED_DENIALS);
    assert.strictEqual(finding.context.threshold,    THRESHOLDS.REPEATED_DENIALS);
  });

  await test('denial count exceeding threshold includes denied_tools list', async () => {
    const events = [
      denial('delete_branch'),
      denial('delete_branch'),
      denial('merge_pull_request'),
    ];
    const result = detect(events);
    const finding = result.findings.find(f => f.code === FINDING_CODES.REPEATED_POLICY_DENIALS);
    assert.ok(finding);
    assert.ok(Array.isArray(finding.context.denied_tools));
    assert.ok(finding.context.denied_tools.includes('delete_branch'));
    assert.ok(finding.context.denied_tools.includes('merge_pull_request'));
  });

  await test(`${THRESHOLDS.REPEATED_DENIALS - 1} denials does not trigger repeated_policy_denials`, async () => {
    const events = Array.from({ length: THRESHOLDS.REPEATED_DENIALS - 1 }, () => denial('delete_branch'));
    const result = detect(events);
    const finding = result.findings.find(f => f.code === FINDING_CODES.REPEATED_POLICY_DENIALS);
    assert.strictEqual(finding, undefined);
  });

  await test('more denials than threshold also triggers the finding', async () => {
    const events = Array.from({ length: THRESHOLDS.REPEATED_DENIALS + 2 }, () => denial('delete_branch'));
    const result = detect(events);
    const finding = result.findings.find(f => f.code === FINDING_CODES.REPEATED_POLICY_DENIALS);
    assert.ok(finding);
    assert.strictEqual(finding.context.denial_count, THRESHOLDS.REPEATED_DENIALS + 2);
  });

  // ── 3. Rule 2 — Approval without follow-through ──────────────────────────

  console.log('\n3. Rule 2 — approval_without_followthrough');

  await test('approval_granted with no matching invocation is flagged', async () => {
    const events = [sessionStart(), approval('merge_pull_request'), sessionEnd()];
    const result = detect(events);
    assert.strictEqual(result.anomalous, true);
    const finding = result.findings.find(f => f.code === FINDING_CODES.APPROVAL_WITHOUT_FOLLOWTHROUGH);
    assert.ok(finding, 'Expected approval_without_followthrough finding');
    assert.strictEqual(finding.context.tool_name, 'merge_pull_request');
  });

  await test('approval_granted followed by matching invocation is not flagged', async () => {
    const result = detect(approvalPathSession());
    const finding = result.findings.find(f => f.code === FINDING_CODES.APPROVAL_WITHOUT_FOLLOWTHROUGH);
    assert.strictEqual(finding, undefined);
  });

  await test('approval and invocation for different tools flags approval_without_followthrough', async () => {
    // approval for tool A, invocation for tool B — not a match
    const events = [
      approval('merge_pull_request'),
      invocation('create_issue'),
    ];
    const result = detect(events);
    const finding = result.findings.find(f => f.code === FINDING_CODES.APPROVAL_WITHOUT_FOLLOWTHROUGH);
    assert.ok(finding, 'Expected approval_without_followthrough when tools differ');
    assert.strictEqual(finding.context.tool_name, 'merge_pull_request');
  });

  await test('approval and invocation for same tool but different correlation_ids is flagged', async () => {
    const events = [
      evt({ event_type: 'tool.approval_granted', action: 'merge_pull_request', correlation_id: 'sess-aaa', metadata: { tool_name: 'merge_pull_request' } }),
      evt({ event_type: 'tool.invocation',       action: 'merge_pull_request', correlation_id: 'sess-bbb', metadata: { tool_name: 'merge_pull_request' } }),
    ];
    const result = detect(events);
    const finding = result.findings.find(f => f.code === FINDING_CODES.APPROVAL_WITHOUT_FOLLOWTHROUGH);
    assert.ok(finding, 'Expected approval_without_followthrough when correlation_ids differ');
  });

  // ── 4. Rule 3 — Conflicting control outcomes ─────────────────────────────

  console.log('\n4. Rule 3 — conflicting_control_outcomes');

  await test('denial + invocation for same tool with no approval is flagged', async () => {
    const events = [
      sessionStart(),
      denial('delete_branch'),
      invocation('delete_branch'),
      sessionEnd(),
    ];
    const result = detect(events);
    assert.strictEqual(result.anomalous, true);
    const finding = result.findings.find(f => f.code === FINDING_CODES.CONFLICTING_CONTROL_OUTCOMES);
    assert.ok(finding, 'Expected conflicting_control_outcomes finding');
    assert.strictEqual(finding.context.tool_name, 'delete_branch');
    assert.ok(finding.context.denial_event_id,     'Expected denial_event_id in context');
    assert.ok(finding.context.invocation_event_id, 'Expected invocation_event_id in context');
  });

  await test('denial + approval + invocation for same tool is NOT flagged (normal approval flow)', async () => {
    const result = detect(approvalPathSession());
    const finding = result.findings.find(f => f.code === FINDING_CODES.CONFLICTING_CONTROL_OUTCOMES);
    assert.strictEqual(finding, undefined);
  });

  await test('denial for tool A + invocation for tool B is not flagged (different tools)', async () => {
    const events = [
      denial('delete_branch'),
      invocation('get_me'),
    ];
    const result = detect(events);
    const finding = result.findings.find(f => f.code === FINDING_CODES.CONFLICTING_CONTROL_OUTCOMES);
    assert.strictEqual(finding, undefined);
  });

  await test('denial only (no invocation) is not flagged as conflicting', async () => {
    const result = detect(singleDenialSession());
    const finding = result.findings.find(f => f.code === FINDING_CODES.CONFLICTING_CONTROL_OUTCOMES);
    assert.strictEqual(finding, undefined);
  });

  // ── 5. Rule 4 — Control-event-heavy session ──────────────────────────────

  console.log('\n5. Rule 4 — control_event_heavy_session');

  await test(`${THRESHOLDS.CONTROL_HEAVY_MIN} denials and 0 invocations triggers control_event_heavy_session`, async () => {
    const events = Array.from({ length: THRESHOLDS.CONTROL_HEAVY_MIN }, () => denial('delete_branch'));
    const result = detect(events);
    const finding = result.findings.find(f => f.code === FINDING_CODES.CONTROL_EVENT_HEAVY_SESSION);
    assert.ok(finding, 'Expected control_event_heavy_session finding');
    assert.strictEqual(finding.context.control_count,    THRESHOLDS.CONTROL_HEAVY_MIN);
    assert.strictEqual(finding.context.invocation_count, 0);
  });

  await test('control count just at margin (control = invocations + margin) does NOT trigger', async () => {
    // control_count must be STRICTLY GREATER than invocations + margin
    // With margin=2: 1 invocation → need control > 3; control=3 → 3 > 3 is false → not triggered
    const events = [
      invocation('get_me'),
      denial('delete_branch'),
      denial('delete_branch'),
      denial('delete_branch'), // control=3, invocations=1; 3 > 1+2=3? No → not triggered
    ];
    const result = detect(events);
    const finding = result.findings.find(f => f.code === FINDING_CODES.CONTROL_EVENT_HEAVY_SESSION);
    assert.strictEqual(finding, undefined, 'Should not trigger when control == invocations + margin');
  });

  await test('control count exceeding margin triggers control_event_heavy_session', async () => {
    // 4 denials, 1 invocation: 4 > 1+2=3 → triggered (and 4 >= 3 min)
    const events = [
      invocation('get_me'),
      denial('delete_branch'),
      denial('delete_branch'),
      denial('delete_branch'),
      denial('delete_branch'),
    ];
    const result = detect(events);
    const finding = result.findings.find(f => f.code === FINDING_CODES.CONTROL_EVENT_HEAVY_SESSION);
    assert.ok(finding, 'Expected control_event_heavy_session finding');
  });

  await test('2 denials and 0 invocations does NOT trigger (below CONTROL_HEAVY_MIN)', async () => {
    const events = [denial('delete_branch'), denial('delete_branch')];
    const result = detect(events);
    const finding = result.findings.find(f => f.code === FINDING_CODES.CONTROL_EVENT_HEAVY_SESSION);
    assert.strictEqual(finding, undefined, 'Should not trigger below CONTROL_HEAVY_MIN');
  });

  await test('approvals count toward control-heavy check', async () => {
    // 2 approvals + 1 denial = 3 control events, 0 invocations → triggered
    const events = [
      approval('merge_pull_request'),
      approval('merge_pull_request'),
      denial('delete_branch'),
    ];
    const result = detect(events);
    const finding = result.findings.find(f => f.code === FINDING_CODES.CONTROL_EVENT_HEAVY_SESSION);
    assert.ok(finding, 'Approvals should count toward control_event_heavy_session');
    assert.strictEqual(finding.context.approval_count, 2);
    assert.strictEqual(finding.context.denial_count,   1);
  });

  // ── 6. Rule 5 — Excessive tool activity ──────────────────────────────────

  console.log('\n6. Rule 5 — excessive_tool_activity');

  await test(`${THRESHOLDS.EXCESSIVE_TOOL_ACTIVITY + 1} tool events triggers excessive_tool_activity`, async () => {
    const events = Array.from(
      { length: THRESHOLDS.EXCESSIVE_TOOL_ACTIVITY + 1 },
      () => invocation('get_me')
    );
    const result = detect(events);
    const finding = result.findings.find(f => f.code === FINDING_CODES.EXCESSIVE_TOOL_ACTIVITY);
    assert.ok(finding, 'Expected excessive_tool_activity finding');
    assert.strictEqual(finding.context.tool_event_count, THRESHOLDS.EXCESSIVE_TOOL_ACTIVITY + 1);
    assert.strictEqual(finding.context.threshold,        THRESHOLDS.EXCESSIVE_TOOL_ACTIVITY);
  });

  await test(`exactly ${THRESHOLDS.EXCESSIVE_TOOL_ACTIVITY} tool events does NOT trigger (threshold is exclusive)`, async () => {
    const events = Array.from(
      { length: THRESHOLDS.EXCESSIVE_TOOL_ACTIVITY },
      () => invocation('get_me')
    );
    const result = detect(events);
    const finding = result.findings.find(f => f.code === FINDING_CODES.EXCESSIVE_TOOL_ACTIVITY);
    assert.strictEqual(finding, undefined, 'Should not trigger at exactly the threshold');
  });

  await test('denials and approvals count toward excessive tool activity', async () => {
    // Mix of invocations, denials, approvals
    const events = [
      ...Array.from({ length: 20 }, () => invocation('get_me')),
      ...Array.from({ length: 16 }, () => denial('delete_branch')),
      ...Array.from({ length: 15 }, () => approval('merge_pull_request')),
      // total: 51
    ];
    const result = detect(events);
    const finding = result.findings.find(f => f.code === FINDING_CODES.EXCESSIVE_TOOL_ACTIVITY);
    assert.ok(finding, 'Expected excessive_tool_activity for mixed tool events');
    assert.strictEqual(finding.context.tool_event_count, 51);
  });

  await test('session events (start/end) do NOT count toward excessive tool activity', async () => {
    // 50 invocations + session.start + session.end = 52 total events, 50 tool events → not triggered
    const events = [
      sessionStart(),
      ...Array.from({ length: THRESHOLDS.EXCESSIVE_TOOL_ACTIVITY }, () => invocation('get_me')),
      sessionEnd(),
    ];
    const result = detect(events);
    const finding = result.findings.find(f => f.code === FINDING_CODES.EXCESSIVE_TOOL_ACTIVITY);
    assert.strictEqual(finding, undefined, 'session.start/end should not count as tool events');
  });

  // ── 7. Edge cases ─────────────────────────────────────────────────────────

  console.log('\n7. Edge cases');

  await test('non-array input returns anomalous:true with invalid_input finding', async () => {
    const result = detect('not-an-array');
    assert.strictEqual(result.anomalous, true);
    assert.ok(result.findings.some(f => f.code === FINDING_CODES.INVALID_INPUT));
  });

  await test('null input returns anomalous:true with invalid_input finding', async () => {
    const result = detect(null);
    assert.strictEqual(result.anomalous, true);
    assert.ok(result.findings.some(f => f.code === FINDING_CODES.INVALID_INPUT));
  });

  await test('FINDING_CODES are all non-empty strings', async () => {
    for (const [key, value] of Object.entries(FINDING_CODES)) {
      assert.strictEqual(typeof value, 'string', `Expected FINDING_CODES.${key} to be a string`);
      assert.ok(value.length > 0, `Expected FINDING_CODES.${key} to be non-empty`);
    }
  });

  await test('all expected FINDING_CODES are present', async () => {
    const expected = [
      'INVALID_INPUT',
      'REPEATED_POLICY_DENIALS',
      'APPROVAL_WITHOUT_FOLLOWTHROUGH',
      'CONFLICTING_CONTROL_OUTCOMES',
      'CONTROL_EVENT_HEAVY_SESSION',
      'EXCESSIVE_TOOL_ACTIVITY',
    ];
    for (const key of expected) {
      assert.ok(key in FINDING_CODES, `Expected FINDING_CODES.${key} to exist`);
    }
  });

  await test('THRESHOLDS are all positive numbers', async () => {
    for (const [key, value] of Object.entries(THRESHOLDS)) {
      assert.strictEqual(typeof value, 'number', `Expected THRESHOLDS.${key} to be a number`);
      assert.ok(value > 0, `Expected THRESHOLDS.${key} to be positive`);
    }
  });

  await test('multiple rules can fire in the same trace', async () => {
    // 3 denials (repeated_policy_denials) + 0 invocations (control_event_heavy_session)
    const events = Array.from({ length: THRESHOLDS.REPEATED_DENIALS }, () => denial('delete_branch'));
    const result = detect(events);
    assert.strictEqual(result.anomalous, true);
    const codes = result.findings.map(f => f.code);
    assert.ok(codes.includes(FINDING_CODES.REPEATED_POLICY_DENIALS));
    assert.ok(codes.includes(FINDING_CODES.CONTROL_EVENT_HEAVY_SESSION));
  });

  // ── 8. Individual rule exports ────────────────────────────────────────────

  console.log('\n8. Individual rule exports — callable and return correct shape');

  await test('checkRepeatedDenials returns { findings, warnings }', async () => {
    const result = checkRepeatedDenials([]);
    assert.ok(Array.isArray(result.findings));
    assert.ok(Array.isArray(result.warnings));
  });

  await test('checkApprovalWithoutFollowthrough returns { findings, warnings }', async () => {
    const result = checkApprovalWithoutFollowthrough([]);
    assert.ok(Array.isArray(result.findings));
    assert.ok(Array.isArray(result.warnings));
  });

  await test('checkConflictingControlOutcomes returns { findings, warnings }', async () => {
    const result = checkConflictingControlOutcomes([]);
    assert.ok(Array.isArray(result.findings));
    assert.ok(Array.isArray(result.warnings));
  });

  await test('checkControlEventHeavySession returns { findings, warnings }', async () => {
    const result = checkControlEventHeavySession([]);
    assert.ok(Array.isArray(result.findings));
    assert.ok(Array.isArray(result.warnings));
  });

  await test('checkExcessiveToolActivity returns { findings, warnings }', async () => {
    const result = checkExcessiveToolActivity([]);
    assert.ok(Array.isArray(result.findings));
    assert.ok(Array.isArray(result.warnings));
  });

  // ── 9. Regression: prior validators unaffected ───────────────────────────

  console.log('\n9. Regression — prior validators unaffected');

  await test('completeness validator still works correctly', async () => {
    const { validate: validateCompleteness } = require('../src/detection/event-completeness-validator');
    const result = validateCompleteness([]);
    assert.strictEqual(result.complete, true);
    assert.ok(Array.isArray(result.issues));
  });

  await test('correlation integrity validator still works correctly', async () => {
    const { validate: validateIntegrity } = require('../src/detection/correlation-integrity-validator');
    const result = validateIntegrity([]);
    assert.strictEqual(result.valid, true);
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
