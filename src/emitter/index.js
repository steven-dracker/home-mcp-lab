'use strict';

/**
 * Home MCP Compliance Lab — Model C Event Emitter
 *
 * Agent-mediated MCP tool call instrumentation per ADR-HMCP-002.
 * Emits tool.invocation audit events at tool call completion boundaries.
 *
 * Public API:
 *   withSession(baseContext, fn)           — run fn in a managed session; emits session.start and session.end
 *   emitToolInvocation(context, outcome)   — emit a single tool.invocation event (fire-and-forget)
 *   withToolInstrumentation(context, fn)   — wrap an async tool call with instrumentation
 *   emitSessionStart(context)              — emit session.start directly; returns correlationId
 *   emitSessionEnd(context, outcome)       — emit session.end directly
 *   checkAndEnforcePolicy(context)         — evaluate policy; emit tool.denial or tool.approval_granted; returns decision
 *
 * Context shape:
 *   toolName           string  required  — MCP tool name (e.g. "create_issue")
 *   projectId          string  required  — registered project ID (e.g. "home-mcp-lab")
 *   agentId            string  required  — agent/session identifier
 *   mcpServer          string  required  — MCP server identifier (e.g. "github-mcp-server")
 *   correlationId      string  optional  — session correlation ID; generated if absent
 *   initiatingContext  string  optional  — task/prompt ID (e.g. "CC-HMCP-000004B")
 *   workflowId         string  optional  — higher-level workflow linkage
 *   executionId        string  optional  — execution-level identifier
 *   argumentsSummary   string  optional  — non-sensitive summary of call arguments
 */

const { randomUUID } = require('crypto');
const { buildToolInvocationEvent, buildSessionStartEvent, buildSessionEndEvent, buildSecretRetrievalEvent, buildToolDenialEvent, buildToolApprovalGrantedEvent } = require('./event-builder');
const { submit } = require('./transport');
const { record } = require('./failure-observer');
const { lookupRiskLevel } = require('./classification-registry');
const { evaluatePolicy } = require('../policy/policy-gate');

function generateCorrelationId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `sess-${date}-${randomUUID().slice(0, 8)}`;
}

/**
 * Emit a single tool.invocation event.
 * Never throws — emission failures are handled by the failure observer.
 *
 * outcome shape:
 *   status             'success' | 'failure'  required
 *   failureReason      string                 required when status is 'failure'
 *   executionDurationMs  number               optional
 *   resultSummary      string                 optional
 *   argumentsSummary   string                 optional (overrides context.argumentsSummary)
 */
function emitToolInvocation(context, outcome) {
  try {
    const resolvedContext = {
      ...context,
      correlationId: context.correlationId || generateCorrelationId(),
      riskLevel: context.riskLevel || lookupRiskLevel(context.toolName)
    };

    const event = buildToolInvocationEvent(resolvedContext, outcome);
    submit(event);
  } catch (err) {
    record(err, {
      toolName: context.toolName,
      status: outcome ? outcome.status : 'unknown'
    });
  }
}

/**
 * Wrap an async tool call function with instrumentation.
 *
 * Emits a tool.invocation event after the call completes — success or failure.
 * The wrapped function's return value is always returned to the caller.
 * If the wrapped function throws, the error is re-thrown after the event is emitted.
 * Emission failure never suppresses the original error.
 *
 * Example:
 *   const result = await withToolInstrumentation(
 *     { toolName: 'create_issue', projectId: 'home-mcp-lab', agentId: 'claude-code-1',
 *       mcpServer: 'github-mcp-server', correlationId: 'sess-20260401-abc123' },
 *     () => githubMcp.createIssue({ title: 'Test', body: 'Hello' })
 *   );
 */
async function withToolInstrumentation(context, fn) {
  const start = Date.now();

  let result;
  try {
    result = await fn();
  } catch (err) {
    emitToolInvocation(context, {
      status: 'failure',
      failureReason: classifyFailure(err),
      executionDurationMs: Date.now() - start
    });
    throw err;
  }

  emitToolInvocation(context, {
    status: 'success',
    resultSummary: summarize(result),
    executionDurationMs: Date.now() - start
  });

  return result;
}

