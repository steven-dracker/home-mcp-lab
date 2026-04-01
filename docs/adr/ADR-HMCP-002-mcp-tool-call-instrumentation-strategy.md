# ADR-HMCP-002 — MCP Tool Call Instrumentation Strategy

**Status:** Accepted  
**Date:** 2026-04-01  

---

## Context

The Home MCP Compliance Lab has defined a complete platform architecture — audit event schema, integration contract, instrumentation layer specification, event emitter integration pattern, and reference emitter design — but has zero implementation. No tool call events are emitted. No session lifecycle is tracked. Visibility gaps VG-HMCP-000002, VG-HMCP-000003, and VG-HMCP-000004 remain open, and VG-HMCP-000001 constrains what is possible with secret retrieval.

Three strategic questions have been unresolved and blocking Phase 2:

1. **Which instrumentation model governs how tool call events are emitted?** Three options were defined in `docs/architecture/event-emitter-integration-pattern.md`: native in-process emitter (Model A), sidecar/proxy (Model B), and agent-mediated emission (Model C). No selection has been made.

2. **What is the canonical event model for MCP tool calls?** The schema (`schemas/audit-event.schema.json`) defines structure. The instrumentation layer doc defines generation points. No single document defines the full semantic contract — which events are required, when, under what failure conditions, and with what correlation guarantees.

3. **What is the schema evolution strategy?** The audit event schema is at v0.2.0. No versioning or deprecation policy exists. As the platform adds event types, changes field semantics, or evolves instrumentation, there is no defined approach for managing schema change safely.

This ADR resolves all three questions. It is the gate for Phase 2 implementation. No instrumentation implementation work should begin before this decision is accepted.

### Constraints on the Decision

- **GitHub MCP server is external software.** It cannot be modified to add native emission. Model A (native in-process emitter) cannot be the primary Phase 2 approach unless a wrapping or injection mechanism is used. Model A remains viable for future platform-owned MCP servers.
- **The home lab has two nodes.** A sidecar/proxy infrastructure (Model B) adds operational complexity — proxy deployment, lifecycle management, correlation propagation through an additional layer — that exceeds current infrastructure maturity.
- **Claude Code is the agent.** It initiates every tool call. It has first-party visibility into every tool it calls, the tool name, the MCP server, and the call outcome. Agent-mediated emission (Model C) does not require any MCP server modification.
- **Phase 2 is a first implementation.** The goal is to move from zero events to observable events. The approach must be achievable, not optimal.

---

## Decision

### 1. Instrumentation Model: Agent-Mediated Emission (Model C) for Phase 2

The platform selects **Model C — Agent-Mediated Emission** as the approved instrumentation approach for Phase 2.

In this model, the agent (Claude Code) emits audit events for each tool call it initiates. Events are emitted at the agent layer — at the boundary where the agent dispatches a tool call and receives a result. The MCP server is not modified. No sidecar or proxy is deployed.

This decision is **Phase 2 scoped**. It is not a permanent architectural choice. Future phases may adopt Model A for platform-owned MCP servers or Model B for third-party servers where agent-layer fidelity is insufficient. This ADR governs Phase 2 only.

---

### 2. Canonical MCP Tool Call Event Model

A complete, observable tool call produces the following event sequence:

```
session.start
  └─ tool.invocation (dispatched)
  └─ tool.invocation (completed — success or failure)
  └─ tool.invocation (dispatched)
  └─ tool.invocation (completed — success or failure)
  ...
session.end
```

#### Required Events

**`session.start`** — emitted once per session, before any tool calls, at the moment the agent establishes an MCP session. This event is the authority for `correlation_id`. All subsequent events in the session carry this ID.

**`tool.invocation` (dispatched)** — emitted at the moment the agent dispatches a tool call to the MCP server. Establishes a record that the call was initiated. Status is `pending` at this point; if the schema does not define `pending`, a start-phase event is omitted until the schema adds it (see Schema Versioning below). Until `pending` is added, a single post-completion `tool.invocation` event is acceptable for Phase 2.

**`tool.invocation` (completed)** — emitted immediately after the agent receives a response from the MCP server, whether success or failure. This is the minimum required tool call event for Phase 2 compliance.

