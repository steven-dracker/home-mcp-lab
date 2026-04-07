# Correlation Integrity Checks — TD-HMCP-000004

## Purpose

The correlation integrity validator examines a sequence of audit events and determines whether correlation linkage is internally consistent — that is, whether events that should be bound together through `correlation_id` actually are.

Correlation integrity answers the question:

> "Are the events in this trace correctly linked to each other, or has the correlation context been broken, mixed, or lost?"

A trace can be structurally complete (all required event types present) but correlation-invalid (those events cannot be reliably tied together). Both dimensions are needed before a trace can be treated as trustworthy audit evidence.

---

## Relationship to Event Completeness Validation

These are two distinct, complementary validators:

| Validator | Checks | Result Field |
|---|---|---|
| `event-completeness-validator` | Are the expected event types present? (session.start, session.end, approval evidence, required fields) | `complete: boolean` |
| `correlation-integrity-validator` (this) | Are the events that exist correctly linked through correlation_id? | `valid: boolean` |

A trace can fail one without failing the other:

- **Complete but integrity-invalid:** all required events present, but a denial event has a different `correlation_id` than the session — the events can't be reliably linked.
- **Integrity-valid but incomplete:** consistent `correlation_id` throughout, but `session.end` is missing — the session was not properly closed.

Both validators should be run together for full audit trust. A higher-level audit validation layer can compose both results.

---

## What Correlation Integrity Checks

Four rules are evaluated:

### Rule 1 — Correlation Presence

Every event must carry a non-empty `correlation_id`. An event without one cannot be attributed to any session or execution path and is not trustworthy as audit evidence.

Issue code: `missing_correlation_id`

---

### Rule 2 — Session Activity Alignment

When a trace contains exactly one `session.start` event, all session-activity events (`tool.invocation`, `tool.denial`, `tool.approval_granted`, `secret.retrieval`) must share the same `correlation_id` as that `session.start`.

An activity event with a different `correlation_id` cannot be attributed to the session — it is either from a different session or is orphaned.

Scope: applies only when the trace has exactly one `session.start`. Traces with zero or multiple `session.start` events are outside the scope of this rule (handled by other rules or by multi-session decomposition, which is a deferred capability).

Issue code: `inconsistent_correlation_id`

---

### Rule 3 — Trace Context Consistency

A trace is expected to represent a single correlation context (one session). If the number of distinct `correlation_id` values in the trace exceeds the number of `session.start` events, events from incompatible contexts have been mixed into the same trace.

Formula: `distinct_correlation_ids > session_start_count` → conflicting context.

Two `session.start` events with two distinct `correlation_id`s is not flagged — that represents a valid two-session trace. One `session.start` with two distinct IDs is flagged.

Issue code: `conflicting_trace_context`

---

### Rule 4 — Unlinked Control Events

A `tool.denial` or `tool.approval_granted` event is "unlinked" when its `correlation_id` is not shared by any other event in the trace, and the trace contains more than one event.

An unlinked control event cannot be attributed to any execution path. This indicates either that the event was captured in the wrong trace, or that the other events in its execution path were not captured.

Single-event traces are exempt: a lone denial or approval event with a valid `correlation_id` is a valid isolated audit record.

Issue codes: `unlinked_denial_event`, `unlinked_approval_event`

---

## What Correlation Integrity Is NOT Checking

This validator does not:

- **Check event type presence** — it does not verify that `session.start`, `session.end`, or approval events exist. That is the completeness validator's responsibility.
- **Validate timestamp ordering** — events are not checked for chronological consistency within a session.
- **Detect behavioral anomalies** — it does not flag unusual correlation patterns or access sequences. That is future work.
- **Handle multi-session traces** — the validator is designed for single-session traces. Multi-session grouping by `correlation_id` is a deferred capability.
- **Check correlation_id format** — it checks for presence and consistency, not adherence to a specific format (e.g., UUID, prefix pattern).

---

## Validation Rules Summary