// Bounded summary — tool results must not be included raw (may contain sensitive data).
function summarize(result) {
  if (result == null) return 'null';
  const s = typeof result === 'string' ? result : JSON.stringify(result);
  return s.length > 300 ? s.slice(0, 300) + '...[truncated]' : s;
}

// Map known error shapes to canonical failure reasons per ADR-HMCP-002.
function classifyFailure(err) {
  if (!err) return 'unknown_failure';
  if (err.code === 'ETIMEDOUT') return 'tool_call_timed_out';
  if (err.name === 'AbortError') return 'tool_call_cancelled_by_agent';
  const msg = err.message || '';
  if (msg.toLowerCase().includes('timed out') || msg.toLowerCase().includes('timeout')) {
    return 'tool_call_timed_out';
  }
  if (msg.toLowerCase().includes('cancel')) {
    return 'tool_call_cancelled_by_agent';
  }
  return msg.slice(0, 300) || 'unknown_failure';
}

/**
 * Emit a session.start event.
 * Never throws — emission failures are handled by the failure observer.
 *
 * Returns the correlationId used, so callers can propagate it to tool calls.
 */
function emitSessionStart(context) {
  try {
    const resolvedContext = {
      ...context,
      correlationId: context.correlationId || generateCorrelationId()
    };
    const event = buildSessionStartEvent(resolvedContext);
    submit(event);
    return resolvedContext.correlationId;
  } catch (err) {
    record(err, { event_type: 'session.start', projectId: context.projectId });
    // Return a generated ID so session can continue even if emission failed.
    return context.correlationId || generateCorrelationId();
  }
}

/**
 * Emit a session.end event.
 * Never throws — emission failures are handled by the failure observer.
 *
 * outcome shape:
 *   status             'success' | 'failure'  required
 *   sessionStartTime   number                 required — ms since epoch from session start
 *   completionReason   string                 optional
 *   outcomeSummary     string                 optional
 *   failureReason      string                 required when status is 'failure'
 */
function emitSessionEnd(context, outcome) {
  try {
    const event = buildSessionEndEvent(context, outcome);
    submit(event);
  } catch (err) {
    record(err, { event_type: 'session.end', correlationId: context.correlationId });
  }
}

/**
 * Run an async function within a managed session.
 *
 * Emits session.start before calling fn, injects correlationId into every
 * withToolInstrumentation call inside fn, and emits session.end after fn
 * completes — whether it succeeds or throws.
 *
 * session.end emits status:'failure' if fn throws; status:'success' otherwise.
 * The original error is always re-thrown after session.end is emitted.
 *
 * baseContext shape — same as tool emitter context minus toolName/correlationId:
 *   projectId          string  required
 *   agentId            string  required
 *   mcpServer          string  required
 *   initiatingContext  string  optional
 *   sessionType        string  optional  — default 'interactive'
 *   executionMode      string  optional  — default 'agent-mediated'
 *
 * fn receives (sessionContext) — a context object with correlationId populated,
 * suitable for passing directly to withToolInstrumentation or emitToolInvocation.
 *
 * Example:
 *   await withSession(
 *     { projectId: 'home-mcp-lab', agentId: 'claude-code-1',
 *       mcpServer: 'github-mcp-server', initiatingContext: 'CC-HMCP-000004C' },
 *     async (sessionCtx) => {
 *       await withToolInstrumentation({ ...sessionCtx, toolName: 'get_file_contents' }, () => mcp.getFile(...));
 *       await withToolInstrumentation({ ...sessionCtx, toolName: 'create_issue' }, () => mcp.createIssue(...));
 *     }
 *   );
 */
async function withSession(baseContext, fn) {
  const correlationId = emitSessionStart(baseContext);
  const sessionContext = { ...baseContext, correlationId };
  const sessionStartTime = Date.now();

  let result;
  try {
    result = await fn(sessionContext);
  } catch (err) {
    emitSessionEnd(sessionContext, {
      status: 'failure',
      sessionStartTime,
      completionReason: 'error',
      failureReason: err && err.message ? err.message.slice(0, 300) : 'unknown_error'
    });
    throw err;
  }

  emitSessionEnd(sessionContext, {
    status: 'success',
    sessionStartTime,
    completionReason: 'task_complete'
  });

  return result;
}

