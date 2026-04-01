# Reference Event Emitter Design — Home MCP Compliance Lab

**Status:** Draft  
**Date:** 2026-03-31  

---

## Summary

This document defines the reference implementation design for platform-conforming audit event emission in the Home MCP Compliance Lab. It translates the event emitter integration pattern into a concrete blueprint — defining logical components, data flow, validation behavior, failure handling, and configuration expectations — without writing production code or selecting final transport technology.

This is a reference design. It is not yet a mandated implementation. It is not yet a code artifact. It is the target shape that a real implementation should conform to.

---

## Purpose

The event emitter integration pattern (`docs/architecture/event-emitter-integration-pattern.md`) defines what an emitter must do and what separation it must preserve. This document answers the next question:

> If we were to build a conforming emitter today, what would its internal structure look like?

The reference design provides enough detail to guide a real implementation without over-specifying technology choices that remain open. It is also the baseline against which future implementations will be evaluated for conformance.

---

## Design Scope

This design covers:
- Logical components of a conforming event emitter
- Data flow from operational signal to submitted audit event
- Validation, correlation, failure, and configuration behavior at the design level

This design does not cover:
- Production code in any language or framework
- Transport protocol or API definition
- Deployment topology or infrastructure
- Final selection of integration model (native, sidecar, agent-mediated — see `docs/architecture/event-emitter-integration-pattern.md`)

---

## Design Goals

1. **Platform vs project separation** — the emitter must be the only place where operational signals become platform audit events; project business logic must not contain event construction logic
2. **Reusability** — the design must apply to any MCP server integration, not be specific to one project or tool
3. **Deterministic event production** — the same operational signal under the same conditions must produce structurally identical events
4. **Schema conformance** — all output events must be valid against `schemas/audit-event.schema.json` before submission
5. **Non-blocking behavior** — event emission must never block or fail the primary operational action
6. **Minimal sensitive data exposure** — the design must structurally prevent sensitive values from entering event payloads

---

## Reference Emitter Overview

The reference emitter is a logical component set that sits at the integration seam between:

```
[Project / MCP Server]   →   [Emitter]   →   [Platform Ingestion Boundary]
  operational signals         blueprint         validated audit events
```

The emitter receives signals from the project at action boundaries. It constructs, validates, and submits platform-conforming audit events. It handles failures non-blockingly. The project knows nothing about platform event structure; the platform ingestion boundary knows nothing about project internals.

The emitter is the only place these two concerns meet. Its surface area must be kept narrow.

---

## Core Components

### 1. Signal Source

**Responsibility:** The operational entry point — the project or MCP server code that raises a signal when a significant action boundary is crossed (tool call begins, secret retrieval is attempted, session starts, etc.).

**Boundaries:**
- Owned by the project or MCP server
- Provides only non-sensitive operational facts: action name, agent identity, project identity, outcome
- Must not construct events or know anything about platform schema
- Calls into the Emitter Boundary Adapter at each action point

---

### 2. Emitter Boundary Adapter

**Responsibility:** Receives signals from the Signal Source and translates them into internal emitter representations. The first platform-owned component in the chain.

**Boundaries:**
- Accepts signals in a project-friendly form (named parameters, simple structs)
- Maps signal fields to internal emitter data model
- Retrieves correlation context from the Correlation Context Provider
- Does not validate schema — passes to Event Builder
- Decouples project signal shape from platform event structure

---

### 3. Event Builder

**Responsibility:** Constructs a fully-formed, schema-conforming audit event from the internal emitter representation.

**Boundaries:**
- Maps internal representation to `schemas/audit-event.schema.json` field structure
- Enforces required field presence; fails hard if required fields cannot be populated
- Normalizes `event_type` to the platform taxonomy
- Sets `platform` to `"home-mcp-lab"` — not configurable per project
- Generates a unique `event_id` (UUID v4)
- Applies UTC ISO 8601 timestamp
- Enforces that `metadata` contains only non-sensitive values; any field matching sensitive data patterns is stripped or causes the event to be rejected
- Produces deterministic output — same signal, same context → same event shape

---

### 4. Correlation Context Provider

**Responsibility:** Manages the `correlation_id` lifecycle for the current session. The authoritative source for correlation context within the emitter.

**Boundaries:**
- Generates and stores the `correlation_id` at `session.start` signal time
- Supplies `correlation_id` to the Event Builder for every subsequent event in the session
- Clears or archives the `correlation_id` at `session.end` signal time
- Must not generate a new `correlation_id` for individual tool calls — only at session boundaries
- Provides additional context fields: `agent_id`, `project_id`, `mcp_server` — consistent for the duration of the session

---

### 5. Validation Gate