| Rule | Issue Code | Trigger Condition |
|---|---|---|
| Correlation presence | `missing_correlation_id` | Event has null or empty `correlation_id` |
| Session activity alignment | `inconsistent_correlation_id` | Activity event's `correlation_id` differs from `session.start`'s (single-session trace) |
| Trace context consistency | `conflicting_trace_context` | Distinct `correlation_id` count exceeds `session.start` count |
| Unlinked control events | `unlinked_denial_event` | `tool.denial` CID not shared by any other event (multi-event trace) |
| Unlinked control events | `unlinked_approval_event` | `tool.approval_granted` CID not shared by any other event (multi-event trace) |
| Invalid input | `invalid_input` | Input is not an array |

---

## Validator Result Shape

```js
const { validate } = require('./src/detection/correlation-integrity-validator');
const result = validate(events);
```

```json
{
  "valid": false,
  "issues": [
    {
      "code": "inconsistent_correlation_id",
      "message": "Event correlation_id \"sess-bbb\" does not match session correlation_id \"sess-aaa\"",
      "context": {
        "event_id": "evt-002",
        "event_type": "tool.denial",
        "tool_name": "delete_branch",
        "event_correlation_id": "sess-bbb",
        "session_correlation_id": "sess-aaa"
      }
    }
  ],
  "warnings": []
}
```

- `valid: true` — no issues found; correlation linkage is trustworthy
- `valid: false` — one or more issues found; correlation linkage cannot be trusted
- `issues` — integrity failures; each has a stable `code`, human-readable `message`, and optional `context`
- `warnings` — advisory findings (reserved; currently empty)

---

## Stable Issue Codes

```js
const { ISSUE_CODES } = require('./src/detection/correlation-integrity-validator');
// ISSUE_CODES.MISSING_CORRELATION_ID === 'missing_correlation_id'
```

| Constant | Code |
|---|---|
| `INVALID_INPUT` | `invalid_input` |
| `MISSING_CORRELATION_ID` | `missing_correlation_id` |
| `INCONSISTENT_CORRELATION_ID` | `inconsistent_correlation_id` |
| `CONFLICTING_TRACE_CONTEXT` | `conflicting_trace_context` |
| `UNLINKED_DENIAL_EVENT` | `unlinked_denial_event` |
| `UNLINKED_APPROVAL_EVENT` | `unlinked_approval_event` |

---

## How This Supports Future Work

### Combined Audit Validation

A higher-level `validateTrace(events)` function could run both the completeness and integrity validators, combining their issues into a single audit trust result. The two validators are designed to compose cleanly — they share the same `{ issues, warnings }` rule return structure and stable `ISSUE_CODES` patterns.

### Sequence Validation

Rule 2 (session activity alignment) and Rule 4 (unlinked control events) establish the correlation linkage required for future sequence-based checks. Once correlation is trusted, validators can begin reasoning about event ordering (e.g., "approval must precede invocation") without first having to solve the attribution problem.

### Anomaly Detection

Correlation integrity is a prerequisite for anomaly detection. An anomaly detector needs to group events by session before identifying unusual patterns. The correlation integrity validator provides the assurance that the grouping is valid.

### Multi-Session Grouping

Rule 3 (trace context consistency) is designed to flag single-session traces that contain multiple correlation contexts. A future multi-session trace decomposer could split such traces by `correlation_id`, run each sub-trace through the validators independently, and aggregate results.

---

## Relationship to Platform Controls

| Component | Role |
|---|---|
| `CTRL-HMCP-000002` | Produces `tool.denial` events; denial correlation integrity validated by Rules 2 and 4 |
| `CTRL-HMCP-000003` | Produces `tool.approval_granted` events; approval correlation integrity validated by Rules 2 and 4 |
| `TD-HMCP-000003` (completeness) | Validates event presence; complements this validator |
| `TD-HMCP-000004` (this) | Validates correlation linkage; complements completeness validation |

---

## Module Location

```
src/detection/correlation-integrity-validator.js
```

Tests: `tests/validate-correlation-integrity.js`
