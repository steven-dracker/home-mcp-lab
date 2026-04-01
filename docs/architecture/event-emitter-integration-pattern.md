# Event Emitter Integration Pattern — Home MCP Compliance Lab

**Status:** Draft  
**Date:** 2026-03-31  

---

## Summary

This document defines the event emitter integration pattern for the Home MCP Compliance Lab. It describes how projects and MCP servers emit platform-conforming audit events without violating the platform vs project separation established in ADR-HMCP-001. It defines emitter responsibilities, platform responsibilities, allowed integration models, and explicit anti-patterns.

---

## Purpose

The platform has defined:
- what events must look like (`schemas/audit-event.schema.json`)
- how events flow after emission (`docs/workflows/audit-event-ingestion.md`)
- where instrumentation responsibilities exist (`docs/architecture/instrumentation-layer.md`)

What remained undefined is the integration seam itself: how a real project or MCP server participates in event emission without absorbing platform compliance logic into its own codebase. This document defines that seam.

---

## Problem Statement

Projects and MCP servers must emit audit events to satisfy the integration contract. However:

- The platform owns compliance logic and audit policy — projects must not embed these
- Projects own their business logic and tool behavior — the platform must not absorb these
- Without a defined integration seam, projects will solve this inconsistently — each embedding its own interpretation of platform requirements

The result without this pattern: compliance logic duplicated across projects, diverging from the platform over time, creating the exact drift ADR-HMCP-001 was written to prevent.

The event emitter integration pattern defines the narrow boundary at which projects participate in platform observability without crossing into platform ownership territory.

---

## Design Goals

1. **Preserve platform vs project separation** — projects emit operational facts; the platform owns compliance semantics
2. **Make emission straightforward** — integrated projects must be able to participate without deeply understanding platform internals
3. **Enforce schema conformance** — all emitted events must be structurally valid; conformance is checked at the platform boundary, not duplicated in each project
4. **Avoid compliance logic duplication** — no project should implement its own audit policy, schema validation, or control logic
5. **Support implementation flexibility** — the pattern must not mandate a specific technology or transport so the platform can evolve its implementation without forcing project changes
6. **Fail safely** — emission failures must not compromise primary operational behavior

---

## Integration Pattern Overview

The core pattern:

```
[Project / MCP Server]
        |
        | emits operational facts at action boundaries
        |
[Emitter Seam]  ← narrow integration boundary
        |
        | produces schema-conforming platform audit events
        |
[Platform Ingestion Boundary]
        |
        | validates, stores, processes
        |
[Platform Audit Log]
```

Projects and MCP servers are responsible for **what happened** — the operational facts at the boundary of each significant action (tool called, secret retrieved, session started).

The emitter seam translates those operational facts into schema-conforming platform audit events. The seam may be implemented as a library, a proxy, an agent convention, or another mechanism — but it must be platform-owned or platform-defined, not independently implemented by each project.

Projects do not construct raw audit events directly in business logic. They signal at action boundaries; the seam constructs the event.

---

## Emitter Responsibilities

Projects and MCP servers acting as event emitters must:

- **Signal at required action boundaries** — notify the emitter seam at session start, session end, tool invocation start, tool invocation completion, tool invocation failure, and secret retrieval attempt/outcome
- **Provide required context** — supply non-sensitive operational context at each signal point: tool name, agent identity, project identity, correlation ID, action outcome
- **Propagate correlation context** — carry the `correlation_id` established at session start through all signals within that session
- **Avoid sensitive data** — never pass secrets, credentials, tokens, or PII to the emitter seam; context passed must be non-sensitive
- **Signal non-blocking** — the primary operation must not wait on or depend on successful event emission
- **Not implement compliance logic** — emitters must not decide whether an action is compliant, validate events against schema, or duplicate platform policy rules

---

## Platform Responsibilities

The platform must:

- **Define the event schema** — `schemas/audit-event.schema.json` is the authoritative event structure; projects reference it, they do not define it
- **Define control expectations** — CTRL-HMCP-* patterns define what compliant behavior looks like; projects align to these, they do not author them
- **Define the integration pattern** — this document; projects follow it, they do not independently devise their own emission strategies
- **Own the emitter seam** — the mechanism that translates project signals into platform-conforming events is platform-owned; it must not be re-implemented by each project
- **Validate at the ingestion boundary** — schema conformance is enforced by the platform upon receipt; projects do not need to replicate this validation
- **Define failure expectations** — what happens when emission fails is a platform concern; projects implement non-blocking signaling, the platform defines the handling

---

## Allowed Integration Models

Three conceptual integration models are recognized. The platform has not selected a model — that decision requires an ADR. All three are valid at this stage.

### Model A — Native In-Process Emitter

**Description:** The MCP server or agent includes a platform-provided emitter component that runs within the same process. The emitter component handles event construction, schema conformance, and submission to the ingestion boundary.

**Strengths:**
- Low latency between action and event emission
- No external process dependency
- Correlation context is naturally available in-process

