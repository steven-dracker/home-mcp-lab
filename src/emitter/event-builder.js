'use strict';

const { randomUUID } = require('crypto');

const SCHEMA_VERSION = '0.2.0';
const PLATFORM = 'home-mcp-lab';

/**
 * Builds a schema-conforming session.start audit event.
 *
 * Required context fields:
 *   projectId, agentId, mcpServer, correlationId
 *
 * Optional context fields:
 *   initiatingContext, sessionType, executionMode
 *
 * Throws if any required field is missing.
 */
function buildSessionStartEvent(context) {
  const required = ['projectId', 'agentId', 'mcpServer', 'correlationId'];
  for (const field of required) {
    if (!context[field]) {
      throw new Error(`Missing required emitter context field: ${field}`);
    }
  }

  const metadata = {
    session_type: context.sessionType || 'interactive',
    execution_mode: context.executionMode || 'agent-mediated'
  };
  if (context.initiatingContext) {
    metadata.initiating_context = context.initiatingContext;
  }

  return {
    schema_version: SCHEMA_VERSION,
    event_id: randomUUID(),
    event_type: 'session.start',
    timestamp: new Date().toISOString(),
    platform: PLATFORM,
    project_id: context.projectId,
    agent_id: context.agentId,
    mcp_server: context.mcpServer,
    action: 'mcp_session_init',
    status: 'success',
    correlation_id: context.correlationId,
    metadata
  };
}

/**
 * Builds a schema-conforming session.end audit event.
 *
 * Required context fields:
 *   projectId, agentId, mcpServer, correlationId
 *
 * Required outcome fields:
 *   status ('success' | 'failure'), sessionStartTime (ms since epoch)
 *
 * Optional outcome fields:
 *   completionReason, outcomeSummary, failureReason
 *
 * Throws if any required field is missing or invalid.
 */
function buildSessionEndEvent(context, outcome) {
  const required = ['projectId', 'agentId', 'mcpServer', 'correlationId'];
  for (const field of required) {
    if (!context[field]) {
      throw new Error(`Missing required emitter context field: ${field}`);
    }
  }

  if (outcome.status !== 'success' && outcome.status !== 'failure') {
    throw new Error(`Invalid session.end status: "${outcome.status}". Must be "success" or "failure".`);
  }

  const metadata = {
    completion_reason: outcome.completionReason || (outcome.status === 'success' ? 'task_complete' : 'error'),
    duration_ms: outcome.sessionStartTime != null ? (Date.now() - outcome.sessionStartTime) : null
  };
  if (outcome.outcomeSummary) {
    metadata.outcome_summary = String(outcome.outcomeSummary).slice(0, 500);
  }
  if (outcome.status === 'failure' && outcome.failureReason) {
    metadata.failure_reason = String(outcome.failureReason).slice(0, 500);
  }
  if (context.initiatingContext) {
    metadata.initiating_context = context.initiatingContext;
  }

  return {
    schema_version: SCHEMA_VERSION,
    event_id: randomUUID(),
    event_type: 'session.end',
    timestamp: new Date().toISOString(),
    platform: PLATFORM,
    project_id: context.projectId,
    agent_id: context.agentId,
    mcp_server: context.mcpServer,
    action: 'mcp_session_close',
    status: outcome.status,
    correlation_id: context.correlationId,
    metadata
  };
}


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

  if (context.riskLevel) {
    metadata.risk_level = context.riskLevel;
  }

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

/**
 * Builds a schema-conforming secret.retrieval audit event.
 *
 * Required context fields:
 *   projectId, agentId, correlationId, secretIdentifier, retrievalMechanism
 *
 * Optional context fields:
 *   mcpServer (default 'n/a'), retrievalMode (default 'non-interactive'),
 *   environmentContext (default 'cli')
 *
 * Required outcome fields:
 *   status ('success' | 'failure')
 *
 * Optional outcome fields:
 *   failureReason (required when status is 'failure')
 *
 * Throws if any required field is missing or invalid.
 * Secret values must never appear in secretIdentifier or any other field.
 */
