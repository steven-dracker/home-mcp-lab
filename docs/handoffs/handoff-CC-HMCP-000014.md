# Handoff — 2026-04-07 / CC-HMCP-000014

## Current System State

- **Last Completed Task:** CC-HMCP-000014 — Session Anomaly Detection (TD-HMCP-000001)
- **Current Phase:** Detection Layer — three-layer audit trust model (completeness, integrity, anomaly) complete
- **Active Branch:** `feature/cc-hmcp-000014-session-anomaly-detection`
- **PR Status:** PR #69 open — pending merge at time of writing
- **Main Branch:** clean through PR #68 (CC-HMCP-000013 — Correlation Integrity Checks)

---

## Completed Work (This Session)

### CC-HMCP-000011 — Approval-Required Tool Execution (PR #66, merged)

- `src/policy/policy-gate.js` — extended with Tier 2 enforcement: HIGH + allowed_by_default=false tools require explicit approval signal; new reason values `requires_approval` / `approved`; decision shape includes `approvalRequired`, `approvalSatisfied`, `approvalMechanism`
- `src/emitter/event-builder.js` — added `buildToolApprovalGrantedEvent`; extended `buildToolDenialEvent` with `approval_required` metadata
- `src/emitter/index.js` — wired `approvalGranted` into `checkAndEnforcePolicy`; emits `tool.approval_granted` on approved path
- `schemas/audit-event.schema.json` — added `tool.approval_granted` event type; updated `tool.denial` definition
- `tests/validate-approval-gate.js` — 24 tests (all pass)
- `tests/validate-policy-gate.js` — updated `merge_pull_request` test to reflect approval-required behavior
- `docs/controls/approval-required-tool-execution.md` — full control documentation

### CC-HMCP-000012 — Event Completeness Validation (PR #67, merged)

- `src/detection/event-completeness-validator.js` — five-rule pure validator; `validate(events)` → `{ complete, issues, warnings }`; exports `ISSUE_CODES` and rule functions
- `tests/validate-event-completeness.js` — 33 tests (all pass)
- `docs/detection/event-completeness-validation.md`

### CC-HMCP-000013 — Correlation Integrity Checks (PR #68, merged)

- `src/detection/correlation-integrity-validator.js` — four-rule pure validator; `validate(events)` → `{ valid, issues, warnings }`; exports `ISSUE_CODES` and rule functions
- `tests/validate-correlation-integrity.js` — 38 tests (all pass)
- `docs/detection/correlation-integrity-checks.md`

### CC-HMCP-000014 — Session Anomaly Detection (PR #69, open)

- `src/detection/session-anomaly-detector.js` — five-rule pure detector; `detect(events)` → `{ anomalous, findings, warnings }`; exports `FINDING_CODES`, `THRESHOLDS`, and rule functions
- `tests/validate-session-anomaly-detection.js` — 39 tests (all pass)
- `docs/detection/session-anomaly-detection.md`

**Regression validation at CC-HMCP-000014 completion:**
- validate-session-anomaly-detection.js: 39/39
- validate-event-completeness.js: 33/33
- validate-correlation-integrity.js: 38/38
- validate-approval-gate.js: 24/24
- validate-policy-gate.js: 21/21

---

## Current Detection Model

Three independent, complementary layers in `src/detection/`:

| Layer | Module | Entry | Result Key | Question Answered |
|---|---|---|---|---|
| Completeness | `event-completeness-validator.js` | `validate(events)` | `complete: boolean` | Are the expected event types present? |
| Integrity | `correlation-integrity-validator.js` | `validate(events)` | `valid: boolean` | Are events correctly linked via correlation_id? |
| Anomaly | `session-anomaly-detector.js` | `detect(events)` | `anomalous: boolean` | Does the session's behavioral pattern look suspicious? |

All three layers are independent. A trace can be complete and integrity-valid but still anomalous. Run all three for full audit trust. All result shapes include an `issues`/`findings` array and a `warnings` array. All export stable code constants and individual rule functions for targeted testing.

Intended sequence: run completeness first, then integrity, then anomaly on traces that pass the first two layers. Anomaly detector can also be run independently.

---

## Current Behavior

### Anomaly Rules

**Rule 1 — repeated_policy_denials**
- Fires when: `tool.denial` count ≥ `THRESHOLDS.REPEATED_DENIALS` (3)
- Context: denial_count, threshold, denied_tools (unique tool names)
- Normal expectation: 0–1 denials per session

**Rule 2 — approval_without_followthrough**
- Fires when: `tool.approval_granted` exists for tool T with no matching `tool.invocation` for the same tool AND same `correlation_id`
- Context: tool_name, approval_event_id, correlation_id
- Note: the normal approval-path flow (denial → approval → invocation) is not flagged — a matching invocation is present