/**
 * Emit a single secret.retrieval event.
 * Never throws — emission failures are handled by the failure observer.
 *
 * context shape:
 *   projectId          string  required
 *   agentId            string  required
 *   secretIdentifier   string  required — non-sensitive reference; never the secret value
 *   retrievalMechanism string  required — 'keeper-commander' | 'env-passthrough' | 'gh-cli'
 *   correlationId      string  optional — generated if absent
 *   mcpServer          string  optional — default 'n/a'
 *   retrievalMode      string  optional — default 'non-interactive'
 *   environmentContext string  optional — 'service' | 'cli'; default 'cli'
 *
 * outcome shape:
 *   status             'success' | 'failure'  required
 *   failureReason      string                 required when status is 'failure'
 */
function emitSecretRetrieval(context, outcome) {
  try {
    const resolvedContext = {
      ...context,
      correlationId: context.correlationId || generateCorrelationId()
    };
    const event = buildSecretRetrievalEvent(resolvedContext, outcome);
    submit(event);
  } catch (err) {
    record(err, {
      secretIdentifier: context.secretIdentifier,
      status: outcome ? outcome.status : 'unknown'
    });
  }
}

/**
 * Evaluate policy for a tool and emit audit events for all enforcement outcomes.
 *
 * Returns a decision object. When allowed === false, the tool must not be
 * invoked — the caller is responsible for gating execution on this result.
 *
 * Never throws — emission failures are handled by the failure observer.
 *
 * Enforcement tiers:
 *   Tier 1 (DESTRUCTIVE): denied outright; tool.denial emitted with reason 'policy_denied'.
 *   Tier 1 override: allowed via allowDestructive; no additional event emitted.
 *   Tier 2 (HIGH, approval-required): blocked; tool.denial emitted with reason 'requires_approval'.
 *   Tier 2 approved: allowed; tool.approval_granted emitted with mechanism captured.
 *
 * context shape — same as emitToolInvocation context plus:
 *   allowDestructive  boolean  optional  — per-call explicit destructive override (tier 1); default false
 *   approvalGranted   boolean  optional  — per-call explicit approval (tier 2); default false
 *
 * Returned decision shape:
 *   {
 *     allowed:           boolean
 *     toolName:          string
 *     riskLevel:         string|null
 *     reason:            'allowed' | 'policy_denied' | 'override_allowed' | 'requires_approval' | 'approved'
 *     policyBasis:       string
 *     approvalRequired:  boolean   (present for HIGH tier-2 tools)
 *     approvalSatisfied: boolean   (present for HIGH tier-2 tools)
 *     approvalMechanism: string|null (present for HIGH tier-2 tools when approved)
 *   }
 */
function checkAndEnforcePolicy(context) {
  const resolvedContext = {
    ...context,
    correlationId: context.correlationId || generateCorrelationId()
  };

  const decision = evaluatePolicy(resolvedContext.toolName, {
    allowDestructive: resolvedContext.allowDestructive,
    approvalGranted: resolvedContext.approvalGranted
  });

  if (!decision.allowed) {
    // Covers both 'policy_denied' (tier 1) and 'requires_approval' (tier 2).
    try {
      const event = buildToolDenialEvent(resolvedContext, decision);
      submit(event);
    } catch (err) {
      record(err, {
        toolName: resolvedContext.toolName,
        reason: decision.reason
      });
    }
  } else if (decision.reason === 'approved') {
    // Tier 2 approval granted — emit explicit audit evidence.
    try {
      const event = buildToolApprovalGrantedEvent(resolvedContext, decision);
      submit(event);
    } catch (err) {
      record(err, {
        toolName: resolvedContext.toolName,
        reason: decision.reason
      });
    }
  }

  return decision;
}

module.exports = { emitToolInvocation, withToolInstrumentation, emitSessionStart, emitSessionEnd, withSession, emitSecretRetrieval, checkAndEnforcePolicy };
