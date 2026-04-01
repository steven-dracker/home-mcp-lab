# Audit Event Ingestion Workflow — Home MCP Compliance Lab

**Status:** Draft  
**Date:** 2026-03-31  

---

## Summary

This document defines the audit event ingestion workflow for the Home MCP Compliance Lab. It describes how audit events move from the moment they are generated to the point where they are available for analysis, control evaluation, and audit trail reconstruction. This is a conceptual workflow definition — no infrastructure is implemented here.

---

## Purpose

The platform claims ownership of audit observability. For that claim to be meaningful, the platform must define:

- where events originate
- how they enter the platform boundary
- how they are validated
- how they are stored and made queryable
- what happens when events are missing or malformed

This workflow establishes that definition. It is the authoritative reference for how audit events should behave in a fully instrumented platform. Current capability falls short of this definition — gaps are explicitly acknowledged in the Known Gaps section.

---

## Workflow Overview

The end-to-end audit event ingestion flow proceeds through seven stages:

```
1. EVENT OCCURS
   An action takes place — a tool is invoked, a secret is retrieved, a session starts or ends.

2. EVENT IS EMITTED
   The responsible party (MCP server, platform agent, or instrumentation layer) constructs
   a conforming audit event and submits it to the platform ingestion boundary.

3. EVENT ENTERS PLATFORM BOUNDARY
   The event is received at the platform ingestion point. The receiving layer acknowledges
   receipt without yet validating content.

4. EVENT IS VALIDATED
   The event is checked against schemas/audit-event.schema.json:
   - Required fields are present
   - Field types and formats are correct
   - No sensitive data is present in payload
   - event_type is a recognized value

5. EVENT IS ACCEPTED OR REJECTED
   - Accepted: event proceeds to storage
   - Rejected: event is logged to a validation failure record; the originating party
     is notified where possible; the event is not stored in the main audit log

6. EVENT IS STORED
   The validated event is written to durable storage in its canonical form.
   Storage must support correlation_id queries, time-based queries, and event_type filtering.

7. EVENT BECOMES AVAILABLE
   Stored events are queryable for:
   - audit trail reconstruction
   - control evaluation (compliance checks against CTRL-HMCP-* patterns)
   - visibility gap analysis
   - session correlation
```

---

## Event Sources

### Primary Sources

- **MCP servers** — the primary source of `tool.invocation` events; every tool call handled by a registered MCP server should produce an event
- **Platform instrumentation layer** — a future platform-owned component that intercepts tool calls and emits events on behalf of MCP servers that cannot emit natively (see VG-HMCP-000002)
- **Service agents** — services retrieving secrets or performing platform-managed operations emit `secret.retrieval` events

### Future Sources

- **Session lifecycle emitters** — agents or the MCP client that emit `session.start` and `session.end` events (see VG-HMCP-000004)
- **Platform internal processes** — platform-managed workflows that produce their own audit events for control enforcement actions

### Source Requirements

All event sources must:
- Emit events conforming to `schemas/audit-event.schema.json`
- Set `platform` to `"home-mcp-lab"`
- Set `project_id` and `agent_id` accurately
- Establish and propagate a `correlation_id` within a session or workflow boundary
- Never include secret values, credentials, or sensitive data in any field

---

## Ingestion Stages

### Stage 1 — Emission

The event originator constructs the audit event and submits it to the platform. Emission is the responsibility of the event source (MCP server, instrumentation layer, or agent). The platform does not poll for events — events are pushed.

Emission must be:
- Non-blocking to the originating action (tool call must not wait on audit emission)
- Best-effort in the current phase; eventual-consistency acceptable
- Clearly identifiable as failed if submission does not succeed

### Stage 2 — Reception

The platform ingestion boundary receives the submitted event. Reception acknowledges that the event has entered the platform — it does not imply the event is valid or stored.

Reception requirements:
- Assign a platform-internal receipt timestamp
- Record the source identity (which MCP server or agent submitted the event)
- Queue the event for validation

### Stage 3 — Validation

The received event is validated against the platform schema and content rules. See Validation Layer section.

### Stage 4 — Normalization

