'use strict';

const { randomUUID } = require('crypto');

const SCHEMA_VERSION = '0.2.0';
const PLATFORM = 'home-mcp-lab';

/**
 * Builds a schema-conforming tool.invocation audit event.
 *
 * Required context fields:
 *   toolName, projectId, agentId, mcpServer, correlationId, status
 *
 * Optional context fields:
 *   initiatingContext, workflowId, executionId
 *
 * Optional outcome fields:
 *   failureReason, executionDurationMs, resultSummary, argumentsSummary
 *
 * Throws if any required field is missing or invalid.
 * Callers must catch — this error surfaces to the failure observer, not to the tool call.
 */
function buildToolInvocationEvent(context, outcome) {
  const required = ['toolName', 'projectId', 'agentId', 'mcpServer', 'correlationId'];
  for (const field of required) {
    if (!context[field]) {
      throw new Error(`Missing required emitter context field: ${field}`);
    }
  }

  if (outcome.status !== 'success' && outcome.status !== 'failure') {
    throw new Error(`Invalid event status: "${outcome.status}". Must be "success" or "failure".`);
  }

  const metadata = {
    tool_name: context.toolName
  };

  if (outcome.argumentsSummary) {
    metadata.arguments_summary = String(outcome.argumentsSummary).slice(0, 500);
  }
  if (outcome.executionDurationMs != null) {
    metadata.execution_duration_ms = outcome.executionDurationMs;
  }
  if (outcome.resultSummary) {
    metadata.result_summary = String(outcome.resultSummary).slice(0, 500);
  }
  if (outcome.status === 'failure' && outcome.failureReason) {
    metadata.failure_reason = String(outcome.failureReason).slice(0, 500);
  }
  if (context.initiatingContext) {
    metadata.initiating_context = context.initiatingContext;
  }
  if (context.workflowId) {
    metadata.workflow_id = context.workflowId;
  }
  if (context.executionId) {
    metadata.execution_id = context.executionId;
  }

  return {
    schema_version: SCHEMA_VERSION,
    event_id: randomUUID(),
    event_type: 'tool.invocation',
    timestamp: new Date().toISOString(),
    platform: PLATFORM,
    project_id: context.projectId,
    agent_id: context.agentId,
    mcp_server: context.mcpServer,
    action: context.toolName,
    status: outcome.status,
    correlation_id: context.correlationId,
    metadata
  };
}

module.exports = { buildToolInvocationEvent };
