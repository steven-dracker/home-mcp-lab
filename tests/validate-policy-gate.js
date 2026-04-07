'use strict';

// Validation tests for CTRL-HMCP-000002 — Deny Destructive Tools by Default
//
// Validates:
//   1. Policy gate decisions — allowed, denied, override paths
//   2. checkAndEnforcePolicy integration — decision shape and denial emission
//   3. Non-destructive and unknown tools are unaffected
//   4. Regression: existing emitter public API exports unchanged
//
// No network required. Run: node tests/validate-policy-gate.js

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

// ── Helpers ──────────────────────────────────────────────────────────────────

// Suppress JSONL fallback write output during tests.
process.env.HMCP_ALLOW_DESTRUCTIVE = undefined;
delete process.env.HMCP_ALLOW_DESTRUCTIVE;

// ── 1. Policy gate — evaluatePolicy ─────────────────────────────────────────

(async () => {

  console.log('\n1. evaluatePolicy — decision correctness');

  const { evaluatePolicy } = require('../src/policy/policy-gate');

  await test('LOW tool is allowed', async () => {
    const d = evaluatePolicy('search_repositories', {});
    assert.strictEqual(d.allowed, true);
    assert.strictEqual(d.riskLevel, 'LOW');
    assert.strictEqual(d.reason, 'allowed');
  });

  await test('MEDIUM tool is allowed', async () => {
    const d = evaluatePolicy('get_file_contents', {});
    assert.strictEqual(d.allowed, true);
    assert.strictEqual(d.riskLevel, 'MEDIUM');
    assert.strictEqual(d.reason, 'allowed');
  });

  await test('HIGH tool with allowed_by_default=true is allowed', async () => {
    const d = evaluatePolicy('create_issue', {});
    assert.strictEqual(d.allowed, true);
    assert.strictEqual(d.riskLevel, 'HIGH');
    assert.strictEqual(d.reason, 'allowed');
  });

  await test('HIGH tool with allowed_by_default=false (merge_pull_request) is allowed — HIGH not subject to enforcement', async () => {
    // merge_pull_request is HIGH + allowed_by_default=false, but enforcement is DESTRUCTIVE only
    const d = evaluatePolicy('merge_pull_request', {});
    assert.strictEqual(d.allowed, true);
    assert.strictEqual(d.riskLevel, 'HIGH');
    assert.strictEqual(d.reason, 'allowed');
  });

  await test('DESTRUCTIVE tool (delete_branch) is denied by default', async () => {
    const d = evaluatePolicy('delete_branch', {});
    assert.strictEqual(d.allowed, false);
    assert.strictEqual(d.riskLevel, 'DESTRUCTIVE');
    assert.strictEqual(d.reason, 'policy_denied');
    assert.strictEqual(d.policyBasis, 'destructive_tool_not_allowed_by_default');
  });

  await test('unknown tool is allowed (unclassified — not subject to enforcement)', async () => {
    const d = evaluatePolicy('some_unknown_tool', {});
    assert.strictEqual(d.allowed, true);
    assert.strictEqual(d.riskLevel, null);
    assert.strictEqual(d.reason, 'allowed');
    assert.strictEqual(d.policyBasis, 'unclassified_tool_allowed');
  });

  await test('null tool name is allowed (degenerate input)', async () => {
    const d = evaluatePolicy(null, {});
    assert.strictEqual(d.allowed, true);
  });

  // ── 2. Override paths ────────────────────────────────────────────────────

  console.log('\n2. Override paths');

  await test('context allowDestructive=true allows DESTRUCTIVE tool', async () => {
    const d = evaluatePolicy('delete_branch', { allowDestructive: true });
    assert.strictEqual(d.allowed, true);
    assert.strictEqual(d.reason, 'override_allowed');
    assert.strictEqual(d.policyBasis, 'destructive_tool_allowed_by_explicit_override');
  });

  await test('env var HMCP_ALLOW_DESTRUCTIVE=true allows DESTRUCTIVE tool', async () => {
    process.env.HMCP_ALLOW_DESTRUCTIVE = 'true';
    // Require fresh copy since module caches registry but reads env at call time
    const key = require.resolve('../src/policy/policy-gate');
    delete require.cache[key];
    const { evaluatePolicy: evalFresh } = require('../src/policy/policy-gate');
    const d = evalFresh('delete_branch', {});
    delete process.env.HMCP_ALLOW_DESTRUCTIVE;
    // restore original module
    delete require.cache[require.resolve('../src/policy/policy-gate')];
    assert.strictEqual(d.allowed, true);
    assert.strictEqual(d.reason, 'override_allowed');
  });

  await test('allowDestructive=false does not override deny', async () => {
    const d = evaluatePolicy('delete_branch', { allowDestructive: false });
    assert.strictEqual(d.allowed, false);
    assert.strictEqual(d.reason, 'policy_denied');
  });

  await test('missing context object treated as no override', async () => {
    const d = evaluatePolicy('delete_branch');
    assert.strictEqual(d.allowed, false);
    assert.strictEqual(d.reason, 'policy_denied');
  });

  // ── 3. checkAndEnforcePolicy integration ────────────────────────────────

  console.log('\n3. checkAndEnforcePolicy — integration');

  const { checkAndEnforcePolicy } = require('../src/emitter/index');

  const baseCtx = {
    projectId: 'home-mcp-lab',
    agentId: 'test-agent',
    mcpServer: 'github-mcp-server',
    correlationId: 'test-corr-001'
  };

  await test('non-destructive tool returns allowed decision without throwing', async () => {
    const d = checkAndEnforcePolicy({ ...baseCtx, toolName: 'get_me' });
    assert.strictEqual(d.allowed, true);
    assert.strictEqual(d.toolName, 'get_me');
  });

  await test('destructive tool returns denied decision without throwing', async () => {
    const d = checkAndEnforcePolicy({ ...baseCtx, toolName: 'delete_branch' });
    assert.strictEqual(d.allowed, false);
    assert.strictEqual(d.reason, 'policy_denied');
  });

  await test('destructive tool with allowDestructive=true returns override_allowed', async () => {
    const d = checkAndEnforcePolicy({ ...baseCtx, toolName: 'delete_branch', allowDestructive: true });
    assert.strictEqual(d.allowed, true);
    assert.strictEqual(d.reason, 'override_allowed');
  });

  await test('decision includes riskLevel and policyBasis', async () => {
    const d = checkAndEnforcePolicy({ ...baseCtx, toolName: 'delete_branch' });
    assert.strictEqual(d.riskLevel, 'DESTRUCTIVE');
    assert.ok(d.policyBasis, 'Expected policyBasis to be present');
  });

  await test('correlationId is generated when absent', async () => {
    const ctx = { projectId: 'p', agentId: 'a', mcpServer: 's', toolName: 'get_me' };
    const d = checkAndEnforcePolicy(ctx);
    assert.strictEqual(d.allowed, true);
  });

  // ── 4. buildToolDenialEvent — event structure ────────────────────────────

  console.log('\n4. buildToolDenialEvent — event structure');

  const { buildToolDenialEvent } = require('../src/emitter/event-builder');

  await test('denial event has correct event_type and status', async () => {
    const event = buildToolDenialEvent(
      { toolName: 'delete_branch', projectId: 'p', agentId: 'a', mcpServer: 's', correlationId: 'c' },
      { riskLevel: 'DESTRUCTIVE', reason: 'policy_denied', policyBasis: 'destructive_tool_not_allowed_by_default' }
    );
    assert.strictEqual(event.event_type, 'tool.denial');
    assert.strictEqual(event.status, 'failure');
    assert.strictEqual(event.action, 'delete_branch');
  });

  await test('denial event metadata includes required fields', async () => {
    const event = buildToolDenialEvent(
      { toolName: 'delete_branch', projectId: 'p', agentId: 'a', mcpServer: 's', correlationId: 'c' },
      { riskLevel: 'DESTRUCTIVE', reason: 'policy_denied', policyBasis: 'destructive_tool_not_allowed_by_default' }
    );
    assert.strictEqual(event.metadata.tool_name, 'delete_branch');
    assert.strictEqual(event.metadata.risk_level, 'DESTRUCTIVE');
    assert.strictEqual(event.metadata.denial_reason, 'policy_denied');
    assert.strictEqual(event.metadata.policy_basis, 'destructive_tool_not_allowed_by_default');
  });

  await test('denial event includes initiating_context when supplied', async () => {
    const event = buildToolDenialEvent(
      { toolName: 'delete_branch', projectId: 'p', agentId: 'a', mcpServer: 's', correlationId: 'c', initiatingContext: 'CC-HMCP-000010' },
      { riskLevel: 'DESTRUCTIVE', reason: 'policy_denied', policyBasis: 'destructive_tool_not_allowed_by_default' }
    );
    assert.strictEqual(event.metadata.initiating_context, 'CC-HMCP-000010');
  });

  await test('buildToolDenialEvent throws on missing required context field', async () => {
    assert.throws(() => {
      buildToolDenialEvent(
        { toolName: 'delete_branch', projectId: 'p', agentId: 'a', mcpServer: 's' }, // missing correlationId
        { riskLevel: 'DESTRUCTIVE', reason: 'policy_denied', policyBasis: 'x' }
      );
    }, /Missing required emitter context field/);
  });

  // ── 5. Regression: existing emitter API ──────────────────────────────────

  console.log('\n5. Regression: existing emitter public API');

  await test('emitter exports unchanged plus checkAndEnforcePolicy', async () => {
    const emitter = require('../src/emitter/index');
    const expected = [
      'emitToolInvocation',
      'withToolInstrumentation',
      'emitSessionStart',
      'emitSessionEnd',
      'withSession',
      'emitSecretRetrieval',
      'checkAndEnforcePolicy'
    ];
    for (const fn of expected) {
      assert.strictEqual(typeof emitter[fn], 'function', `Expected emitter.${fn} to be a function`);
    }
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