**Tradeoffs:**
- Requires the emitter component to be integrated into each MCP server
- Updates to the emitter component require redeployment of the MCP server
- Risk of business logic and emitter logic becoming entangled over time

---

### Model B — Sidecar / Proxy Emission Boundary

**Description:** A platform-owned sidecar or proxy process intercepts all MCP tool calls at the transport layer and emits audit events on behalf of the MCP server without modifying the server itself.

**Strengths:**
- No changes required to MCP server code
- Platform controls the emitter entirely; projects have no implementation responsibility
- Emitter logic can be updated independently of MCP server deployments

**Tradeoffs:**
- Introduces a network hop or inter-process communication dependency
- Proxy must be deployed and maintained alongside each MCP server
- Correlation context (session IDs) must be propagated through the proxy layer, which adds complexity

---

### Model C — Agent-Mediated Emission

**Description:** The agent (Claude Code or equivalent) emits audit events for tool calls it initiates, based on its own visibility into tool invocation boundaries. The MCP server is not modified.

**Strengths:**
- No changes required to MCP server code
- Agent has natural visibility into session start/end and tool call sequence
- Correlation context is inherently available at the agent layer

**Tradeoffs:**
- Emission accuracy depends on agent-layer fidelity — the agent may not capture all failure modes at the MCP server
- Agent-emitted events are one step removed from the actual tool execution boundary
- Requires agent-layer implementation discipline across all agent types

---

## Recommended Boundary Pattern

Regardless of which integration model is selected, the architectural boundary must observe the following:

**Projects own:** operational action signals — the facts of what happened at each action boundary  
**Platform owns:** event contract, compliance semantics, and the emitter seam that produces conforming events

At the emitter boundary:

```
Project code signals:
  "tool X was called with non-sensitive context Y, result was Z"

Emitter seam produces:
  { event_type: "tool.invocation", action: "X", metadata: { ... Y ... }, status: "Z", ... }
```

Platform compliance logic — schema validation, field enforcement, control evaluation — must not cross into project code. Project code must not cross into platform event construction beyond providing the signal.

The emitter seam is the only point where operational facts become platform audit events. It must be narrow, well-defined, and platform-governed.

---

## Event Construction Requirements

Events constructed at the emitter seam must:

- Conform to `schemas/audit-event.schema.json` in structure and field types
- Include all required top-level fields: `schema_version`, `event_id`, `event_type`, `timestamp`, `platform`, `project_id`, `agent_id`, `mcp_server`, `action`, `status`, `correlation_id`, `metadata`
- Use a recognized `event_type` value from the platform taxonomy (`tool.invocation`, `secret.retrieval`, `session.start`, `session.end`)
- Set `platform` to `"home-mcp-lab"` — this must not be configurable per project
- Assign a unique `event_id` per event (recommended: UUID v4)
- Use an ISO 8601 UTC timestamp
- Include only non-sensitive, non-PII context in `metadata`
- Be constructed deterministically — the same action under the same conditions must produce structurally equivalent events

Events must not:
- Include secret values, credentials, tokens, or PII in any field
- Use event types not defined in the platform schema
- Omit required fields or substitute null for required identity fields

---

## Emission Timing Requirements

Events must be emitted at the following action boundaries, aligned with the instrumentation layer definition:

| Action Boundary | Event Type | Timing |
|---|---|---|
| Agent initiates MCP session | `session.start` | Before any tool calls are made |
| MCP tool call begins | `tool.invocation` | At the moment the tool call is dispatched |
| MCP tool call completes (success) | `tool.invocation` | Immediately after successful completion |
| MCP tool call completes (failure) | `tool.invocation` | Immediately after error or failure response |
| Secret retrieval is attempted | `secret.retrieval` | At the moment retrieval is initiated |
| Secret retrieval completes | `secret.retrieval` | Immediately after retrieval outcome is known |
| Agent closes or exits MCP session | `session.end` | At session termination, whether clean or error |

Events must be emitted in real-time or near-real-time. Retrospective or reconstructed event emission is not permitted — only events generated at actual action boundaries are valid audit records.

---

## Correlation and Context Rules

- **`correlation_id` is generated once per session** — at `session.start` by the agent or instrumentation layer
- **`correlation_id` must propagate** to every `tool.invocation`, `secret.retrieval`, and `session.end` event within that session
- **`correlation_id` must not be reused** across sessions; each session must have a unique correlation identifier
- **Emitters must not generate their own `correlation_id`** for individual tool calls — they receive it from the session context established at `session.start`
- **Multi-session workflows** may reference a higher-level task identifier (e.g., a CC-HMCP prompt ID) in `metadata` to link related sessions without conflating their correlation scopes
- **Context must be carried forward** — `project_id`, `agent_id`, and `mcp_server` must remain consistent across all events within a session

---

## Failure and Non-Blocking Requirements

