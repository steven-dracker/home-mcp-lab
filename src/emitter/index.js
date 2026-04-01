'use strict';

/**
 * Home MCP Compliance Lab — Model C Event Emitter
 *
 * Agent-mediated MCP tool call instrumentation per ADR-HMCP-002.
 * Emits tool.invocation audit events at tool call completion boundaries.
 *
 * Public API:
 *   emitToolInvocation(context, outcome)   — emit a single event (fire-and-forget)
 *   withToolInstrumentation(context, fn)   — wrap an async tool call with instrumentation
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
const { buildToolInvocationEvent } = require('./event-builder');
const { submit } = require('./transport');
const { record } = require('./failure-observer');

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
      correlationId: context.correlationId || generateCorrelationId()
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

module.exports = { emitToolInvocation, withToolInstrumentation };
