# Event Completeness Validation — TD-HMCP-000003

## Purpose

The event completeness validator examines a sequence of audit events and determines whether the trace is complete enough to be trustworthy — that is, whether the events represent a valid, audit-grade record of what occurred.

Completeness validation answers the question:

> "Given this set of events, is the audit record complete, or are there gaps that indicate something is missing?"

This is the first step toward audit trust. Without completeness guarantees, downstream consumers (anomaly detection, compliance reporting, incident review) cannot reliably interpret a trace.

---

## What Completeness Validation Is Checking

The validator evaluates five rule groups:

### Rule 1 — Field Integrity

Every audit event must contain all required top-level fields as defined in `schemas/audit-event.schema.json`:

`event_id`, `event_type`, `timestamp`, `correlation_id`, `project_id`, `agent_id`, `mcp_server`, `action`, `status`, `metadata`

An event missing any of these fields cannot be fully interpreted by the platform or downstream consumers.

Issue code: `missing_required_field`

---

### Rule 2 — Session Coverage

A complete session trace must be framed by start and end events:

- If session-activity events are present (`tool.invocation`, `tool.denial`, `tool.approval_granted`, `secret.retrieval`), a `session.start` event must exist.
- If `session.start` is present, a `session.end` event must also be present.

A trace without session framing cannot be correlated to a session lifecycle and cannot be verified as complete.

Issue codes: `missing_session_start`, `missing_session_end`

---

### Rule 3 — Correlation Consistency

When a trace contains exactly one `session.start` and one `session.end`, both must share the same `correlation_id`. If they differ, the end event belongs to a different session than the start event, indicating a corrupted or mis-assembled trace.

Issue code: `inconsistent_session_correlation`

---

### Rule 4 — Approval Path Completeness

A `tool.approval_granted` event signals that approval was explicitly satisfied for a tool. If the tool is approved but never invoked, the trace is incomplete — either the invocation was not recorded, or something prevented execution after approval.

Every `tool.approval_granted` event must have a corresponding `tool.invocation` event for the same tool and same `correlation_id`.

Issue code: `approval_without_invocation`

---

### Rule 5 — Approval Evidence for Invocations

Tools that require approval before execution (`risk_level=HIGH`, `allowed_by_default=false` in `config/tool-classifications.json`) must have a `tool.approval_granted` event in the trace before their `tool.invocation`. An invocation without prior approval evidence indicates the approval gate may have been bypassed or the approval event was not captured.

Currently approval-required tools: `merge_pull_request`

Issue code: `missing_approval_evidence`

---

## What Completeness Validation Is NOT Checking

This validator does not:

- **Detect behavioral anomalies** — it does not flag unusual call sequences, abnormal volumes, or suspicious patterns. That is future work.
- **Verify semantic correctness** — it does not check whether tool arguments were appropriate or whether outcomes were expected.
- **Enforce ordering within a session** — events are checked for presence, not strict sequence (except approval → invocation pairing).
- **Validate multi-session traces** — the validator is designed for a single-session trace. Multi-session traces are outside the current scope.
- **Check timestamp ordering** — events are not validated for chronological consistency.
- **Verify external state** — it does not cross-reference event data against the GitHub API or other external systems.

---

## Completeness Rules Summary

| Rule | Issue Code | Trigger Condition |
|---|---|---|
| Field integrity | `missing_required_field` | Required field absent or empty on any event |
| Session coverage | `missing_session_start` | Session-activity events present, no `session.start` |
| Session coverage | `missing_session_end` | `session.start` present, no `session.end` |
| Correlation consistency | `inconsistent_session_correlation` | `session.start` and `session.end` have different `correlation_id` |
| Approval path | `approval_without_invocation` | `tool.approval_granted` with no matching `tool.invocation` |
| Approval evidence | `missing_approval_evidence` | `tool.invocation` for approval-required tool with no `tool.approval_granted` |
| Invalid input | `invalid_input` | Input is not an array |

---

## Validator Result Shape

```js
const { validate } = require('./src/detection/event-completeness-validator');
const result = validate(events);
```

```json
{
  "complete": false,
  "issues": [
    {
      "code": "missing_session_end",
      "message": "Trace contains session.start but no session.end event",
      "context": {
        "correlation_id": "sess-20260407-abc123"
      }
    }
  ],
  "warnings": []
}
```

- `complete: true` — no issues found; trace is audit-complete per current rules
- `complete: false` — one or more issues found; trace should not be trusted as complete
- `issues` — completeness failures; each issue has a stable `code`, human-readable `message`, and optional `context`
- `warnings` — advisory findings (reserved for future use; currently empty)

---

## Stable Issue Codes

Issue codes are exported as `ISSUE_CODES` from the validator module for use by downstream consumers:

```js
const { ISSUE_CODES } = require('./src/detection/event-completeness-validator');
// ISSUE_CODES.MISSING_SESSION_START === 'missing_session_start'
```

| Constant | Code |
|---|---|
| `INVALID_INPUT` | `invalid_input` |
| `MISSING_REQUIRED_FIELD` | `missing_required_field` |
| `MISSING_SESSION_START` | `missing_session_start` |
| `MISSING_SESSION_END` | `missing_session_end` |
| `INCONSISTENT_SESSION_CORRELATION` | `inconsistent_session_correlation` |
| `APPROVAL_WITHOUT_INVOCATION` | `approval_without_invocation` |
| `MISSING_APPROVAL_EVIDENCE` | `missing_approval_evidence` |

---

## How This Supports Future Work

### Anomaly Detection

Completeness validation is a prerequisite for anomaly detection. A trace cannot be analyzed for behavioral anomalies until it is known to be structurally complete. Future anomaly detection rules will rely on the completeness validator as a pre-filter.

### Audit Trust

Compliance reporting and incident review require a guarantee that the event record is complete. The `complete: true` result provides a machine-readable signal that a trace meets the minimum bar for audit use.

### Sequence-Based Control Verification

Future rules can extend the validator to check event ordering (e.g., "approval must precede invocation chronologically") and sequence patterns (e.g., "session must end within N minutes of last activity").

### Correlation Integrity

Future rules can extend correlation checking to verify that all tool events within a session share the session's `correlation_id`, not just the start/end events.

---

## Relationship to Platform Controls

| Component | Role |
|---|---|
| `CTRL-HMCP-000001` | Provides risk classifications used by Rule 5 (approval evidence check) |
| `CTRL-HMCP-000002` | Produces `tool.denial` events; denial sessions are valid complete traces |
| `CTRL-HMCP-000003` | Produces `tool.approval_granted` events; approval paths validated by Rules 4 and 5 |
| `TD-HMCP-000003` (this) | Validates that the events produced by the above controls are complete |

---

## Module Location

```
src/detection/event-completeness-validator.js
```

Tests: `tests/validate-event-completeness.js`