**Responsibility:** Validates the constructed event against platform schema and content rules before it is submitted to the emission interface.

**Boundaries:**
- Checks all required fields are present and non-null
- Checks `event_type` is a recognized platform value
- Checks `status` is `success` or `failure`
- Checks `timestamp` is a valid ISO 8601 date-time
- Checks `metadata` does not contain probable secret patterns
- Checks `event_id` is present and non-empty
- Passes valid events to the Emission Transport Adapter
- Rejects invalid events — passes them to the Failure Observer; does not emit them
- Must not silently mutate a rejected event into a "valid enough" state; rejection is hard

---

### 6. Emission Transport Adapter

**Responsibility:** Accepts validated events and delivers them to the platform ingestion boundary. The transport boundary — decouples event construction from submission mechanics.

**Boundaries:**
- Receives only validated, schema-conforming events
- Submits events to the configured ingestion target
- Implements retry with bounded backoff on transient failures
- Reports persistent delivery failures to the Failure Observer
- Does not know anything about event structure or content — treats events as opaque payloads
- Transport implementation is replaceable without affecting upstream components

---

### 7. Failure Observer / Local Error Recorder

**Responsibility:** Captures and records emitter failures — validation rejections, delivery failures, signal processing errors — without propagating them to the operational action.

**Boundaries:**
- Receives failure notifications from all other components
- Records failures to a local log or error stream
- Does not throw exceptions or return errors to the Signal Source
- Does not affect the outcome of the operational action
- Provides a local audit of emission failures so the platform can later detect gaps

---

## Signal-to-Event Flow

```
1. OPERATIONAL ACTION OCCURS
   Tool is called, secret is retrieved, session starts or ends.

2. SIGNAL IS RAISED
   Signal Source calls into the Emitter Boundary Adapter with operational facts:
   action name, outcome, non-sensitive context, agent/project identity.

3. CORRELATION CONTEXT IS ATTACHED
   Emitter Boundary Adapter requests correlation context from the
   Correlation Context Provider. The current session's correlation_id,
   agent_id, project_id, and mcp_server are attached to the signal representation.

4. EVENT IS CONSTRUCTED
   Event Builder maps the enriched signal representation to a
   schema-conforming audit event. Required fields are populated.
   Sensitive data patterns in metadata are stripped or cause rejection.
   A unique event_id and UTC timestamp are assigned.

5. EVENT IS VALIDATED
   Validation Gate checks the constructed event against platform rules.
   - If valid: passes to Emission Transport Adapter
   - If invalid: passes to Failure Observer; flow ends here for this event

6. EVENT IS SUBMITTED
   Emission Transport Adapter delivers the validated event to the
   platform ingestion boundary. If delivery fails transiently, retry
   with bounded backoff. If delivery fails persistently, report to
   Failure Observer.

7. FAILURES ARE RECORDED NON-BLOCKINGLY
   Any failure at any step is reported to the Failure Observer and
   recorded locally. The operational action is not affected. The
   Signal Source receives no failure notification.
```

---

## Event Builder Responsibilities

The Event Builder is the core compliance component of the emitter. Its behavior must be strictly defined:

- **Field mapping is canonical** — the mapping from signal fields to schema fields is defined by the platform, not by individual projects
- **Required fields are enforced** — if a required field cannot be populated from the signal and context, the event is rejected before reaching the Validation Gate
- **`event_type` is normalized** — the Event Builder maps action boundary names to platform taxonomy values; projects do not select `event_type` directly
- **`platform` is hardcoded** — `"home-mcp-lab"` is set by the Event Builder; it is not a configurable project value
- **`event_id` is generated** — UUID v4, not provided by the signal source
- **`timestamp` is set at construction time** — UTC ISO 8601, not provided by the signal source
- **Sensitive data is blocked** — the Event Builder applies pattern checks to `metadata` values; any field matching token, key, password, or credential patterns causes the event to be rejected or the field to be stripped, depending on configured sensitivity policy
- **Output is deterministic** — given the same signal and context, the Event Builder produces the same event structure; no randomness beyond `event_id` generation

---

## Validation Responsibilities

The Validation Gate is a hard gate — events that fail validation are not emitted. It must not be bypassed.

Validation checks:
1. All required top-level fields are present and non-null
2. `event_type` is in the platform-recognized set
3. `status` is `"success"` or `"failure"`
4. `timestamp` is parseable as ISO 8601 date-time
5. `platform` equals `"home-mcp-lab"`
6. `event_id` is non-empty
7. `metadata` does not contain fields matching probable secret patterns
8. `schema_version` is present

Validation must not:
- Silently mutate invalid events into "close enough" events
- Remove required fields to make an event pass
- Allow invalid `event_type` values through on a best-effort basis

