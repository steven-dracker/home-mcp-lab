# Session Anomaly Detection — TD-HMCP-000001

## Purpose

The session anomaly detector examines a session trace and identifies behavioral patterns that are unusual or suspicious according to explicit, deterministic rules.

This is not a statistical or machine-learning anomaly engine. It is a first detection layer — rule-based, auditable, and narrowly scoped. Every finding is the result of an explicit condition that a human can read, understand, and verify.

The anomaly detector answers the question:

> "Given these events, does this session's behavior look suspicious according to the platform's current rules?"

---

## Relationship to Completeness and Integrity Validators

The three detection layers are independent and complementary:

| Layer | Module | Result | Checks |
|---|---|---|---|
| Completeness | `event-completeness-validator` | `complete: boolean` | Are expected event types present? |
| Integrity | `correlation-integrity-validator` | `valid: boolean` | Are events correctly linked via `correlation_id`? |
| Anomaly (this) | `session-anomaly-detector` | `anomalous: boolean` | Does the session's behavioral pattern look suspicious? |

A trace can be complete and integrity-valid but still anomalous. For example: all required events are present, all `correlation_id`s are consistent, but the session contains ten denied actions — that is structurally fine but behaviorally suspicious.

**Intended usage:** run the anomaly detector on traces that are already sufficiently complete and correlation-valid. Running it on structurally broken traces may produce findings that reflect structural problems rather than behavioral ones, which can be misleading. The anomaly detector can also be run independently — findings are meaningful on partial traces.

---

## What Session Anomaly Detection Checks

Five rules are evaluated:

### Rule 1 — Repeated Policy Denials

A session with `≥ 3` `tool.denial` events indicates unusual concentration of blocked actions. In normal operation a session has zero or one denial. Multiple denials suggest repeated attempts against a blocked tool, a misconfigured caller, or probing behavior.

Threshold: `THRESHOLDS.REPEATED_DENIALS = 3`
Finding code: `repeated_policy_denials`

---

### Rule 2 — Approval Without Follow-Through

A `tool.approval_granted` event with no corresponding `tool.invocation` for the same tool and `correlation_id` means approval was explicitly obtained but the tool was never called. This may indicate an aborted attempt, a scripting error, or approval being obtained speculatively.

Finding code: `approval_without_followthrough`

---

### Rule 3 — Conflicting Control Outcomes

When the same tool was denied in a session AND also invoked in the same session with no `tool.approval_granted` evidence, the session contains contradictory policy outcomes. This suggests either a policy bypass (tool invoked without going through the approval gate) or a trace assembly problem.

The normal approval flow — `tool.denial` (requires_approval) → `tool.approval_granted` → `tool.invocation` — is **not** flagged. Approval evidence makes the progression legitimate. Only denial + invocation with no approval for that tool triggers this finding.

Finding code: `conflicting_control_outcomes`

---

### Rule 4 — Control-Event-Heavy Session

A session where control events (denials + approvals) significantly outnumber actual invocations indicates the session spent more time encountering policy gates than performing useful work. This may signal a misconfigured caller, probing behavior, or an unusual workflow.

Fires when: `control_count >= 3` AND `control_count > invocation_count + 2`

Thresholds: `THRESHOLDS.CONTROL_HEAVY_MIN = 3`, `THRESHOLDS.CONTROL_HEAVY_MARGIN = 2`
Finding code: `control_event_heavy_session`

---

### Rule 5 — Excessive Tool Activity

A session with more than `50` total tool events (invocations + denials + approvals combined) is unusually active for a single session. This may indicate runaway automation, a looping script, or a session that should have been split into multiple workflows.

Session framing events (`session.start`, `session.end`) are not counted.
Threshold: `THRESHOLDS.EXCESSIVE_TOOL_ACTIVITY = 50`
Finding code: `excessive_tool_activity`

---

## What Session Anomaly Detection Is NOT Checking

This detector does not:

- **Use statistics or machine learning** — all rules are explicit conditions; no baselining or scoring
- **Compare across sessions** — each trace is evaluated independently; no multi-session trend analysis
- **Check event presence or linkage** — structural completeness and correlation integrity are the responsibility of the other validators
- **Apply real-time alerting** — the detector returns findings; routing and alerting are out of scope
- **Validate field integrity** — missing fields or invalid event formats are the completeness validator's responsibility
- **Detect all possible anomalies** — only the five rules above are currently implemented

