'use strict';

/**
 * Home MCP Compliance Lab — Event Completeness Validator (TD-HMCP-000003)
 *
 * Validates whether a sequence of audit events constitutes a complete,
 * trustworthy trace according to the platform's completeness rules.
 *
 * Rules evaluated:
 *   1. Field integrity     — required fields present on every event
 *   2. Session coverage    — session.start / session.end pairing
 *   3. Correlation consistency — session.start and session.end share correlation_id
 *   4. Approval path       — tool.approval_granted has a matching tool.invocation
 *   5. Approval evidence   — tool.invocation for approval-required tools has a
 *                            preceding tool.approval_granted
 *
 * Pure module — reads the classification registry (file I/O only); returns
 * a structured result with no side effects.
 *
 * Usage:
 *   const { validate } = require('./event-completeness-validator');
 *   const result = validate(events);
 *   // { complete: boolean, issues: Array<Issue>, warnings: Array<Warning> }
 *
 * Result shape:
 *   {
 *     complete:  boolean   — true only when issues is empty
 *     issues:    Issue[]   — completeness failures; trace should not be trusted
 *     warnings:  Warning[] — advisory findings; trace may be acceptable
 *   }
 *
 * Issue shape:
 *   {
 *     code:     string   — stable machine-readable code (see ISSUE_CODES)
 *     message:  string   — human-readable description
 *     context:  object   — optional — event_id, tool_name, field, etc.
 *   }
 */

const path = require('path');

// ── Constants ───────────────────────────────────────────────────────────────

/**
 * Stable issue codes for completeness failures.
 * These codes are intended to be referenced by downstream consumers.
 */
const ISSUE_CODES = {
  INVALID_INPUT:                  'invalid_input',
  MISSING_REQUIRED_FIELD:         'missing_required_field',
  MISSING_SESSION_START:          'missing_session_start',
  MISSING_SESSION_END:            'missing_session_end',
  INCONSISTENT_SESSION_CORRELATION: 'inconsistent_session_correlation',
  APPROVAL_WITHOUT_INVOCATION:    'approval_without_invocation',
  MISSING_APPROVAL_EVIDENCE:      'missing_approval_evidence',
};

// Required top-level fields per audit-event.schema.json v0.2.0
const REQUIRED_FIELDS = [
  'event_id',
  'event_type',
  'timestamp',
  'correlation_id',
  'project_id',
  'agent_id',
  'mcp_server',
  'action',
  'status',
  'metadata',
];

// Event types that are session-scoped and require a session.start wrapper
const SESSION_ACTIVITY_TYPES = new Set([
  'tool.invocation',
  'tool.denial',
  'tool.approval_granted',
  'secret.retrieval',
]);

// ── Classification registry ─────────────────────────────────────────────────

let _classificationRegistry = null;

function loadClassificationRegistry() {
  if (_classificationRegistry !== null) return _classificationRegistry;
  try {
    const entries = require(path.resolve(__dirname, '../../config/tool-classifications.json'));
    _classificationRegistry = {};
    for (const entry of entries) {
      if (entry.tool_name) _classificationRegistry[entry.tool_name] = entry;
    }
  } catch (_) {
    _classificationRegistry = {};
  }
  return _classificationRegistry;
}

function toolRequiresApproval(toolName) {
  const registry = loadClassificationRegistry();
  const entry = registry[toolName];
  return !!(entry && entry.risk_level === 'HIGH' && entry.allowed_by_default === false);
}

// ── Issue / warning factories ────────────────────────────────────────────────

function mkIssue(code, message, context) {
  const result = { code, message };
  if (context != null) result.context = context;
  return result;
}

function mkWarning(code, message, context) {
  const result = { code, message };
  if (context != null) result.context = context;
  return result;
}

// ── Helper: extract tool name from an event ──────────────────────────────────

function toolNameOf(event) {
  return (event.metadata && event.metadata.tool_name) || event.action || null;
}

// ── Rules ────────────────────────────────────────────────────────────────────

/**
 * Rule 1 — Field Integrity
 *
 * Every event must contain all required top-level fields with non-null,
 * non-empty values. The metadata field must be an object.
 *
 * Issues: missing_required_field
 */
function checkRequiredFields(events) {
  const issues = [];
  for (const evt of events) {
    for (const field of REQUIRED_FIELDS) {
      const value = evt[field];
      const isMissing =
        value == null ||
        value === '' ||
        (field === 'metadata' && (typeof value !== 'object' || Array.isArray(value)));

      if (isMissing) {
        issues.push(mkIssue(
          ISSUE_CODES.MISSING_REQUIRED_FIELD,
          `Event is missing required field: "${field}"`,
          {
            event_id:   evt.event_id   || '(unknown)',
            event_type: evt.event_type || '(unknown)',
            field,
          }
        ));
      }
    }
  }
  return { issues, warnings: [] };
}

/**
 * Rule 2 — Session Coverage
 *
 * A trace that contains session-activity events must be framed by a
 * session.start event. If session.start is present, session.end is required.
 *
 * Issues: missing_session_start, missing_session_end
 */