Validation failure is recorded by the Failure Observer. It is not surfaced to the Signal Source.

---

## Correlation Context Handling

- **`correlation_id` is generated once at `session.start`** by the Correlation Context Provider
- The generated ID is stored in the provider for the duration of the session
- Every subsequent event in the session retrieves this ID from the provider — it does not re-generate
- At `session.end`, the provider archives the ID and prepares to accept a new session
- **Projects do not provide `correlation_id`** — it comes from the provider, not from the Signal Source
- **`agent_id`, `project_id`, `mcp_server`** are set at session start and remain consistent for all events within the session — the provider stores and supplies these
- If a signal arrives outside a session context (no active `correlation_id`), the emitter must treat this as an error condition, record it via the Failure Observer, and not emit the event

---

## Emission Interface

The Emission Interface is the narrow contract between the Validation Gate and the Emission Transport Adapter:

- Accepts a single, validated, schema-conforming audit event
- Does not accept batches across session boundaries
- Does not expose transport-specific configuration to upstream components
- Returns a delivery result (success or failure) to the Emission Transport Adapter's internal retry logic
- The Failure Observer is notified of persistent delivery failures; no failure propagates upstream

The emission interface is intentionally narrow so that the transport implementation can be replaced (different queue, different endpoint, different protocol) without any changes to Event Builder, Validation Gate, or Signal Source.

---

## Failure Handling Model

| Failure Type | Handling | Upstream Impact |
|---|---|---|
| Signal processing error (bad input from Signal Source) | Log to Failure Observer; discard signal | None — Signal Source is not notified |
| Required context missing (no active session, missing agent_id) | Log to Failure Observer; reject event | None |
| Event Builder rejection (required field cannot be populated) | Log to Failure Observer; do not pass to Validation Gate | None |
| Validation Gate rejection (event fails schema checks) | Log to Failure Observer; do not pass to Transport Adapter | None |
| Transport delivery failure (transient) | Retry with bounded backoff | None — operational action is complete |
| Transport delivery failure (persistent) | Log to Failure Observer as lost event | None |
| Sensitive data detected in metadata | Reject event or strip field; log to Failure Observer | None |

**Invariant:** No failure in the emitter propagates to the operational action. The tool call, secret retrieval, or session operation must complete independently of emitter state.

---

## Configuration Model

The emitter requires a minimal set of configuration values established at initialization. These are conceptual — not file formats or environment variables.

| Configuration Value | Description | Mutability |
|---|---|---|
| Platform identifier | Always `"home-mcp-lab"` | Fixed; not configurable per project |
| Project identifier | The project's registered ID (e.g., `"erate-workbench"`) | Set at emitter initialization; constant per deployment |
| Emitter enabled/disabled | Whether the emitter is active; disabled mode logs locally but does not submit | Configurable per environment |
| Environment context | Describes the execution environment (e.g., `"service"`, `"cli"`) | Set at initialization; informs `metadata` fields |
| Emission target abstraction | An opaque reference to the ingestion boundary (not a URL or endpoint at this level) | Provided by platform configuration; not project-defined |

Projects do not configure compliance semantics — they configure only operational identity (project ID, environment context). Platform configuration values (schema version, emission target, platform identifier) are provided by the platform, not by each project.

---

## Security and Data Handling Rules

- **No secrets in payloads** — the Event Builder and Validation Gate both enforce this; any secret pattern detected causes rejection or field stripping
- **No credential material in metadata** — `metadata` must contain only operational context; raw tool arguments, API responses, file contents, and external system responses must not be included without explicit confirmation they are non-sensitive
- **Minimal necessary context** — the Event Builder captures the minimum context required to make the event useful; over-capture is a risk surface
- **No raw argument capture by default** — unless the emitter is explicitly configured to include argument summaries for a specific tool, arguments are omitted from `metadata`
- **Control pattern alignment** — `secret.retrieval` events must align with CTRL-HMCP-000001 requirements; the Event Builder must never construct a `secret.retrieval` event that includes the retrieved secret value, even in error messages
- **Emitter identity** — the emitter must present a verifiable identity to the ingestion boundary to prevent unauthorized event injection; mechanism to be defined in a future ADR

---

## Integration Responsibilities

### Projects / MCP Servers

- Instrument operational action boundaries to raise signals at the required points
- Provide local operational context at signal time: action name, outcome, non-sensitive summary
- Carry the active session context so the emitter can attach correlation identifiers
- Not construct events, validate schema, implement retry, or implement compliance policy

### Platform

- Define and maintain `schemas/audit-event.schema.json`
- Define the platform event taxonomy (`event_type` values)
- Define validation rules enforced at the Validation Gate
- Define compliance semantics in CTRL-HMCP-* patterns
- Own the reference emitter design (this document)
- Own the Emission Transport Adapter configuration and target