**`session.end`** — emitted once per session when the agent terminates the MCP session, whether by normal completion, error, or agent exit.

**`secret.retrieval`** — emitted when a secret retrieval is attempted and when the outcome is known. Phase 2 scope for this event type is constrained by VG-HMCP-000001 and VG-HMCP-000003 (see Gap Mapping below).

#### Required Fields for Every Event

All events must include the full required field set from `schemas/audit-event.schema.json`:

| Field | Source | Notes |
|---|---|---|
| `schema_version` | Emitter — platform-defined | Must match the current accepted schema version |
| `event_id` | Emitter — generated | UUID v4; unique per event, never reused |
| `event_type` | Emitter — mapped from action boundary | One of: `tool.invocation`, `secret.retrieval`, `session.start`, `session.end` |
| `timestamp` | Emitter — set at construction | UTC, ISO 8601; reflects actual event time, not signal time |
| `platform` | Emitter — fixed | Always `"home-mcp-lab"`; not configurable per project |
| `project_id` | Session context | Established at `session.start`; must be consistent across all events in the session |
| `agent_id` | Session context | Identifies the Claude Code session or agent instance; established at `session.start` |
| `mcp_server` | Session context | The MCP server the agent is connected to; established at `session.start` |
| `action` | Operational signal | Tool name for `tool.invocation`; session action for `session.start`/`session.end`; retrieval mechanism for `secret.retrieval` |
| `status` | Operational signal | `success` or `failure`; for start-phase events where outcome is not yet known, use the schema-defined pending convention when available |
| `correlation_id` | Correlation Context Provider | Generated at `session.start`; propagated to every event in the session; never regenerated mid-session |
| `metadata` | Operational context | Event-type-specific; must not contain secrets, credentials, tokens, or PII |

No required field may be null, omitted, or substituted with a placeholder. Events with missing required fields are rejected at the validation gate and recorded as emission failures.

#### Correlation Metadata Requirements

The `correlation_id` is the platform's primary mechanism for reconstructing session traces. Its behavior is governed by the following rules:

- **Generated once** — at `session.start` by the Correlation Context Provider; format is `sess-{date}-{context-slug}` where context-slug is a non-sensitive identifier (e.g., a CC-HMCP prompt ID)
- **Propagated without mutation** — every event within a session uses the exact `correlation_id` established at `session.start`; it must not be modified, truncated, or regenerated mid-session
- **Scoped to a session** — a `correlation_id` applies to exactly one session; it must not be reused across sessions
- **Multi-session workflows** — tasks spanning multiple sessions (e.g., a CC-HMCP prompt completed across two Claude Code sessions) use a shared task context identifier in `metadata.initiating_context`; they do not share a `correlation_id`
- **Orphan detection** — a `correlation_id` that appears in a `session.start` event but no subsequent `session.end` event, after a defined timeout window, is an incomplete session and a platform visibility gap

---

### 3. Distinction Between Events, Logs, and Metrics

The platform draws an explicit boundary between three observability mechanisms. They are not interchangeable:

**Audit Events** — structured, schema-conforming records of specific, significant actions at defined boundaries. Audit events are the unit of compliance observation. They flow through the platform ingestion workflow, are stored in the platform audit log, and are the evidence base for control evaluation and gap detection. Audit events are:
- Defined by `schemas/audit-event.schema.json`
- Emitted at specific action boundaries only (session lifecycle, tool invocations, secret retrievals)
- Immutable once submitted
- Required for compliance visibility

**Logs** — unstructured or lightly structured operational output from system processes. Logs are local to the emitting process and are not platform artifacts. They are used for debugging, failure investigation, and local state inspection. The Failure Observer's output is a log, not an audit event. Logs are:
- Not schema-governed by the platform
- Not part of the audit trail
- Not evidence for control evaluation
- Useful for diagnosing emission failures, not for asserting compliance

**Metrics** — aggregated numeric measurements of system behavior over time (counts, rates, durations, error percentages). Metrics are Prometheus/Grafana concerns — tracked by the observability stack on dude-ops-01. Metrics are:
- Derived from system operation, not from individual audit events
- Not part of the audit trail
- Useful for operational health monitoring
- Not a substitute for event-level compliance evidence