function buildSecretRetrievalEvent(context, outcome) {
  const required = ['projectId', 'agentId', 'correlationId', 'secretIdentifier', 'retrievalMechanism'];
  for (const field of required) {
    if (!context[field]) {
      throw new Error(`Missing required emitter context field: ${field}`);
    }
  }

  if (outcome.status !== 'success' && outcome.status !== 'failure') {
    throw new Error(`Invalid secret.retrieval status: "${outcome.status}". Must be "success" or "failure".`);
  }

  const metadata = {
    secret_identifier: context.secretIdentifier,
    retrieval_mode: context.retrievalMode || 'non-interactive',
    environment_context: context.environmentContext || 'cli',
    retrieval_mechanism: context.retrievalMechanism
  };

  if (outcome.status === 'failure' && outcome.failureReason) {
    metadata.failure_reason = String(outcome.failureReason).slice(0, 500);
  }

  return {
    schema_version: SCHEMA_VERSION,
    event_id: randomUUID(),
    event_type: 'secret.retrieval',
    timestamp: new Date().toISOString(),
    platform: PLATFORM,
    project_id: context.projectId,
    agent_id: context.agentId,
    mcp_server: context.mcpServer || 'n/a',
    action: context.retrievalMechanism,
    status: outcome.status,
    correlation_id: context.correlationId,
    metadata
  };
}

/**
 * Builds a schema-conforming tool.denial audit event.
 *
 * Required context fields:
 *   toolName, projectId, agentId, mcpServer, correlationId
 *
 * Required decision fields (from policy-gate evaluatePolicy result):
 *   riskLevel, reason, policyBasis
 *
 * Optional decision fields:
 *   approvalRequired (boolean) — included in metadata when present
 *
 * Throws if any required field is missing.
 */
function buildToolDenialEvent(context, decision) {
  const required = ['toolName', 'projectId', 'agentId', 'mcpServer', 'correlationId'];
  for (const field of required) {
    if (!context[field]) {
      throw new Error(`Missing required emitter context field: ${field}`);
    }
  }

  const metadata = {
    tool_name: context.toolName,
    risk_level: decision.riskLevel || 'UNKNOWN',
    denial_reason: decision.reason,
    policy_basis: decision.policyBasis
  };

  if (decision.approvalRequired != null) {
    metadata.approval_required = decision.approvalRequired;
  }

  if (context.initiatingContext) {
    metadata.initiating_context = context.initiatingContext;
  }

  return {
    schema_version: SCHEMA_VERSION,
    event_id: randomUUID(),
    event_type: 'tool.denial',
    timestamp: new Date().toISOString(),
    platform: PLATFORM,
    project_id: context.projectId,
    agent_id: context.agentId,
    mcp_server: context.mcpServer,
    action: context.toolName,
    status: 'failure',
    correlation_id: context.correlationId,
    metadata
  };
}

/**
 * Builds a schema-conforming tool.approval_granted audit event.
 *
 * Emitted when a HIGH approval-required tool is allowed because an explicit
 * approval signal was satisfied (CTRL-HMCP-000003).
 *
 * Required context fields:
 *   toolName, projectId, agentId, mcpServer, correlationId
 *
 * Required decision fields (from policy-gate evaluatePolicy result):
 *   riskLevel, reason ('approved'), policyBasis, approvalMechanism
 *
 * Throws if any required field is missing.
 */
function buildToolApprovalGrantedEvent(context, decision) {
  const required = ['toolName', 'projectId', 'agentId', 'mcpServer', 'correlationId'];
  for (const field of required) {
    if (!context[field]) {
      throw new Error(`Missing required emitter context field: ${field}`);
    }
  }

  const metadata = {
    tool_name: context.toolName,
    risk_level: decision.riskLevel || 'UNKNOWN',
    policy_basis: decision.policyBasis,
    approval_mechanism: decision.approvalMechanism || 'unknown'
  };

  if (context.initiatingContext) {
    metadata.initiating_context = context.initiatingContext;
  }

  return {
    schema_version: SCHEMA_VERSION,
    event_id: randomUUID(),
    event_type: 'tool.approval_granted',
    timestamp: new Date().toISOString(),
    platform: PLATFORM,
    project_id: context.projectId,
    agent_id: context.agentId,
    mcp_server: context.mcpServer,
    action: context.toolName,
    status: 'success',
    correlation_id: context.correlationId,
    metadata
  };
}

module.exports = { buildToolInvocationEvent, buildSessionStartEvent, buildSessionEndEvent, buildSecretRetrievalEvent, buildToolDenialEvent, buildToolApprovalGrantedEvent };