---

## Operational Constraints

- **Non-blocking** — the emitter must operate asynchronously or with bounded synchronous overhead that does not affect tool call latency
- **Low coupling** — the emitter must not be deeply entangled with project business logic; the Signal Source is the only integration point
- **Deterministic** — given the same inputs, the emitter must produce the same event structure; behavior must not vary based on internal state beyond session context
- **No manual intervention** — the emitter must operate without human input in service and automated contexts; it must handle all failure modes autonomously

---

## Anti-Patterns

**Direct business logic awareness of platform compliance policy**
MCP server tool handlers must not check compliance rules, evaluate control patterns, or decide whether an action requires an audit event. These decisions belong to the emitter design, not to business logic.

**Transport logic embedded throughout project code**
Submitting events directly to an ingestion endpoint from multiple places in project code bypasses the emitter seam, creates transport coupling, and makes it impossible to change the transport without touching every project.

**Ad hoc event construction in multiple places**
Constructing events inline at every action point in project code produces inconsistent event shapes, missed fields, and divergence from schema over time. All event construction must go through the Event Builder.

**Secret-bearing metadata**
Including a token, key, password, or credential in any `metadata` field — even labeled as an error context or debug value — is a critical violation. There is no acceptable reason for a secret value to appear in an audit event.

**Silent validation bypass**
Allowing an event that fails validation to be submitted with reduced fields, defaults substituted for required values, or without `event_type` correction defeats the purpose of the Validation Gate. All validation failures must result in rejection, not degraded emission.

**Coupling primary success path to emitter success**
Marking a tool call as failed because the audit event could not be emitted, or retrying the tool call to get a new emission opportunity, inverts the relationship between operational behavior and observability.

**Project-defined `correlation_id` generation**
Each project independently generating correlation IDs produces non-comparable identifiers, breaks cross-event correlation, and eliminates the platform's ability to reconstruct session traces. Correlation IDs come from the Correlation Context Provider, not from project code.

---

## Relationship to Existing Artifacts

| Artifact | Relationship |
|---|---|
| ADR-HMCP-001 | The foundational separation this design enforces — emitter is the integration seam |
| CTRL-HMCP-000001 | `secret.retrieval` event construction must align with control requirements |
| `schemas/audit-event.schema.json` | The Event Builder and Validation Gate enforce this schema |
| `docs/workflows/audit-event-ingestion.md` | The Emission Transport Adapter delivers to this workflow's ingestion boundary |
| `docs/architecture/instrumentation-layer.md` | Defines event generation points; this design defines the emitter that serves those points |
| `docs/architecture/event-emitter-integration-pattern.md` | The pattern this design implements at blueprint level |
| `docs/architecture/project-integration-contract.md` | Requires audit event emission; this design defines how that requirement is structurally fulfilled |
| VG-HMCP-000002 | Tool invocation gap — this design defines the emitter that would close it |
| VG-HMCP-000003 | Secret retrieval path gap — `secret.retrieval` events require the retrieval path to be known |
| VG-HMCP-000004 | Session lifecycle gap — resolved at schema level in CC-HMCP-000003B; this design implements it |

---

## Open Questions

1. Should the Emission Transport Adapter submit events synchronously (blocking with timeout) or asynchronously (fire-and-forget with local queue)? This affects latency and loss characteristics.
2. What is the bounded backoff strategy for the Transport Adapter — fixed intervals, exponential, or jitter-based? What is the maximum retry window?
3. Should the Failure Observer write to a local file, a structured log stream, or an out-of-band platform endpoint?
4. What constitutes a "probable secret pattern" for metadata inspection — length heuristics, entropy analysis, field name matching, or a combination?
5. How should the emitter handle signals raised during a session where the Correlation Context Provider has no active session (e.g., a tool call before `session.start` was signaled)?
6. Should sensitive data cause event rejection or field stripping? Rejection is safer but may create audit gaps; stripping is riskier but preserves the event record.

---

## Future Evolution

- **Phase 1 (current):** Reference design defined; no implementation
- **Phase 2:** ADR selects integration model; reference design is refined to reflect the selected model; transport target is specified
- **Phase 3:** Reference implementation built in a platform-owned repository or package; covers at least `tool.invocation` and `session.*` event types for the GitHub MCP server integration
- **Phase 4:** Conformance test fixtures defined — sample signals and expected output events that implementations must produce correctly
- **Phase 5:** Emitter published as a platform artifact; new project integrations use it as the standard starting point; integration conformance checks validate correct usage
- **Phase 6:** Emitter covers all event types including `secret.retrieval`; sensitive data pattern detection is tunable; Failure Observer reports to platform gap detection layer

---