**Rule:** An action's compliance is established by its audit event, not by its presence in a log or its contribution to a metric. Logs and metrics do not satisfy audit requirements. Audit events do not replace structured operational logs.

---

### 4. Failure, Timeout, Retry, and Cancellation Semantics

The following defines how the instrumentation layer responds to abnormal conditions. These semantics apply under Model C (agent-mediated emission) and must be preserved in future model transitions.

#### Tool Call Failure

When a tool call fails (MCP server returns an error or exception):
- A `tool.invocation` event with `status: failure` is emitted immediately
- `metadata` must include a `failure_reason` field with a non-sensitive description of the failure
- `metadata` must not include raw error messages, stack traces, or API responses if they may contain sensitive data
- The audit event is emitted regardless of whether the agent retries the tool call

#### Tool Call Timeout

When a tool call times out before a response is received from the MCP server:
- A `tool.invocation` event with `status: failure` is emitted
- `metadata.failure_reason` must indicate timeout explicitly (e.g., `"tool_call_timed_out"`)
- If a start-phase event was emitted (pending), the timeout event closes the event pair
- If the agent subsequently receives a late response after a timeout, a second `tool.invocation` event with the actual outcome is emitted; both events carry the same `correlation_id` and the same tool invocation context

#### Tool Call Retry

When the agent retries a failed tool call:
- Each attempt produces its own `tool.invocation` event pair
- Retry attempts are not distinguished from first attempts at the event level
- If retry context is available, it may be recorded in `metadata` (e.g., `"attempt": 2`), but retry tracking is not required for Phase 2
- Events for retried calls carry the same `correlation_id` as all other events in the session

#### Tool Call Cancellation

When a tool call is cancelled by the agent before a response is received:
- A `tool.invocation` event with `status: failure` is emitted
- `metadata.failure_reason` must indicate cancellation (e.g., `"tool_call_cancelled_by_agent"`)
- Cancellation is treated as a failure for audit purposes; the call was initiated and did not complete successfully

#### Emission Failure

When the emitter fails to submit an event to the ingestion boundary:
- The operational action (tool call, session lifecycle) is not affected
- The failure is recorded by the Failure Observer to a local log
- The emitter retries delivery with bounded backoff (maximum three attempts with exponential backoff, not to exceed 10 seconds total)
- After exhausting retries, the event is recorded as lost in the local failure log
- The platform treats lost events as audit gaps; they are not reconstructed
- Reconstructed, retrospective, or fabricated events are not accepted by the ingestion boundary

#### Abnormal Session Termination

When an agent session terminates without emitting `session.end` (crash, kill, network loss):
- The platform detects the orphaned `correlation_id` via a timeout policy
- Timeout: a `session.start` with no corresponding `session.end` within 4 hours is an incomplete session
- Incomplete sessions are a platform visibility gap and are surfaced in gap detection
- The 4-hour timeout is configurable at the platform level, not per project

---

### 5. Instrumentation Boundaries

Instrumentation responsibility is allocated as follows, specifically for the agent-mediated model:

| Boundary | Responsible Party | Events Emitted |
|---|---|---|
| Agent initiates MCP session | Agent (Claude Code) | `session.start` |
| Agent dispatches tool call | Agent (Claude Code) | `tool.invocation` (start or single completion event) |
| Agent receives tool response | Agent (Claude Code) | `tool.invocation` (completion) |
| Agent terminates MCP session | Agent (Claude Code) | `session.end` |
| Secret retrieval is attempted | Calling process (agent or service) | `secret.retrieval` (attempt) |
| Secret retrieval result is received | Calling process (agent or service) | `secret.retrieval` (outcome) |

**What the MCP server does not own:** Under Model C, the MCP server emits no events. Instrumentation responsibility does not cross into the MCP server. This means events emitted by the agent cannot capture:
- Internal MCP server processing time accurately
- Failures that occur within the MCP server before returning to the agent
- MCP server resource consumption, queuing, or internal retries

These blind spots are acceptable for Phase 2 and are the known tradeoff of Model C. They are not visibility gaps — they are model tradeoffs. They would be closed by adopting Model A or B for specific servers in future phases.

