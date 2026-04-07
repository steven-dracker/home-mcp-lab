'use strict';

/**
 * Home MCP Compliance Lab — Session Anomaly Detector (TD-HMCP-000001)
 *
 * Detects anomalous behavioral patterns in a session trace using explicit,
 * deterministic rules. Operates on traces already considered sufficiently
 * complete and correlation-valid (see completeness and integrity validators).
 *
 * Relationship to existing validators:
 *   Completeness  — are the expected event types present?
 *   Integrity     — are the events correctly linked via correlation_id?
 *   Anomaly (this) — do the events that exist form a suspicious behavioral pattern?
 *
 * These three layers are independent. A trace can be complete and valid but
 * still anomalous (e.g., correct structure, correct linkage, but 10 denials
 * in one session). Run all three for full audit trust.
 *
 * Rules evaluated:
 *   1. Repeated denials          — session contains ≥ THRESHOLDS.REPEATED_DENIALS
 *                                  tool.denial events; concentration of denied
 *                                  actions is unusual in normal operation
 *   2. Approval without          — tool.approval_granted with no corresponding
 *      follow-through              tool.invocation; approval obtained but tool
 *                                  never used
 *   3. Conflicting control       — the same tool was denied and invoked in the
 *      outcomes                    session with no approval evidence; suggests
 *                                  a policy bypass or unrecorded approval
 *   4. Control-event-heavy       — control events (denials + approvals) heavily
 *      session                     outnumber actual invocations; session dominated
 *                                  by policy activity rather than productive work
 *   5. Excessive tool activity   — total tool events exceed THRESHOLDS.EXCESSIVE_TOOL_ACTIVITY;
 *                                  unusually high activity for a single session
 *
 * Pure module — no file I/O, no external calls, no side effects.
 *
 * Usage:
 *   const { detect } = require('./session-anomaly-detector');
 *   const result = detect(events);
 *   // { anomalous: boolean, findings: Array<Finding>, warnings: Array<Warning> }
 *
 * Result shape:
 *   {
 *     anomalous: boolean    — true when findings is non-empty
 *     findings:  Finding[]  — anomaly detections; each describes a suspicious pattern
 *     warnings:  Warning[]  — advisory findings (reserved; currently empty)
 *   }
 *
 * Finding shape:
 *   {
 *     code:     string   — stable machine-readable code (see FINDING_CODES)
 *     message:  string   — human-readable description
 *     context:  object   — optional — counts, tool names, event IDs, thresholds
 *   }
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Stable finding codes for session anomaly detections.
 */
const FINDING_CODES = {
  INVALID_INPUT:                  'invalid_input',
  REPEATED_POLICY_DENIALS:        'repeated_policy_denials',
  APPROVAL_WITHOUT_FOLLOWTHROUGH: 'approval_without_followthrough',
  CONFLICTING_CONTROL_OUTCOMES:   'conflicting_control_outcomes',
  CONTROL_EVENT_HEAVY_SESSION:    'control_event_heavy_session',
  EXCESSIVE_TOOL_ACTIVITY:        'excessive_tool_activity',
};

/**
 * Thresholds used by rule evaluations.
 * Exported for reference in tests and documentation.
 */
const THRESHOLDS = {
  // Minimum tool.denial count that triggers repeated_policy_denials.
  REPEATED_DENIALS: 3,

  // Minimum control event count required before control_event_heavy_session can fire.
  CONTROL_HEAVY_MIN: 3,

  // Control events must exceed invocations by at least this margin to trigger
  // control_event_heavy_session.
  CONTROL_HEAVY_MARGIN: 2,

  // Maximum total tool events (invocations + denials + approvals) before
  // excessive_tool_activity is flagged.
  EXCESSIVE_TOOL_ACTIVITY: 50,
};

// ── Finding / warning factories ───────────────────────────────────────────────