Accepted events may undergo light normalization before storage:
- Timestamps standardized to UTC ISO 8601
- Field values trimmed of extraneous whitespace
- `metadata` fields with recognized keys validated for expected types

Normalization must not alter the semantic content of the event. It is a cleanup step, not a transformation step.

### Stage 5 — Storage

Validated and normalized events are written to durable storage. See Storage section.

### Stage 6 — Exposure

Stored events are made available for querying and analysis. See Processing and Enrichment section.

---

## Validation Layer

All events must pass the following checks before being accepted into the audit log.

### Schema Validation

- Event must conform to `schemas/audit-event.schema.json`
- All required fields must be present: `schema_version`, `event_id`, `event_type`, `timestamp`, `platform`, `project_id`, `agent_id`, `mcp_server`, `action`, `status`, `correlation_id`, `metadata`
- `event_type` must be a recognized value (`tool.invocation`, `secret.retrieval`, or future defined types)
- `status` must be `success` or `failure`
- `timestamp` must be a valid ISO 8601 date-time string

### Content Validation

- `metadata` must not contain patterns indicative of secret values (tokens, passwords, keys)
- `event_id` must be unique within the platform audit log; duplicate `event_id` values are rejected
- `platform` must equal `"home-mcp-lab"`

### Rejection Behavior

Events that fail validation are:
- Not written to the main audit log
- Written to a validation failure log with: receipt timestamp, source identity, failure reason, and the rejected payload (sanitized if needed)
- Counted against the source's validation failure rate metric (for observability)

Validation failure is non-blocking — the originating tool call is not affected by a rejected audit event.

---

## Storage (Conceptual)

Audit events must be stored in a form that is:

- **Durable** — events must not be lost after acceptance; storage must survive process restarts
- **Queryable** — storage must support at minimum:
  - Query by `correlation_id` — retrieve all events within a session or workflow
  - Query by `timestamp` range — retrieve events within a time window
  - Query by `event_type` — filter to specific event categories
  - Query by `project_id` — retrieve all events for a specific project
  - Query by `agent_id` — retrieve all events attributed to a specific agent
- **Append-only** — accepted events must not be modified after storage; corrections are new events, not edits
- **Retainable** — events must be retained for a platform-defined retention period (to be determined)

No specific storage technology is chosen at this stage. The requirement is behavioral, not technological.

---

## Processing and Enrichment (Conceptual)

After storage, the platform may apply derived processing to enhance event utility:

### Correlation

- Events sharing a `correlation_id` can be grouped into a session trace
- Session traces enable: sequence reconstruction, duration calculation, outcome summarization

### Gap Detection

- The platform can detect missing expected events — e.g., a session with tool calls but no `session.start` event, or a service with no `secret.retrieval` event when one was expected
- Missing events are a compliance signal and should surface in visibility gap analysis

### Control Evaluation

- Stored events can be evaluated against CTRL-HMCP-* control patterns
- Example: all `secret.retrieval` events with `retrieval_mode: "interactive"` in a service context violate CTRL-HMCP-000001
- Control evaluation is applied to stored events; it does not block ingestion

### Derived Metadata

- The platform may attach derived fields to event records after storage (e.g., risk classification based on tool name, session summary statistics)
- Derived fields must be clearly distinguished from original event fields

---

## Observability and Monitoring

The ingestion pipeline itself must be observable. The platform must be able to track:

- **Ingestion volume** — events received per time window, per source, per event type
- **Validation failure rate** — count and proportion of events rejected; breakdown by failure reason
- **Source coverage** — which registered projects and MCP servers are emitting events vs. which are silent (gap detection)
- **Ingestion latency** — time from event emission to event availability in storage
- **Missing event alerts** — detection of expected events that did not arrive within a defined window (e.g., no `session.end` event after a `session.start` within N minutes)

---

## Failure Handling

### Event Emission Failure

If an event source fails to emit an event (e.g., instrumentation layer error):
- The originating tool call must not be blocked or failed as a result
- The failure must be logged locally at the source
- The platform must be able to detect the emission gap (missing event) through its observability layer

### Validation Failure