**Instrumentation layer ownership:** The emitter logic (Emitter Boundary Adapter, Event Builder, Correlation Context Provider, Validation Gate, Emission Transport Adapter, Failure Observer) is platform-owned. Projects and agents use the emitter — they do not implement it. Under Model C, the emitter runs within the agent's execution context.

---

### 6. Schema and Versioning Strategy

The platform audit event schema (`schemas/audit-event.schema.json`) is a living artifact. The following rules govern its evolution:

#### Version Format

The schema uses semantic versioning (`MAJOR.MINOR.PATCH`):
- **MAJOR** — breaking change: a required field is removed, renamed, or its type changes; `event_type` enum values are removed; field semantics change in a way that makes old events uninterpretable under the new schema
- **MINOR** — additive change: a new optional field is added; a new `event_type` is added; `metadata` conventions for an existing type are extended without removing existing fields
- **PATCH** — non-structural change: description text updated, examples corrected, comments clarified; no field changes

#### Version Discipline

- The `schema_version` field in every emitted event must match the schema version the emitter was built against
- Ingestion boundary must accept events at the current schema version and at the immediately prior MAJOR version during a defined migration window
- After the migration window expires, events at deprecated schema versions are rejected
- Migration windows are defined per MAJOR version increment; duration is at the architect's discretion and must be documented in the ADR that introduces the breaking change

#### Additive-First Rule

Schema changes must prefer additive extension over breaking change. If a new observability requirement can be met by adding an optional `metadata` field, that is strongly preferred over adding a new required top-level field. Required field additions are breaking changes and must go through a MAJOR version increment with migration planning.

#### Current Version

Schema v0.2.0 is the accepted baseline for Phase 2 instrumentation. It includes `tool.invocation`, `secret.retrieval`, `session.start`, and `session.end`. No breaking changes are planned for Phase 2.

The `pending` status value for start-phase `tool.invocation` events is not in v0.2.0. Phase 2 instrumentation will emit single post-completion `tool.invocation` events until a MINOR schema update adds `pending` as a recognized status. Adding `pending` is an additive change; it does not require a MAJOR version increment.

---

### 7. Relationship Between Persisted Workflow State and Emitted Telemetry

The platform uses two persistence mechanisms that are distinct and must not be conflated:

**Persisted workflow state** — documents, artifacts, commit history, handoffs, ADRs, and the CLAUDE.md boot block. These record what work was done, decisions made, and the current state of the platform. This state is human-authored and human-maintained. It is the durable record of architectural intent.

**Emitted telemetry** — audit events that flow through the ingestion workflow and are stored in the platform audit log. These record what the system did at runtime: which tools were called, in which sessions, with which outcomes. This state is machine-generated at action boundaries.

These two mechanisms serve different purposes and answer different questions:

| Question | Source |
|---|---|
| What decision was made? | Persisted workflow state (ADR, doc) |
| What was done in a session? | Emitted telemetry (audit events) |
| Is a feature implemented? | Persisted workflow state (code, artifact) |
| Did a tool call succeed? | Emitted telemetry (tool.invocation event) |
| What is the current platform phase? | Persisted workflow state (handoff, CLAUDE.md) |
| How long did a session last? | Emitted telemetry (session.start + session.end timestamps) |
| What work is planned? | Persisted workflow state (handoff, backlog) |
| Were there audit gaps? | Emitted telemetry (gap detection on correlation IDs) |

**Linking the two:** A CC-HMCP prompt ID may appear in both. It is written into `metadata.initiating_context` of `session.start` events so the audit trail can be traced back to the specific task that generated the session. This is the designed link between workflow state and telemetry — it does not merge the two mechanisms, it connects them for traceability.

**Telemetry does not substitute for documentation.** An audit event confirming a tool was called is not a record of architectural intent. Conversely, a handoff document is not evidence that a tool call succeeded. Each mechanism is authoritative for its own domain.

---

## Gap Mapping

This ADR directly addresses the following known visibility gaps:

**VG-HMCP-000002 — MCP Tool Invocation Visibility**  
*Status after this ADR: Unblocked for Phase 2 implementation.*  
Model C selection provides a concrete instrumentation approach for `tool.invocation` events. The agent-layer emitter can begin emitting for every tool call dispatched by Claude Code. The gap cannot be closed without implementation, but the blocking decision is now made.