function checkSessionCoverage(events) {
  const issues = [];

  const hasSessionStart   = events.some(e => e.event_type === 'session.start');
  const hasSessionEnd     = events.some(e => e.event_type === 'session.end');
  const activityEvents    = events.filter(e => SESSION_ACTIVITY_TYPES.has(e.event_type));
  const hasSessionActivity = activityEvents.length > 0;

  if (hasSessionActivity && !hasSessionStart) {
    issues.push(mkIssue(
      ISSUE_CODES.MISSING_SESSION_START,
      'Trace contains session-activity events but no session.start event',
      { session_activity_count: activityEvents.length }
    ));
  }

  if (hasSessionStart && !hasSessionEnd) {
    const start = events.find(e => e.event_type === 'session.start');
    issues.push(mkIssue(
      ISSUE_CODES.MISSING_SESSION_END,
      'Trace contains session.start but no session.end event',
      { correlation_id: start ? start.correlation_id : null }
    ));
  }

  return { issues, warnings: [] };
}

/**
 * Rule 3 — Correlation Consistency
 *
 * When a trace contains exactly one session.start and one session.end,
 * both must share the same correlation_id. Mismatched IDs indicate that
 * the end event belongs to a different session.
 *
 * Issues: inconsistent_session_correlation
 */
function checkCorrelationConsistency(events) {
  const issues = [];

  const starts = events.filter(e => e.event_type === 'session.start');
  const ends   = events.filter(e => e.event_type === 'session.end');

  if (starts.length === 1 && ends.length === 1) {
    const startCid = starts[0].correlation_id;
    const endCid   = ends[0].correlation_id;

    if (startCid && endCid && startCid !== endCid) {
      issues.push(mkIssue(
        ISSUE_CODES.INCONSISTENT_SESSION_CORRELATION,
        'session.start and session.end have different correlation_ids',
        {
          session_start_correlation_id: startCid,
          session_end_correlation_id:   endCid,
        }
      ));
    }
  }

  return { issues, warnings: [] };
}

/**
 * Rule 4 — Approval Path Completeness
 *
 * A tool.approval_granted event must be followed by a tool.invocation event
 * for the same tool within the same correlation scope. If approval was granted
 * but the tool was never invoked, the trace is incomplete.
 *
 * Issues: approval_without_invocation
 */
function checkApprovalPathCompleteness(events) {
  const issues = [];
  const approvals = events.filter(e => e.event_type === 'tool.approval_granted');

  for (const approval of approvals) {
    const toolName     = toolNameOf(approval);
    const correlationId = approval.correlation_id;

    const hasMatchingInvocation = events.some(e =>
      e.event_type === 'tool.invocation' &&
      toolNameOf(e) === toolName &&
      e.correlation_id === correlationId
    );

    if (!hasMatchingInvocation) {
      issues.push(mkIssue(
        ISSUE_CODES.APPROVAL_WITHOUT_INVOCATION,
        `tool.approval_granted for "${toolName}" has no matching tool.invocation in trace`,
        {
          tool_name:      toolName,
          correlation_id: correlationId,
          event_id:       approval.event_id,
        }
      ));
    }
  }

  return { issues, warnings: [] };
}

/**
 * Rule 5 — Approval Evidence for Invocations
 *
 * A tool.invocation event for a tool that requires approval (HIGH risk level,
 * allowed_by_default=false) must be preceded by a tool.approval_granted event
 * for the same tool within the same correlation scope.
 *
 * Tools subject to this rule are determined from config/tool-classifications.json.
 * If the registry cannot be loaded, this rule is skipped gracefully.
 *
 * Issues: missing_approval_evidence
 */
function checkApprovalEvidenceForInvocations(events) {
  const issues = [];
  const invocations = events.filter(e => e.event_type === 'tool.invocation');

  for (const inv of invocations) {
    const toolName = toolNameOf(inv);
    if (!toolName || !toolRequiresApproval(toolName)) continue;

    const correlationId = inv.correlation_id;

    const hasApproval = events.some(e =>
      e.event_type === 'tool.approval_granted' &&
      toolNameOf(e) === toolName &&
      e.correlation_id === correlationId
    );

    if (!hasApproval) {
      issues.push(mkIssue(
        ISSUE_CODES.MISSING_APPROVAL_EVIDENCE,
        `tool.invocation for approval-required tool "${toolName}" has no preceding tool.approval_granted in trace`,
        {
          tool_name:      toolName,
          correlation_id: correlationId,
          event_id:       inv.event_id,
        }
      ));
    }
  }

  return { issues, warnings: [] };
}

// ── Registered ruleset ───────────────────────────────────────────────────────

const RULES = [
  checkRequiredFields,
  checkSessionCoverage,
  checkCorrelationConsistency,
  checkApprovalPathCompleteness,
  checkApprovalEvidenceForInvocations,
];

// ── Validator ────────────────────────────────────────────────────────────────

/**
 * Validate a sequence of audit events for completeness.
 *
 * @param {object[]} events — array of audit event objects
 * @returns {{ complete: boolean, issues: object[], warnings: object[] }}
 */
function validate(events) {
  if (!Array.isArray(events)) {
    return {
      complete: false,
      issues: [mkIssue(
        ISSUE_CODES.INVALID_INPUT,
        'events must be an array',
        { received: typeof events }
      )],
      warnings: [],
    };
  }

  const allIssues   = [];
  const allWarnings = [];

  for (const rule of RULES) {
    const { issues, warnings } = rule(events);
    allIssues.push(...issues);
    allWarnings.push(...warnings);
  }

  return {
    complete: allIssues.length === 0,
    issues:   allIssues,
    warnings: allWarnings,
  };
}

module.exports = {
  validate,
  ISSUE_CODES,
  // Export individual rules for targeted unit testing
  checkRequiredFields,
  checkSessionCoverage,
  checkCorrelationConsistency,
  checkApprovalPathCompleteness,
  checkApprovalEvidenceForInvocations,
};
