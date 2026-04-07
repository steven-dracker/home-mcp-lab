'use strict';

// Validation tests for CTRL-HMCP-000003 — Approval-Required Tool Execution
//
// Validates:
//   1. evaluatePolicy — approval-required decisions for HIGH tier-2 tools
//   2. evaluatePolicy — approval satisfaction paths (context flag, env var)
//   3. evaluatePolicy — tier-1 DESTRUCTIVE behavior unchanged
//   4. checkAndEnforcePolicy — integration; audit events for all enforcement outcomes
//   5. buildToolApprovalGrantedEvent — event structure
//   6. Regression: tier-1 (CTRL-HMCP-000002) behavior unaffected
//
// No network required. Run: node tests/validate-approval-gate.js

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

// ── Setup ─────────────────────────────────────────────────────────────────────

// Ensure no approval or destructive env vars are set at start.
delete process.env.HMCP_APPROVAL_GRANTED;
delete process.env.HMCP_ALLOW_DESTRUCTIVE;

// ── 1. Tier-2 approval-required decisions ─────────────────────────────────────

(async () => {

  console.log('\n1. evaluatePolicy — HIGH tier-2 approval-required decisions');

  const { evaluatePolicy } = require('../src/policy/policy-gate');

  await test('HIGH + allowed_by_default=false blocked without approval (requires_approval)', async () => {
    const d = evaluatePolicy('merge_pull_request', {});
    assert.strictEqual(d.allowed, false);
    assert.strictEqual(d.riskLevel, 'HIGH');
    assert.strictEqual(d.reason, 'requires_approval');
    assert.strictEqual(d.policyBasis, 'high_risk_tool_requires_approval');
    assert.strictEqual(d.approvalRequired, true);
    assert.strictEqual(d.approvalSatisfied, false);
    assert.strictEqual(d.approvalMechanism, null);
  });

  await test('HIGH + allowed_by_default=true is allowed normally (no tier-2 enforcement)', async () => {
    // create_issue is HIGH + allowed_by_default=true — no approval required
    const d = evaluatePolicy('create_issue', {});
    assert.strictEqual(d.allowed, true);
    assert.strictEqual(d.riskLevel, 'HIGH');
    assert.strictEqual(d.reason, 'allowed');
    assert.strictEqual(d.approvalRequired, undefined);
  });

  // ── 2. Approval satisfaction paths ────────────────────────────────────────

  console.log('\n2. evaluatePolicy — approval satisfaction paths');

  await test('context approvalGranted=true satisfies approval (approved via context_flag)', async () => {
    const d = evaluatePolicy('merge_pull_request', { approvalGranted: true });
    assert.strictEqual(d.allowed, true);
    assert.strictEqual(d.riskLevel, 'HIGH');
    assert.strictEqual(d.reason, 'approved');
    assert.strictEqual(d.policyBasis, 'high_risk_tool_allowed_by_explicit_approval');
    assert.strictEqual(d.approvalRequired, true);
    assert.strictEqual(d.approvalSatisfied, true);
    assert.strictEqual(d.approvalMechanism, 'context_flag');
  });

  await test('env var HMCP_APPROVAL_GRANTED=true satisfies approval (approved via env_var)', async () => {
    process.env.HMCP_APPROVAL_GRANTED = 'true';
    const key = require.resolve('../src/policy/policy-gate');
    delete require.cache[key];
    const { evaluatePolicy: evalFresh } = require('../src/policy/policy-gate');
    const d = evalFresh('merge_pull_request', {});
    delete process.env.HMCP_APPROVAL_GRANTED;
    delete require.cache[require.resolve('../src/policy/policy-gate')];
    assert.strictEqual(d.allowed, true);
    assert.strictEqual(d.reason, 'approved');
    assert.strictEqual(d.approvalMechanism, 'env_var');
  });

  await test('approvalGranted=false does not satisfy approval', async () => {
    const d = evaluatePolicy('merge_pull_request', { approvalGranted: false });
    assert.strictEqual(d.allowed, false);
    assert.strictEqual(d.reason, 'requires_approval');
  });

  await test('approvalGranted=true does not affect DESTRUCTIVE tool (tiers are independent)', async () => {
    // approvalGranted=true should not allow a DESTRUCTIVE tool — that requires allowDestructive
    const d = evaluatePolicy('delete_branch', { approvalGranted: true });
    assert.strictEqual(d.allowed, false);
    assert.strictEqual(d.reason, 'policy_denied');
  });

  await test('allowDestructive=true does not satisfy HIGH approval requirement', async () => {
    // allowDestructive applies only to tier-1; HIGH tier-2 requires approvalGranted
    const d = evaluatePolicy('merge_pull_request', { allowDestructive: true });
    assert.strictEqual(d.allowed, false);
    assert.strictEqual(d.reason, 'requires_approval');
  });

  // ── 3. Tier-1 DESTRUCTIVE behavior unchanged ──────────────────────────────

  console.log('\n3. evaluatePolicy — tier-1 DESTRUCTIVE behavior unchanged (CTRL-HMCP-000002 regression)');

  await test('DESTRUCTIVE tool denied by default', async () => {
    const d = evaluatePolicy('delete_branch', {});
    assert.strictEqual(d.allowed, false);
    assert.strictEqual(d.reason, 'policy_denied');
    assert.strictEqual(d.policyBasis, 'destructive_tool_not_allowed_by_default');
    assert.strictEqual(d.approvalRequired, undefined);
  });

  await test('DESTRUCTIVE tool allowed with allowDestructive=true (override_allowed)', async () => {
    const d = evaluatePolicy('delete_branch', { allowDestructive: true });
    assert.strictEqual(d.allowed, true);
    assert.strictEqual(d.reason, 'override_allowed');
  });

  await test('LOW tool unaffected', async () => {
    const d = evaluatePolicy('get_me', {});
    assert.strictEqual(d.allowed, true);
    assert.strictEqual(d.reason, 'allowed');
    assert.strictEqual(d.approvalRequired, undefined);
  });

  await test('unknown tool unaffected', async () => {
    const d = evaluatePolicy('some_unregistered_tool', {});
    assert.strictEqual(d.allowed, true);
    assert.strictEqual(d.reason, 'allowed');
    assert.strictEqual(d.policyBasis, 'unclassified_tool_allowed');
  });

  // ── 4. checkAndEnforcePolicy integration ──────────────────────────────────

  console.log('\n4. checkAndEnforcePolicy — integration');

  const { checkAndEnforcePolicy } = require('../src/emitter/index');

  const baseCtx = {
    projectId: 'home-mcp-lab',
    agentId: 'test-agent',
    mcpServer: 'github-mcp-server',
    correlationId: 'test-corr-approval-001'
  };

  await test('LOW tool returns allowed without throwing', async () => {
    const d = checkAndEnforcePolicy({ ...baseCtx, toolName: 'get_me' });
    assert.strictEqual(d.allowed, true);
    assert.strictEqual(d.reason, 'allowed');
  });

  await test('HIGH approval-required tool returns requires_approval decision', async () => {
    const d = checkAndEnforcePolicy({ ...baseCtx, toolName: 'merge_pull_request' });
    assert.strictEqual(d.allowed, false);
    assert.strictEqual(d.reason, 'requires_approval');
    assert.strictEqual(d.approvalRequired, true);
    assert.strictEqual(d.approvalSatisfied, false);
  });

  await test('HIGH approval-required tool with approvalGranted=true returns approved', async () => {
    const d = checkAndEnforcePolicy({ ...baseCtx, toolName: 'merge_pull_request', approvalGranted: true });
    assert.strictEqual(d.allowed, true);
    assert.strictEqual(d.reason, 'approved');
    assert.strictEqual(d.approvalSatisfied, true);
    assert.strictEqual(d.approvalMechanism, 'context_flag');
  });

  await test('DESTRUCTIVE tool still denied (tier-1 unaffected)', async () => {
    const d = checkAndEnforcePolicy({ ...baseCtx, toolName: 'delete_branch' });
    assert.strictEqual(d.allowed, false);
    assert.strictEqual(d.reason, 'policy_denied');
  });

  await test('DESTRUCTIVE tool with allowDestructive=true still returns override_allowed', async () => {
    const d = checkAndEnforcePolicy({ ...baseCtx, toolName: 'delete_branch', allowDestructive: true });
    assert.strictEqual(d.allowed, true);
    assert.strictEqual(d.reason, 'override_allowed');
  });

  await test('decision includes riskLevel and policyBasis for requires_approval', async () => {
    const d = checkAndEnforcePolicy({ ...baseCtx, toolName: 'merge_pull_request' });
    assert.strictEqual(d.riskLevel, 'HIGH');
    assert.ok(d.policyBasis, 'Expected policyBasis to be present');
  });

  await test('correlationId is generated when absent', async () => {
    const ctx = { projectId: 'p', agentId: 'a', mcpServer: 's', toolName: 'merge_pull_request' };
    const d = checkAndEnforcePolicy(ctx);
    assert.strictEqual(d.allowed, false);
    assert.strictEqual(d.reason, 'requires_approval');
  });

  // ── 5. buildToolApprovalGrantedEvent — event structure ───────────────────

  console.log('\n5. buildToolApprovalGrantedEvent — event structure');

  const { buildToolApprovalGrantedEvent } = require('../src/emitter/event-builder');

  await test('approval_granted event has correct event_type and status', async () => {
    const event = buildToolApprovalGrantedEvent(
      { toolName: 'merge_pull_request', projectId: 'p', agentId: 'a', mcpServer: 's', correlationId: 'c' },
      { riskLevel: 'HIGH', reason: 'approved', policyBasis: 'high_risk_tool_allowed_by_explicit_approval', approvalMechanism: 'context_flag' }
    );
    assert.strictEqual(event.event_type, 'tool.approval_granted');
    assert.strictEqual(event.status, 'success');
    assert.strictEqual(event.action, 'merge_pull_request');
  });

  await test('approval_granted event metadata includes required fields', async () => {
    const event = buildToolApprovalGrantedEvent(
      { toolName: 'merge_pull_request', projectId: 'p', agentId: 'a', mcpServer: 's', correlationId: 'c' },
      { riskLevel: 'HIGH', reason: 'approved', policyBasis: 'high_risk_tool_allowed_by_explicit_approval', approvalMechanism: 'env_var' }
    );
    assert.strictEqual(event.metadata.tool_name, 'merge_pull_request');
    assert.strictEqual(event.metadata.risk_level, 'HIGH');
    assert.strictEqual(event.metadata.policy_basis, 'high_risk_tool_allowed_by_explicit_approval');
    assert.strictEqual(event.metadata.approval_mechanism, 'env_var');
  });

  await test('approval_granted event includes initiating_context when supplied', async () => {
    const event = buildToolApprovalGrantedEvent(
      { toolName: 'merge_pull_request', projectId: 'p', agentId: 'a', mcpServer: 's', correlationId: 'c', initiatingContext: 'CC-HMCP-000011' },
      { riskLevel: 'HIGH', reason: 'approved', policyBasis: 'high_risk_tool_allowed_by_explicit_approval', approvalMechanism: 'context_flag' }
    );
    assert.strictEqual(event.metadata.initiating_context, 'CC-HMCP-000011');
  });

  await test('buildToolApprovalGrantedEvent throws on missing required context field', async () => {
    assert.throws(() => {
      buildToolApprovalGrantedEvent(
        { toolName: 'merge_pull_request', projectId: 'p', agentId: 'a', mcpServer: 's' }, // missing correlationId
        { riskLevel: 'HIGH', reason: 'approved', policyBasis: 'x', approvalMechanism: 'context_flag' }
      );
    }, /Missing required emitter context field/);
  });

  await test('buildToolDenialEvent includes approval_required=true for requires_approval decision', async () => {
    const { buildToolDenialEvent } = require('../src/emitter/event-builder');
    const event = buildToolDenialEvent(
      { toolName: 'merge_pull_request', projectId: 'p', agentId: 'a', mcpServer: 's', correlationId: 'c' },
      { riskLevel: 'HIGH', reason: 'requires_approval', policyBasis: 'high_risk_tool_requires_approval', approvalRequired: true }
    );
    assert.strictEqual(event.event_type, 'tool.denial');
    assert.strictEqual(event.status, 'failure');
    assert.strictEqual(event.metadata.denial_reason, 'requires_approval');
    assert.strictEqual(event.metadata.approval_required, true);
  });

  // ── 6. Regression: CTRL-HMCP-000002 denial events unchanged ──────────────

  console.log('\n6. Regression — CTRL-HMCP-000002 denial event shape unchanged');

  await test('DESTRUCTIVE denial event has no approval_required field', async () => {
    const { buildToolDenialEvent } = require('../src/emitter/event-builder');
    const event = buildToolDenialEvent(
      { toolName: 'delete_branch', projectId: 'p', agentId: 'a', mcpServer: 's', correlationId: 'c' },
      { riskLevel: 'DESTRUCTIVE', reason: 'policy_denied', policyBasis: 'destructive_tool_not_allowed_by_default' }
    );
    assert.strictEqual(event.metadata.denial_reason, 'policy_denied');
    assert.strictEqual(event.metadata.approval_required, undefined);
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
