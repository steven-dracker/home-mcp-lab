'use strict';

/**
 * Home MCP Compliance Lab — Policy Gate (CTRL-HMCP-000002)
 *
 * Evaluates whether a tool invocation is permitted under current policy.
 *
 * Current policy: DESTRUCTIVE tools with allowed_by_default=false are denied
 * unless an explicit override is active in the execution context.
 *
 * This module is pure — it reads registry and override state, returns a
 * decision, and emits nothing. Side effects (audit emission) happen in the
 * caller (see emitter/index.js checkAndEnforcePolicy).
 *
 * Override mechanism:
 *   Pass { allowDestructive: true } in the execution context, or set the
 *   environment variable HMCP_ALLOW_DESTRUCTIVE=true. Both are intentional
 *   acts; neither is ever the default. Either can be removed to restore
 *   deny-by-default behavior without code changes.
 *
 * Decision result shape:
 *   {
 *     allowed:      boolean   — whether execution may proceed
 *     toolName:     string
 *     riskLevel:    string|null
 *     reason:       string    — 'allowed' | 'policy_denied' | 'override_allowed'
 *     policyBasis:  string    — short machine-readable explanation
 *   }
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
 *   executionContext.allowDestructive {boolean} — explicit per-call override
 * @returns {{ allowed: boolean, toolName: string, riskLevel: string|null, reason: string, policyBasis: string }}
 */
function evaluatePolicy(toolName, executionContext) {
  const ctx = executionContext || {};
  const registry = loadFullRegistry();
  const entry = registry[toolName] || null;

  const riskLevel = entry ? entry.risk_level : null;
  const allowedByDefault = entry ? entry.allowed_by_default : true;

  // Only DESTRUCTIVE + not allowed_by_default triggers enforcement.
  const subjectToEnforcement = riskLevel === 'DESTRUCTIVE' && !allowedByDefault;

  if (!subjectToEnforcement) {
    return {
      allowed: true,
      toolName,
      riskLevel,
      reason: 'allowed',
      policyBasis: riskLevel ? `${riskLevel}_tool_allowed` : 'unclassified_tool_allowed'
    };
  }

  // Check for an active override.
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

module.exports = { evaluatePolicy };
