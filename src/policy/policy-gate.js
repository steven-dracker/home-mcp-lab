'use strict';

/**
 * Home MCP Compliance Lab — Policy Gate (CTRL-HMCP-000002 / CTRL-HMCP-000003)
 *
 * Evaluates whether a tool invocation is permitted under current policy.
 *
 * Enforcement tiers (evaluated in order):
 *
 *   TIER 1 — DESTRUCTIVE tools (CTRL-HMCP-000002)
 *     Tools with risk_level='DESTRUCTIVE' and allowed_by_default=false are
 *     denied outright unless the explicit destructive override is active.
 *     Override: context.allowDestructive=true or HMCP_ALLOW_DESTRUCTIVE=true.
 *
 *   TIER 2 — HIGH approval-required tools (CTRL-HMCP-000003)
 *     Tools with risk_level='HIGH' and allowed_by_default=false require an
 *     explicit approval signal. Without it, execution is blocked (reason:
 *     'requires_approval'). With it, execution is allowed (reason: 'approved').
 *     Approval: context.approvalGranted=true or HMCP_APPROVAL_GRANTED=true.
 *
 * This module is pure — it reads registry and override/approval state, returns
 * a decision, and emits nothing. Side effects (audit emission) happen in the
 * caller (see emitter/index.js checkAndEnforcePolicy).
 *
 * Decision result shape:
 *   {
 *     allowed:           boolean        — whether execution may proceed
 *     toolName:          string
 *     riskLevel:         string|null
 *     reason:            string         — see reason values below
 *     policyBasis:       string         — short machine-readable explanation
 *     approvalRequired:  boolean        — true when tier-2 applies (present only for HIGH tier-2 tools)
 *     approvalSatisfied: boolean        — true when approval was explicitly granted (present only for HIGH tier-2 tools)
 *     approvalMechanism: string|null    — 'context_flag' | 'env_var' | null (present only when approvalSatisfied=true)
 *   }
 *
 * Reason values:
 *   'allowed'             — tool is permitted (no enforcement triggered)
 *   'policy_denied'       — DESTRUCTIVE tool denied outright (tier 1)
 *   'override_allowed'    — DESTRUCTIVE tool allowed via explicit override (tier 1)
 *   'requires_approval'   — HIGH tool blocked; approval not satisfied (tier 2)
 *   'approved'            — HIGH tool allowed; approval explicitly satisfied (tier 2)
 */

const path = require('path');

const REGISTRY_PATH = path.resolve(__dirname, '../../config/tool-classifications.json');

let _fullRegistry = null;

function loadFullRegistry() {
  if (_fullRegistry !== null) return _fullRegistry;
  try {
    const entries = require(REGISTRY_PATH);
    _fullRegistry = {};
    for (const entry of entries) {
      if (entry.tool_name) {
        _fullRegistry[entry.tool_name] = entry;
      }
    }
  } catch (_) {
    _fullRegistry = {};
  }
  return _fullRegistry;
}

/**
 * Evaluates policy for a single tool invocation.
 *
 * @param {string} toolName
 * @param {object} [executionContext={}]
 *   executionContext.allowDestructive  {boolean} — explicit per-call override (tier 1)
 *   executionContext.approvalGranted   {boolean} — explicit per-call approval (tier 2)
 * @returns {{ allowed: boolean, toolName: string, riskLevel: string|null, reason: string, policyBasis: string, approvalRequired?: boolean, approvalSatisfied?: boolean, approvalMechanism?: string|null }}
 */
function evaluatePolicy(toolName, executionContext) {
  const ctx = executionContext || {};
  const registry = loadFullRegistry();
  const entry = registry[toolName] || null;

  const riskLevel = entry ? entry.risk_level : null;
  const allowedByDefault = entry ? entry.allowed_by_default : true;

  // ── Tier 1: DESTRUCTIVE tools ──────────────────────────────────────────────

  const subjectToDestructiveEnforcement = riskLevel === 'DESTRUCTIVE' && !allowedByDefault;

  if (subjectToDestructiveEnforcement) {
    const overrideEnabled =
      ctx.allowDestructive === true ||
      process.env.HMCP_ALLOW_DESTRUCTIVE === 'true';

    if (overrideEnabled) {
      return {
        allowed: true,
        toolName,
        riskLevel,
        reason: 'override_allowed',
        policyBasis: 'destructive_tool_allowed_by_explicit_override'
      };
    }

    return {
      allowed: false,
      toolName,
      riskLevel,
      reason: 'policy_denied',
      policyBasis: 'destructive_tool_not_allowed_by_default'
    };
  }

  // ── Tier 2: HIGH approval-required tools ──────────────────────────────────

  const subjectToApprovalEnforcement = riskLevel === 'HIGH' && !allowedByDefault;

  if (subjectToApprovalEnforcement) {
    const approvalViaCFlag = ctx.approvalGranted === true;
    const approvalViaEnvVar = process.env.HMCP_APPROVAL_GRANTED === 'true';
    const approvalSatisfied = approvalViaCFlag || approvalViaEnvVar;

    if (approvalSatisfied) {
      return {
        allowed: true,
        toolName,
        riskLevel,
        reason: 'approved',
        policyBasis: 'high_risk_tool_allowed_by_explicit_approval',
        approvalRequired: true,
        approvalSatisfied: true,
        approvalMechanism: approvalViaCFlag ? 'context_flag' : 'env_var'
      };
    }

    return {
      allowed: false,
      toolName,
      riskLevel,
      reason: 'requires_approval',
      policyBasis: 'high_risk_tool_requires_approval',
      approvalRequired: true,
      approvalSatisfied: false,
      approvalMechanism: null
    };
  }

  // ── Default: tool is allowed ───────────────────────────────────────────────

  return {
    allowed: true,
    toolName,
    riskLevel,
    reason: 'allowed',
    policyBasis: riskLevel ? `${riskLevel}_tool_allowed` : 'unclassified_tool_allowed'
  };
}

module.exports = { evaluatePolicy };