function mkFinding(code, message, context) {
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
 * Rule 1 — Repeated Policy Denials
 *
 * A session with ≥ THRESHOLDS.REPEATED_DENIALS tool.denial events indicates
 * unusual concentration of blocked actions. In normal operation a session will
 * have zero or one denial; multiple denials suggest either repeated attempts
 * against a blocked tool or a misconfigured caller.
 *
 * Findings: repeated_policy_denials
 */
function checkRepeatedDenials(events) {
  const findings = [];

  const denials = events.filter(e => e.event_type === 'tool.denial');
  if (denials.length >= THRESHOLDS.REPEATED_DENIALS) {
    const deniedTools = [...new Set(denials.map(toolNameOf).filter(Boolean))];
    findings.push(mkFinding(
      FINDING_CODES.REPEATED_POLICY_DENIALS,
      `Session contains ${denials.length} policy denial events (threshold: ${THRESHOLDS.REPEATED_DENIALS})`,
      {
        denial_count: denials.length,
        threshold:    THRESHOLDS.REPEATED_DENIALS,
        denied_tools: deniedTools,
      }
    ));
  }

  return { findings, warnings: [] };
}

/**
 * Rule 2 — Approval Without Follow-Through
 *
 * A tool.approval_granted event that has no corresponding tool.invocation for
 * the same tool within the same correlation scope is suspicious. Approval was
 * explicitly obtained but the tool was never called. This may indicate an
 * aborted attempt, a scripting error, or approval being obtained speculatively.
 *
 * Findings: approval_without_followthrough
 */
function checkApprovalWithoutFollowthrough(events) {
  const findings = [];

  const approvals = events.filter(e => e.event_type === 'tool.approval_granted');

  for (const approval of approvals) {
    const toolName = toolNameOf(approval);
    const cid = approval.correlation_id;

    const hasInvocation = events.some(e =>
      e.event_type === 'tool.invocation' &&
      toolNameOf(e) === toolName &&
      e.correlation_id === cid
    );

    if (!hasInvocation) {
      findings.push(mkFinding(
        FINDING_CODES.APPROVAL_WITHOUT_FOLLOWTHROUGH,
        `Approval granted for "${toolName}" but no corresponding tool.invocation found`,
        {
          tool_name:         toolName,
          approval_event_id: approval.event_id,
          correlation_id:    cid,
        }
      ));
    }
  }

  return { findings, warnings: [] };
}

/**
 * Rule 3 — Conflicting Control Outcomes
 *
 * When the same tool was denied in a session AND also invoked in the same
 * session with no approval evidence, the session contains contradictory policy
 * outcomes. This suggests either:
 *   - a policy bypass (tool was invoked without going through the approval gate)
 *   - a trace assembly issue (denial and invocation are from different paths)
 *
 * The normal approval flow (denied → approval_granted → invoked) is NOT flagged:
 * approval evidence makes the progression legitimate. Only denial + invocation
 * with no approval evidence for that tool triggers this finding.
 *
 * Findings: conflicting_control_outcomes
 */
function checkConflictingControlOutcomes(events) {
  const findings = [];

  const deniedToolNames = new Set(
    events
      .filter(e => e.event_type === 'tool.denial')
      .map(toolNameOf)
      .filter(Boolean)
  );

  for (const toolName of deniedToolNames) {
    const hasInvocation = events.some(
      e => e.event_type === 'tool.invocation' && toolNameOf(e) === toolName
    );
    const hasApproval = events.some(
      e => e.event_type === 'tool.approval_granted' && toolNameOf(e) === toolName
    );

    if (hasInvocation && !hasApproval) {
      const denialEvt     = events.find(e => e.event_type === 'tool.denial'     && toolNameOf(e) === toolName);
      const invocationEvt = events.find(e => e.event_type === 'tool.invocation' && toolNameOf(e) === toolName);

      findings.push(mkFinding(
        FINDING_CODES.CONFLICTING_CONTROL_OUTCOMES,
        `Tool "${toolName}" was both denied and invoked in this session with no approval evidence`,
        {
          tool_name:           toolName,
          denial_event_id:     denialEvt     ? denialEvt.event_id     : null,
          invocation_event_id: invocationEvt ? invocationEvt.event_id : null,
        }
      ));
    }
  }

  return { findings, warnings: [] };
}

/**
 * Rule 4 — Control-Event-Heavy Session
 *
 * A session where control events (denials + approvals) significantly outnumber
 * actual invocations is suspicious. It indicates the session spent more time
 * encountering policy gates than performing useful work, which may signal a
 * misconfigured caller, probing behavior, or an unusual workflow.
 *
 * Fires when:
 *   control_count >= THRESHOLDS.CONTROL_HEAVY_MIN
 *   AND control_count > invocation_count + THRESHOLDS.CONTROL_HEAVY_MARGIN
 *
 * Findings: control_event_heavy_session
 */
function checkControlEventHeavySession(events) {
  const findings = [];

  const denialCount     = events.filter(e => e.event_type === 'tool.denial').length;
  const approvalCount   = events.filter(e => e.event_type === 'tool.approval_granted').length;
  const invocationCount = events.filter(e => e.event_type === 'tool.invocation').length;
  const controlCount    = denialCount + approvalCount;

  if (
    controlCount >= THRESHOLDS.CONTROL_HEAVY_MIN &&
    controlCount > invocationCount + THRESHOLDS.CONTROL_HEAVY_MARGIN
  ) {
    findings.push(mkFinding(
      FINDING_CODES.CONTROL_EVENT_HEAVY_SESSION,
      `Session has ${controlCount} control events (${denialCount} denials, ${approvalCount} approvals) against ${invocationCount} invocations`,
      {
        denial_count:     denialCount,
        approval_count:   approvalCount,
        invocation_count: invocationCount,
        control_count:    controlCount,
      }
    ));
  }

  return { findings, warnings: [] };
}

/**
 * Rule 5 — Excessive Tool Activity
 *
 * A session with more than THRESHOLDS.EXCESSIVE_TOOL_ACTIVITY total tool events
 * (invocations + denials + approvals combined) is unusually active for a single
 * session. This may indicate runaway automation, a script looping unexpectedly,
 * or a session that should have been split across multiple workflows.
 *
 * Findings: excessive_tool_activity
 */
function checkExcessiveToolActivity(events) {
  const findings = [];

  const toolEvents = events.filter(e =>
    e.event_type === 'tool.invocation'       ||
    e.event_type === 'tool.denial'           ||
    e.event_type === 'tool.approval_granted'
  );

  if (toolEvents.length > THRESHOLDS.EXCESSIVE_TOOL_ACTIVITY) {
    findings.push(mkFinding(
      FINDING_CODES.EXCESSIVE_TOOL_ACTIVITY,
      `Session contains ${toolEvents.length} tool events (threshold: ${THRESHOLDS.EXCESSIVE_TOOL_ACTIVITY})`,
      {
        tool_event_count: toolEvents.length,
        threshold:        THRESHOLDS.EXCESSIVE_TOOL_ACTIVITY,
      }
    ));
  }

  return { findings, warnings: [] };
}

// ── Registered ruleset ────────────────────────────────────────────────────────

const RULES = [
  checkRepeatedDenials,
  checkApprovalWithoutFollowthrough,
  checkConflictingControlOutcomes,
  checkControlEventHeavySession,
  checkExcessiveToolActivity,
];

// ── Detector ──────────────────────────────────────────────────────────────────

/**
 * Evaluate a sequence of audit events for session anomalies.
 *
 * Intended to run on traces already considered complete and correlation-valid.
 * Can also be run independently; findings are meaningful even on partial traces.
 *
 * @param {object[]} events — array of audit event objects
 * @returns {{ anomalous: boolean, findings: object[], warnings: object[] }}
 */
function detect(events) {
  if (!Array.isArray(events)) {
    return {
      anomalous: true,
      findings: [mkFinding(
        FINDING_CODES.INVALID_INPUT,
        'events must be an array',
        { received: typeof events }
      )],
      warnings: [],
    };
  }

  const allFindings = [];
  const allWarnings = [];

  for (const rule of RULES) {
    const { findings, warnings } = rule(events);
    allFindings.push(...findings);
    allWarnings.push(...warnings);
  }

  return {
    anomalous: allFindings.length > 0,
    findings:  allFindings,
    warnings:  allWarnings,
  };
}

module.exports = {
  detect,
  FINDING_CODES,
  THRESHOLDS,
  // Export individual rules for targeted unit testing.
  checkRepeatedDenials,
  checkApprovalWithoutFollowthrough,
  checkConflictingControlOutcomes,
  checkControlEventHeavySession,
  checkExcessiveToolActivity,
};