- **Emission must be non-blocking** — the tool call, secret retrieval, or session operation must not wait on successful event emission and must not fail if emission fails
- **Business operation correctness must not depend on emission success** — a tool call that succeeds must be reported as success regardless of whether the audit event was successfully emitted
- **Emitter failures must be observable** — when emission fails, the failure must be logged locally; if possible, a failure signal must reach the platform for gap detection
- **No silent downgrade** — if the emitter seam fails, it must fail observably, not silently fall back to an unconfigured or unlogged state
- **Event loss must be acknowledged** — the platform accepts that emission failures will result in audit gaps; these gaps must surface in the platform's gap detection layer, not be hidden behind retry logic that blocks operations

---

## Security and Data Handling Rules

- **No secrets in event payloads** — no credential, token, key, password, or secret value may appear in any event field, including `metadata`
- **No sensitive credential material in metadata** — `metadata` must contain only operational context sufficient to identify the action; raw arguments, API responses, and file contents must not be included if they may contain sensitive data
- **Minimal necessary context** — emitters must include the minimum context required to make the event useful; over-capturing is a risk surface
- **Platform control requirements apply** — CTRL-HMCP-000001 governs secret retrieval behavior; `secret.retrieval` events must align with its requirements and must never inadvertently document a policy violation in a way that exposes the secret value
- **Emitter identity** — the emitter seam must be identifiable to the ingestion boundary; unauthorized event injection must not be possible (mechanism to be defined in a future ADR)

---

## Anti-Patterns

The following are explicitly prohibited integration patterns:

**Embedding compliance policy logic in project business code**
Projects must not implement their own audit policy rules, decide which actions require events, or encode platform control semantics inside MCP server tool handlers. These belong to the platform.

**Emitting ad hoc events outside the platform schema**
Projects must not emit events in custom formats, using custom field names, or with event types not defined in `schemas/audit-event.schema.json`. Non-conforming events are rejected at ingestion and create audit gaps.

**Logging secret values in any event field**
Including a secret, token, credential, or key in any event field — including in error messages or failure context in `metadata` — is a critical violation. There is no circumstance where a secret value belongs in an audit event.

**Tying business operation correctness to successful event emission**
A tool call must not fail because the audit event could not be emitted. Coupling operational correctness to audit success inverts the relationship between business behavior and observability and creates pressure to disable or skip emission when it causes failures.

**Duplicating platform validation logic in project code**
Projects must not implement their own schema validation, field enforcement, or event conformance checking. Validation belongs to the platform ingestion boundary. Duplicating it in projects creates inconsistent enforcement and false confidence.

**Using a project-specific correlation ID scheme**
Projects must not generate their own `correlation_id` values independently of the session context. Correlation IDs are a platform-scoped session construct, not a project-specific identifier.

**Batching events across session boundaries**
Events must be emitted at action time, not collected and submitted in bulk at session end. Batching breaks timing semantics, prevents real-time gap detection, and makes audit trail reconstruction unreliable.

---

## Relationship to Existing Artifacts

| Artifact | Relationship |
|---|---|
| ADR-HMCP-001 | Establishes the platform vs project boundary that this pattern enforces at the emission layer |
| CTRL-HMCP-000001 | Defines secret retrieval behavior that `secret.retrieval` events must align with |
| `schemas/audit-event.schema.json` | The authoritative event structure all emitters must conform to |
| `docs/workflows/audit-event-ingestion.md` | Defines what happens at and after the ingestion boundary — downstream of this pattern |
| `docs/architecture/instrumentation-layer.md` | Defines where events are generated — this pattern defines how projects participate in that generation |
| `docs/architecture/project-integration-contract.md` | Requires projects to emit conforming events — this pattern defines how that requirement is fulfilled |

---

## Open Questions

1. Which integration model (A, B, or C) should be selected as the platform-approved approach? This requires an ADR.
2. Should the emitter seam be provided as a platform artifact (library, binary, or configuration) or defined as a behavioral convention that projects implement using platform guidance?
3. How should emitter identity be established at the ingestion boundary to prevent unauthorized event injection?
4. What is the expected handling when a project signals at an action boundary but the emitter seam is unavailable — should the project queue the signal locally, drop it, or log and continue?
5. How should the platform communicate updates to the event schema or emission requirements to integrated projects without forcing coordinated redeployment?

---

## Future Evolution

- **Phase 1 (current):** Pattern defined; no emitter implementation; projects understand what is expected
- **Phase 2:** ADR selects integration model; emitter seam approach decided; first reference implementation designed
- **Phase 3:** Emitter seam implemented for at least one MCP server (GitHub MCP); `tool.invocation` and `session.*` events begin flowing
- **Phase 4:** Emitter conformance validation added at ingestion; non-conforming events are rejected with structured failure signals
- **Phase 5:** Integration conformance checks available per project; platform can report which projects are emitting correctly and which have gaps
- **Phase 6:** Emitter SDK or adapter published as a platform artifact; new project integrations use it as the standard starting point

---