---

## Detection Rules Summary

| Rule | Finding Code | Trigger Condition |
|---|---|---|
| Repeated denials | `repeated_policy_denials` | ≥ 3 `tool.denial` events in trace |
| Approval without follow-through | `approval_without_followthrough` | `tool.approval_granted` with no matching `tool.invocation` (same tool, same `correlation_id`) |
| Conflicting control outcomes | `conflicting_control_outcomes` | Same tool denied AND invoked with no `tool.approval_granted` |
| Control-event-heavy session | `control_event_heavy_session` | (denials + approvals) ≥ 3 AND > invocations + 2 |
| Excessive tool activity | `excessive_tool_activity` | Total tool events > 50 |
| Invalid input | `invalid_input` | Input is not an array |

---

## Detector Result Shape

```js
const { detect } = require('./src/detection/session-anomaly-detector');
const result = detect(events);
```

```json
{
  "anomalous": true,
  "findings": [
    {
      "code": "repeated_policy_denials",
      "message": "Session contains 4 policy denial events (threshold: 3)",
      "context": {
        "denial_count": 4,
        "threshold": 3,
        "denied_tools": ["delete_branch"]
      }
    }
  ],
  "warnings": []
}
```

- `anomalous: true` — one or more findings; session behavior is suspicious according to current rules
- `anomalous: false` — no findings; session behavior is within expected parameters
- `findings` — each finding has a stable `code`, human-readable `message`, and optional `context`
- `warnings` — advisory findings (reserved; currently empty)

---

## Stable Finding Codes and Thresholds

```js
const { FINDING_CODES, THRESHOLDS } = require('./src/detection/session-anomaly-detector');
```

| Constant | Code |
|---|---|
| `INVALID_INPUT` | `invalid_input` |
| `REPEATED_POLICY_DENIALS` | `repeated_policy_denials` |
| `APPROVAL_WITHOUT_FOLLOWTHROUGH` | `approval_without_followthrough` |
| `CONFLICTING_CONTROL_OUTCOMES` | `conflicting_control_outcomes` |
| `CONTROL_EVENT_HEAVY_SESSION` | `control_event_heavy_session` |
| `EXCESSIVE_TOOL_ACTIVITY` | `excessive_tool_activity` |

| Threshold | Value | Applies To |
|---|---|---|
| `REPEATED_DENIALS` | 3 | Minimum denial count to trigger `repeated_policy_denials` |
| `CONTROL_HEAVY_MIN` | 3 | Minimum control events before `control_event_heavy_session` can fire |
| `CONTROL_HEAVY_MARGIN` | 2 | Required excess of control events over invocations |
| `EXCESSIVE_TOOL_ACTIVITY` | 50 | Maximum tool events before `excessive_tool_activity` fires |

---

## How This Supports Future Work

### Expanded Rule Set

New rules can be added as new `RULES` entries following the same `(events) → { findings, warnings }` pattern. Existing rules are unaffected. Candidates for future rules include:

- secret retrieval anomalies (multiple retrieval failures, unusual retrieval mechanisms)
- session duration anomalies (unusually long or short sessions, if timestamps are used)
- tool sequence anomalies (unexpected ordering of tool calls within a session)
- approval obtained for a tool not present in the tool registry

### Higher-Level Audit Validation

A composable `auditTrace(events)` function could run all three detection layers (completeness, integrity, anomaly) and return a unified result. The three modules use compatible structural patterns (`{ findings/issues, warnings }` rule shape, stable code constants) and can be combined cleanly.

### Multi-Session Analysis

Once the platform supports multi-session trace decomposition (grouping events by `correlation_id`), the anomaly detector can be applied per-session to a batch of sessions, and cross-session patterns (e.g., repeated denials from the same agent across sessions) can be detected at a higher layer.

---

## Module Location

```
src/detection/session-anomaly-detector.js
```

Tests: `tests/validate-session-anomaly-detection.js`