**VG-HMCP-000004 — MCP Session Lifecycle Visibility**  
*Status after this ADR: Unblocked for Phase 2 implementation.*  
`session.start` and `session.end` event types are defined in schema v0.2.0 (added in CC-HMCP-000003B). Model C assigns session lifecycle emission to the agent layer. The gap is implementable under this ADR.

**VG-HMCP-000003 — GitHub PAT Retrieval Path Visibility**  
*Status after this ADR: Partially addressed.*  
`secret.retrieval` event structure is defined. The instrumentation boundary for agent-mediated secret retrieval is defined here. However, the actual retrieval path for the GitHub MCP server's PAT has not been inspected (VG-HMCP-000003 remains operationally uninvestigated). Phase 2 `secret.retrieval` instrumentation depends on that investigation.

**VG-HMCP-000001 — Keeper Non-Interactive Secret Retrieval**  
*Status after this ADR: Not addressed.*  
This gap is a prerequisite constraint on `secret.retrieval` instrumentation in service contexts. This ADR does not resolve it. Closing VG-HMCP-000001 is a separate workstream. Phase 2 `secret.retrieval` events in interactive (CLI) contexts are not blocked by this gap; service-context retrieval events are.

---

## Explicitly Prohibited

The following are architectural violations under this ADR:

- **Emitting audit events from MCP server business logic under Model C** — Under the agent-mediated model, the MCP server emits no events. Instrumentation is at the agent layer only. Adding event emission inside an MCP server's tool handlers without a future ADR authorizing Model A or B is a violation.

- **Using logs as a substitute for audit events** — A tool call appearing in a local log does not satisfy the audit event requirement. Compliance visibility requires schema-conforming events through the ingestion workflow.

- **Emitting reconstructed or retrospective events** — Events must be generated at actual action boundaries. Creating audit events after the fact from logs, memory, or handoff documents is not permitted and will be rejected at ingestion.

- **Defining a project-specific `correlation_id` scheme** — Correlation IDs are generated by the Correlation Context Provider at session start. Projects and agents must not independently generate or substitute their own identifiers.

- **Treating emitter failure as a blocking condition** — An emission failure must never cause a tool call, session, or secret retrieval to fail. The operational action proceeds; the emission failure is recorded by the Failure Observer.

- **Schema version mismatch in emitted events** — Events must declare the schema version they conform to. Emitting events with an incorrect or missing `schema_version` is a validation failure and the event will be rejected.

- **Including sensitive values in any event field** — No credential, token, key, password, or raw secret value may appear in any field of any emitted event, including `metadata`. This applies even in error and failure context.

---

## Rationale

**Model C selected for Phase 2 because the constraints make it the only practical option.** The GitHub MCP server is external software — it cannot be modified. A proxy infrastructure (Model B) exceeds current home lab maturity and adds an operational dependency that is not yet justified. Model C (agent-mediated) imposes no MCP server changes, leverages existing agent-layer visibility, and can be implemented immediately. Its known tradeoffs — reduced server-side fidelity, dependence on agent-layer discipline — are acceptable for Phase 2 in a home lab context.

**A single canonical event model prevents drift.** Without a decision on the event model, each future implementation will interpret the schema differently. This ADR defines which events are required, when they are emitted, what correlation guarantees apply, and how failures are handled. This creates a single target for all instrumentation work.

**Events, logs, and metrics must be distinct to preserve compliance semantics.** If logs are treated as audit evidence, compliance posture becomes unmeasurable — any log line could be claimed as evidence of anything. The distinction is not pedantic; it determines what counts as observable behavior for compliance purposes.

**Additive-first schema evolution prevents coordination failures.** The platform integrates multiple projects. A breaking schema change requires all integrated projects to update simultaneously or operate with version mismatches. Additive-first evolution means new requirements can be added without forcing coordinated redeployment. Breaking changes require an explicit MAJOR version increment with a documented migration window.