**Rule 3 — conflicting_control_outcomes**
- Fires when: the same tool has a `tool.denial` AND a `tool.invocation` with no `tool.approval_granted` for that tool
- Context: tool_name, denial_event_id, invocation_event_id
- Normal approval flow (denial + approval + invocation) is NOT flagged — approval evidence makes the progression legitimate

**Rule 4 — control_event_heavy_session**
- Fires when: `(denials + approvals) >= THRESHOLDS.CONTROL_HEAVY_MIN (3)` AND `(denials + approvals) > invocations + THRESHOLDS.CONTROL_HEAVY_MARGIN (2)`
- Context: denial_count, approval_count, invocation_count, control_count
- Example: 3 denials + 0 invocations → fires; 3 denials + 1 invocation → 3 > 1+2=3 is false → does not fire; 4 denials + 1 invocation → fires

**Rule 5 — excessive_tool_activity**
- Fires when: total tool events (invocations + denials + approvals) > `THRESHOLDS.EXCESSIVE_TOOL_ACTIVITY` (50)
- session.start and session.end are NOT counted
- Context: tool_event_count, threshold

### Approval Gate Mechanism (CTRL-HMCP-000003)

Satisfaction: `approvalGranted: true` in context passed to `checkAndEnforcePolicy`, OR `HMCP_APPROVAL_GRANTED=true` env var.

Current approval-required tools: `merge_pull_request` (HIGH + allowed_by_default=false).

Destructive override (tier 1): `allowDestructive: true` in context, OR `HMCP_ALLOW_DESTRUCTIVE=true` env var.

Current destructive tools: `delete_branch` (DESTRUCTIVE + allowed_by_default=false).

---

## Known Limitations / Deferred Items

- **No statistical baselining:** All anomaly thresholds are fixed constants. No per-agent, per-project, or historical adaptation.
- **Single-session scope only:** The anomaly detector evaluates one trace at a time. Multi-session trend analysis (e.g., repeated denials from the same agent across multiple sessions) is deferred.
- **Timestamp ordering not validated:** Rules check for presence of events, not chronological sequence. `approval_without_followthrough` does not verify the approval appeared before the invocation in time.
- **Warnings reserved but unused:** All three detection modules include a `warnings` array in results; it is always empty currently. Reserved for future advisory findings.
- **Pre-existing transport test failures:** `tests/validate-mcp-transport.js` has 8 pre-existing failures because `@modelcontextprotocol/sdk` is not installed on the current machine. These are unrelated to all control/detection work and have been present since before this session.
- **VG-HMCP-000003 still open:** Live validation of `secret.retrieval` event emission on dude-mcp-01 with `EVENT_INGESTION_URL` set has not yet been performed.

---

## Relevant Open Backlog

- **TD-HMCP-000002 — Max tool calls per session:** Natural extension of the anomaly detector. Would formalize the `excessive_tool_activity` rule or introduce a separate per-session cap enforced at the policy layer rather than just detected.
- **CTRL-HMCP-000004 — Secret usage frequency monitoring:** Track how often secret retrieval is attempted per session/agent; flag unusual concentrations. Builds on the existing `secret.retrieval` event type.
- **CTRL-HMCP-000005 — Secret context binding:** Ensure secrets are only retrieved in appropriate contexts (e.g., right project, right agent, right execution mode). Requires context fields that may need schema extension.
- **TD-HMCP-000005 — Sequence-based control verification:** Validate that events appear in expected orders (e.g., approval precedes invocation chronologically). Extends the integrity validator with timestamp ordering rules.
- **VG-HMCP-000003 — Live end-to-end validation:** Verify `secret.retrieval` and policy events are correctly received by the ingestion server on dude-mcp-01 under real conditions.

---

## Recommended Next Task

**TD-HMCP-000002 — Max tool calls per session**

Reasoning: It is the most direct extension of the work just completed. The anomaly detector's `excessive_tool_activity` rule already detects high activity at session end; formalizing a session-level cap as a control (not just a detection) would add enforcement to the detection layer. It is narrow, deterministic, and builds on the same event model without requiring schema changes.

---

## Resume Instructions

1. **Merge PR #69** if not yet merged: `gh pr merge 69 --squash` or via GitHub UI
2. `git checkout main && git pull origin main`
3. Verify the detection modules are present on main: `src/detection/session-anomaly-detector.js`, `src/detection/event-completeness-validator.js`, `src/detection/correlation-integrity-validator.js`
4. Create a new feature branch: `git checkout -b feature/cc-hmcp-000015-<task-name>`
5. Do not rely on the boot block (`CLAUDE.md`) for current state — it is stale. This handoff is authoritative.
6. GitHub merged state on `main` is canonical. The handoff captures dynamic state at session boundary.
7. Pre-existing test failures in `tests/validate-mcp-transport.js` (8 failures) are unrelated to all control and detection work — note separately if encountered.
