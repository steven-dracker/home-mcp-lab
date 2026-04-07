/**
 * Home MCP Compliance Lab — Correlation Integrity Validator (TD-HMCP-000004)
 *
 * Validates whether correlation linkage is internally consistent across the
 * events in a trace. A trace is correlation-valid when all events that should
 * be bound together are correctly linked through their correlation_id fields.
 *
 * Relationship to event-completeness-validator:
 *   Completeness  — are the expected event types present? (e.g., session.start,
 *                   session.end, approval evidence)
 *   Integrity     — are the events that exist correctly linked to each other?
 *   Both validators are independent. A trace can be complete but integrity-
 *   invalid (e.g., all required events present but with mismatched IDs), or
 *   integrity-valid but incomplete (e.g., correct IDs throughout but session.end
 *   missing). A higher-level audit validation layer can compose both.
 *
 * Rules evaluated:
 *   1. Correlation presence       — every event carries a non-empty correlation_id
 *   2. Session activity alignment — session-activity events match the session.start
 *                                   correlation_id (when exactly one session.start
 *                                   is in the trace)
 *   3. Trace context consistency  — trace should not mix events from incompatible
 *                                   correlation contexts (more distinct IDs than
 *                                   session boundaries)
 *   4. Unlinked control events    — tool.denial / tool.approval_granted events
 *                                   whose correlation_id is shared by no other
 *                                   event in a multi-event trace
 *
 * Pure module — no file I/O, no external calls, no side effects.
 *
 * Usage:
 *   const { validate } = require('./correlation-integrity-validator');
 *   const result = validate(events);
 *   // { valid: boolean, issues: Array<Issue>, warnings: Array<Warning> }
 *
 * Result shape:
 *   {
 *     valid:     boolean   — true only when issues is empty
 *     issues:    Issue[]   — integrity failures; linkage cannot be trusted
 *     warnings:  Warning[] — advisory findings (reserved; currently empty)
 *   }
 *
 * Issue shape:
 *   {
 *     code:     string   — stable machine-readable code (see ISSUE_CODES)
 *     message:  string   — human-readable description
 *     context:  object   — optional — event_id, correlation_id, tool_name, etc.
 *   }
 */

'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Stable issue codes for correlation integrity failures.
 */
const ISSUE_CODES = {
  INVALID_INPUT:               'invalid_input',
  MISSING_CORRELATION_ID:      'missing_correlation_id',
  INCONSISTENT_CORRELATION_ID: 'inconsistent_correlation_id',
  CONFLICTING_TRACE_CONTEXT:   'conflicting_trace_context',
  UNLINKED_DENIAL_EVENT:       'unlinked_denial_event',
  UNLINKED_APPROVAL_EVENT:     'unlinked_approval_event',
};

// Event types that are session-scoped; expected to share the session correlation_id.
const SESSION_ACTIVITY_TYPES = new Set([
  'tool.invocation',
  'tool.denial',
  'tool.approval_granted',
  'secret.retrieval',
]);

// Control event types that should always be linkable to a broader execution path.
const CONTROL_EVENT_TYPES = {
  DENIAL:   'tool.denial',
  APPROVAL: 'tool.approval_granted',
};

// ── Issue / warning factories ─────────────────────────────────────────────────

function mkIssue(code, message, context) {
  const result = { code, message };
  if (context != null) result.context = context;
  return result;
}