**Linking workflow state to telemetry via `initiating_context` preserves traceability without merging mechanisms.** The CC-HMCP prompt ID in `session.start.metadata.initiating_context` allows an audit reader to trace from a runtime event back to the architect's intent, without collapsing the distinction between decision records and runtime observations.

---

## Consequences

### Positive

- **Phase 2 implementation is unblocked** — Model C, the event model, failure semantics, and schema versioning are all defined. Implementation can begin.
- **Consistent instrumentation target** — all Phase 2 instrumentation work builds against the same semantic contract; there is no room for divergent interpretation
- **Schema evolution is safe** — additive-first rule and MAJOR/MINOR/PATCH policy prevent silent schema breakage and ensure ingestion compatibility across versions
- **Audit trail is reconstructable** — the `correlation_id` lifecycle and session event pairing enable complete session trace reconstruction from the audit log
- **VG-HMCP-000002 and VG-HMCP-000004 are unblocked** — the blocking architectural decision is made; implementation can close these gaps

### Negative / Tradeoffs

- **Model C has reduced server-side fidelity** — agent-emitted events do not capture MCP server internals: internal latency, server-side errors before agent notification, resource consumption. This is the primary tradeoff of the Phase 2 approach.
- **Agent discipline is required** — Model C depends on every agent session correctly emitting all required events. A session that emits no events because the emitter was not invoked creates a complete audit gap with no platform-side detection until the session timeout window elapses.
- **`pending` status requires a schema update before start-phase events can be emitted** — Phase 2 tool call events are single post-completion events until the schema adds `pending`. This means tool calls that never complete cannot produce an event until the schema is updated.
- **Model C does not scale to all future MCP server types** — as the platform adds servers with higher risk profiles or where agent-layer fidelity is insufficient, Model A or B will be required. This ADR governs Phase 2 only; future ADRs must revisit the model selection as the platform evolves.

### Debugging and Replayability

The event model defined here enables the following debugging capabilities once implemented:

- **Session trace reconstruction** — all events for a session can be retrieved by `correlation_id`; the complete sequence of tool calls, outcomes, and timing is available from the audit log
- **Duration analysis** — start and end events at both the session and tool call level enable latency profiling and identification of slow or hung operations
- **Failure attribution** — `tool.invocation` events with `status: failure` and `metadata.failure_reason` enable root cause investigation without requiring log access
- **Cross-session task correlation** — `metadata.initiating_context` linking multiple sessions to a single CC-HMCP prompt ID enables end-to-end task trace reconstruction across session boundaries
- **Gap detection** — incomplete sessions (no `session.end`), missing events, and emission failures surfaced by the Failure Observer enable the platform to identify and report audit coverage gaps

Events are immutable once submitted. They cannot be modified, backdated, or replayed. Replay in the sense of re-emitting past events is not supported. Replay in the sense of querying the audit log to reconstruct what happened in a past session is the expected debugging workflow.

---

## Alternatives Considered

**Model A — Native In-Process Emitter (deferred, not rejected)**  
A platform-provided emitter component embedded within the MCP server process. Rejected for Phase 2 because the primary target (GitHub MCP server) is external software that cannot be modified. Model A remains the preferred long-term approach for platform-owned MCP servers and should be revisited in a future ADR when such a server is built.

**Model B — Sidecar / Proxy Emission Boundary (deferred, not rejected)**  
A platform-owned proxy intercepts all MCP tool calls at the transport layer. Rejected for Phase 2 because deploying and maintaining a proxy alongside each MCP server exceeds current infrastructure maturity. Model B is the preferred long-term approach for external MCP servers at higher risk profiles and should be revisited in a future ADR when infrastructure is ready to support it.

**Unified event-log model (rejected)**  
Using structured logs as both operational records and audit evidence. Rejected because logs lack the schema governance, immutability guarantees, and ingestion workflow required for compliance. Mixing these mechanisms creates false confidence in compliance coverage and makes it impossible to distinguish operational noise from audit-relevant events.

**Metrics-as-evidence (rejected)**  
Using Prometheus counters of tool calls as compliance evidence. Rejected because metrics are aggregated, lossy, and cannot establish the per-event provenance required for audit. A counter of 10 tool calls cannot say which tools were called, in which session, with which outcome, by which agent.

---