If an event fails platform validation:
- The event is rejected and logged to the validation failure record
- The originating action is not affected
- The source is counted against its validation failure rate
- Repeated validation failures from a source should surface as an observability alert

### Storage Failure

If a validated event cannot be written to storage:
- The event must be held in a retry buffer
- Retry must occur until the event is successfully written or the retry window expires
- Events that exceed the retry window are logged to a dead-letter record
- Dead-letter events represent an audit integrity gap and must surface as an alert

### Missing Events

If a compliance-relevant event is expected but absent (e.g., no `secret.retrieval` event for a service that should be retrieving secrets):
- This is treated as a visibility gap condition, not a storage or validation failure
- Missing event conditions are surfaced through the gap detection layer
- They do not trigger ingestion pipeline errors

---

## Security Considerations

- **No secrets in event payloads** — enforced at the validation layer; events containing probable secret patterns are rejected
- **Audit log integrity** — the audit log is append-only; accepted events must not be modified or deleted after storage
- **Tamper awareness** — the platform should be capable of detecting whether the audit log has been modified outside the ingestion path; mechanism to be defined
- **Source authentication** — event sources should be authenticated before events are accepted; mechanism to be defined in a future ADR
- **Access control** — the audit log should have defined read and write access boundaries; write access is restricted to the ingestion layer; read access is governed by platform policy

---

## Known Gaps and Limitations

This workflow defines the target state. Current platform capability falls significantly short. The following gaps directly prevent this workflow from operating:

**VG-HMCP-000002 — Tool Invocation Visibility**
No instrumentation layer exists to emit `tool.invocation` events for MCP tool calls. Stage 1 (Emission) cannot occur for the primary event type until this gap is closed.

**VG-HMCP-000003 — Secret Retrieval Path Visibility**
The GitHub PAT retrieval path is undocumented and unobservable. `secret.retrieval` events cannot be emitted without a defined and observable retrieval mechanism.

**VG-HMCP-000004 — Session Lifecycle Visibility**
No `session.start` or `session.end` event types exist in the schema, and no mechanism emits them. Correlation across tool call events is not possible until this gap is closed.

**VG-HMCP-000001 — Keeper Non-Interactive Retrieval**
Non-interactive, service-safe secret retrieval is not validated. `secret.retrieval` events for service contexts cannot be reliably emitted until the retrieval mechanism itself is stable.

**Summary:** This workflow cannot operate in any meaningful capacity until at minimum VG-HMCP-000002 and VG-HMCP-000004 are resolved. The workflow definition stands as the target state and the basis for prioritizing gap remediation.

---

## Relationship to Existing Artifacts

| Artifact | Relationship |
|---|---|
| `schemas/audit-event.schema.json` | Defines the event structure that the validation layer enforces |
| `CTRL-HMCP-000001` | Defines secret retrieval behavior; `secret.retrieval` events are the evidence base for control evaluation |
| `docs/architecture/project-integration-contract.md` | Requires projects to emit conforming events; this workflow defines what happens after emission |
| `VG-HMCP-000001` | Keeper retrieval gap — blocks `secret.retrieval` event emission in service contexts |
| `VG-HMCP-000002` | Tool invocation gap — blocks `tool.invocation` event emission entirely |
| `VG-HMCP-000003` | PAT retrieval path gap — blocks `secret.retrieval` events for GitHub PAT access |
| `VG-HMCP-000004` | Session lifecycle gap — blocks correlation and session-level audit completeness |

---

## Future Evolution

This workflow is expected to evolve as the platform matures:

- **Phase 1 (current):** Workflow defined conceptually; no events flowing; gaps documented
- **Phase 2:** Instrumentation layer defined (ADR); `tool.invocation` events begin flowing for at least one MCP server
- **Phase 3:** Session lifecycle events defined in schema; correlation becomes possible; session traces can be reconstructed
- **Phase 4:** Storage layer implemented; events are queryable; control evaluation runs against stored events
- **Phase 5:** Gap detection active; missing event alerts surface; ingestion observability operational
- **Phase 6:** Source authentication and audit log integrity mechanisms in place; full compliance attestation posture achievable

---