// Reserved for future advisory findings.
// eslint-disable-next-line no-unused-vars
function mkWarning(code, message, context) {
  const result = { code, message };
  if (context != null) result.context = context;
  return result;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function toolNameOf(event) {
  return (event.metadata && event.metadata.tool_name) || event.action || null;
}

// ── Rules ─────────────────────────────────────────────────────────────────────

/**
 * Rule 1 — Correlation Presence
 *
 * Every event in the trace must carry a non-empty correlation_id. An event
 * without a correlation_id cannot be attributed to any session or execution
 * path and is untrustworthy as audit evidence.
 *
 * Issues: missing_correlation_id
 */
function checkCorrelationPresence(events) {
  const issues = [];

  for (const evt of events) {
    const cid = evt.correlation_id;
    if (cid == null || cid === '') {
      issues.push(mkIssue(
        ISSUE_CODES.MISSING_CORRELATION_ID,
        'Event is missing a correlation_id',
        {
          event_id:   evt.event_id   || '(unknown)',
          event_type: evt.event_type || '(unknown)',
        }
      ));
    }
  }

  return { issues, warnings: [] };
}

/**
 * Rule 2 — Session Activity Alignment
 *
 * When the trace contains exactly one session.start event, all session-activity
 * events (tool.invocation, tool.denial, tool.approval_granted, secret.retrieval)
 * must share the same correlation_id as that session.start.
 *
 * An activity event with a different correlation_id cannot be reliably attributed
 * to the session and is likely from a different session or is orphaned.
 *
 * Scope: applies only when there is exactly one session.start in the trace.
 * When there are zero or multiple session.start events, this rule is skipped
 * (handled by other rules or out of scope for single-session validation).
 *
 * Issues: inconsistent_correlation_id
 */
function checkSessionActivityAlignment(events) {
  const issues = [];

  const sessionStarts = events.filter(e => e.event_type === 'session.start');
  if (sessionStarts.length !== 1) return { issues, warnings: [] };

  const sessionCid = sessionStarts[0].correlation_id;
  if (!sessionCid) return { issues, warnings: [] };

  const activityEvents = events.filter(e => SESSION_ACTIVITY_TYPES.has(e.event_type));

  for (const evt of activityEvents) {
    const evtCid = evt.correlation_id;
    if (evtCid && evtCid !== sessionCid) {
      issues.push(mkIssue(
        ISSUE_CODES.INCONSISTENT_CORRELATION_ID,
        `Event correlation_id "${evtCid}" does not match session correlation_id "${sessionCid}"`,
        {
          event_id:            evt.event_id   || '(unknown)',
          event_type:          evt.event_type || '(unknown)',
          tool_name:           toolNameOf(evt),
          event_correlation_id:   evtCid,
          session_correlation_id: sessionCid,
        }
      ));
    }
  }

  return { issues, warnings: [] };
}

/**
 * Rule 3 — Trace Context Consistency
 *
 * A trace is expected to represent a single correlation context (one session).
 * If the number of distinct correlation_ids in the trace exceeds the number of
 * session.start events, events from incompatible contexts have been mixed into
 * the same trace. This indicates corrupted trace assembly or orphaned events.
 *
 * Formula: distinct_correlation_ids > session_start_count → conflicting context.
 * Null/empty correlation_ids are excluded from the distinct-ID count (already
 * caught by Rule 1).
 *
 * Issues: conflicting_trace_context
 */
function checkTraceContextConsistency(events) {
  const issues = [];

  const allCids    = events.map(e => e.correlation_id).filter(c => c != null && c !== '');
  const distinctCids  = new Set(allCids);
  const sessionStartCount = events.filter(e => e.event_type === 'session.start').length;

  if (distinctCids.size > sessionStartCount && distinctCids.size > 1) {
    issues.push(mkIssue(
      ISSUE_CODES.CONFLICTING_TRACE_CONTEXT,
      `Trace contains ${distinctCids.size} distinct correlation_id(s) but only ${sessionStartCount} session.start event(s); events from incompatible contexts may be mixed`,
      {
        distinct_correlation_id_count: distinctCids.size,
        session_start_count:           sessionStartCount,
        correlation_ids:               Array.from(distinctCids),
      }
    ));
  }

  return { issues, warnings: [] };
}

/**
 * Rule 4 — Unlinked Control Events
 *
 * A tool.denial or tool.approval_granted event is "unlinked" when its
 * correlation_id does not appear in any other event in the trace, and the
 * trace contains more than one event total. An unlinked control event cannot
 * be attributed to any session or execution path.
 *
 * Single-event traces are exempt: a lone control event with a valid
 * correlation_id is a valid isolated audit record.
 *
 * Issues: unlinked_denial_event, unlinked_approval_event
 */
function checkUnlinkedControlEvents(events) {
  const issues = [];

  if (events.length <= 1) return { issues, warnings: [] };

  for (const evt of events) {
    const isDenial   = evt.event_type === CONTROL_EVENT_TYPES.DENIAL;
    const isApproval = evt.event_type === CONTROL_EVENT_TYPES.APPROVAL;
    if (!isDenial && !isApproval) continue;

    const cid = evt.correlation_id;
    if (!cid) continue; // Already caught by Rule 1.

    // Is this CID shared by any other event in the trace?
    const isLinked = events.some(other => other !== evt && other.correlation_id === cid);

    if (!isLinked) {
      const code = isDenial
        ? ISSUE_CODES.UNLINKED_DENIAL_EVENT
        : ISSUE_CODES.UNLINKED_APPROVAL_EVENT;

      const label = isDenial ? 'tool.denial' : 'tool.approval_granted';

      issues.push(mkIssue(
        code,
        `${label} event has a correlation_id ("${cid}") not shared by any other event in the trace`,
        {
          event_id:       evt.event_id   || '(unknown)',
          tool_name:      toolNameOf(evt),
          correlation_id: cid,
        }
      ));
    }
  }

  return { issues, warnings: [] };
}

// ── Registered ruleset ────────────────────────────────────────────────────────

const RULES = [
  checkCorrelationPresence,
  checkSessionActivityAlignment,
  checkTraceContextConsistency,
  checkUnlinkedControlEvents,
];

// ── Validator ─────────────────────────────────────────────────────────────────

/**
 * Validate a sequence of audit events for correlation integrity.
 *
 * @param {object[]} events — array of audit event objects
 * @returns {{ valid: boolean, issues: object[], warnings: object[] }}
 */
function validate(events) {
  if (!Array.isArray(events)) {
    return {
      valid: false,
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
    valid:    allIssues.length === 0,
    issues:   allIssues,
    warnings: allWarnings,
  };
}

module.exports = {
  validate,
  ISSUE_CODES,
  // Export individual rules for targeted unit testing.
  checkCorrelationPresence,
  checkSessionActivityAlignment,
  checkTraceContextConsistency,
  checkUnlinkedControlEvents,
};
