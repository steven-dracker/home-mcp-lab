# Project Integration Contract — Home MCP Compliance Lab

**Status:** Draft  
**Date:** 2026-03-31  

---

## Summary

This document defines the integration contract between the Home MCP Compliance Lab platform and external projects. It specifies what a project must do to operate under platform governance, what the platform provides in return, and what neither party may do. This is a boundary definition — not an implementation guide.

---

## Purpose of the Contract

The platform and projects are intentionally separated (ADR-HMCP-001). The platform owns compliance logic, audit observability, and control patterns. Projects own their business logic and MCP server implementations. This contract defines the interface at that boundary.

Without a defined contract:
- projects integrate inconsistently
- compliance posture cannot be attested
- the platform cannot enforce or observe behavior across projects

This contract is the minimum required for a project to be considered platform-integrated.

---

## Integration Model Overview

A project is considered **platform-integrated** when it:

1. Declares the MCP tools it exposes
2. Emits audit events using the platform schema for all relevant actions
3. Aligns with applicable platform control patterns
4. Reports actions it cannot yet make observable as visibility gaps

Projects that do not meet these requirements are **outside the compliance boundary** and cannot be attested by the platform.

---

## Project Responsibilities

### Must Do

- **Declare tools** — register every MCP tool the server exposes, including its name, purpose, and risk classification
- **Emit audit events** — for all tool invocations and secret retrieval attempts, emit events conforming to `schemas/audit-event.schema.json`
- **Align with control patterns** — apply platform control patterns (CTRL-HMCP-*) appropriate to the server's risk profile; document any deviations
- **Report visibility gaps** — where behavior cannot currently be made observable, declare a VG-HMCP-* entry in coordination with the platform

### Must Not Do

- **Implement compliance logic** — projects must not define their own audit schemas, control enforcement, or policy rules; these belong to the platform
- **Bypass platform observability** — projects must not suppress, skip, or route around required audit event emission
- **Duplicate audit mechanisms** — projects must not maintain parallel event logs or compliance tracking outside the platform schema
- **Embed platform governance artifacts** — CLAUDE.md platform laws, control pattern documents, and schemas must not be copied into project repositories

---

## Platform Responsibilities

### Provides

- **Audit event schema** — the canonical structure all projects must use (`schemas/audit-event.schema.json`)
- **Control patterns** — the approved enforcement mechanisms projects must align with (CTRL-HMCP-*)
- **Visibility gap register** — the formal register for documenting unobservable behaviors (VG-HMCP-*)
- **Architecture decisions** — binding decisions that govern platform and project design (ADR-HMCP-*)
- **Integration expectations** — this document and its successors

### Does Not Do

- **Own project business logic** — the platform does not define what a project's MCP tools do, what data they access, or how they are implemented
- **Embed itself into project internals** — the platform does not require code changes to project domain logic beyond audit event emission at tool call boundaries
- **Dictate project technology choices** — the platform defines interface requirements, not implementation approach

---

## Tool Declaration Requirements

Every project must declare each MCP tool it exposes. At minimum, each tool declaration must include:

| Field | Description |
|---|---|
| `tool_name` | The exact name the MCP server registers for the tool |
| `description` | A plain-language description of what the tool does |
| `risk_classification` | Conceptual risk level: `low`, `medium`, or `high` |
| `data_access` | Brief description of what data the tool reads or writes |
| `produces_audit_events` | Whether the tool emits platform audit events (`yes` / `no` / `partial`) |

Tool declarations are the basis for platform visibility. An undeclared tool is an unobservable tool.

A formal tool declaration schema will be defined in a future platform artifact. Until then, projects must document declarations in human-readable form within their integration registration.

---

## Audit Event Emission Requirements

Projects must emit audit events conforming to `schemas/audit-event.schema.json` for:

- Every MCP tool invocation (event type: `tool.invocation`)
- Every runtime secret retrieval attempt (event type: `secret.retrieval`)

Events must:
- Include all required top-level fields as defined in the schema
- Set `platform` to `"home-mcp-lab"`
- Set `project_id` to the project's registered identifier
- Use the correct `event_type` value
- Include non-sensitive context in `metadata` only
- Never include secret values, credentials, tokens, or PII in any field

Events must not:
- Omit required fields
- Use event type values not defined in the schema
- Include raw tool results if they may contain sensitive data
- Be batched or delayed in ways that break correlation integrity

Where a project cannot currently emit a required event, it must declare a visibility gap (VG-HMCP-*) identifying the gap, the affected action, and the reason observability is not yet possible.

---

## Control Alignment Expectations

Projects must review and apply platform control patterns (CTRL-HMCP-*) relevant to their risk profile. At minimum:

- **CTRL-HMCP-000001** (Runtime Secret Retrieval) applies to all projects that retrieve secrets in service or agent execution contexts

For each applicable control pattern, the project must either:
1. **Implement the required behavior** — and be able to demonstrate compliance via audit events
2. **Declare non-compliance explicitly** — document the deviation and the reason, and open a visibility gap entry if observability is the barrier

Silent non-compliance is not acceptable. The platform must be able to determine whether a project is compliant, partially compliant, or non-compliant for each applicable control.

---

## Visibility Gap Reporting Expectations

Where a project cannot make a behavior observable — due to tooling limitations, architectural constraints, or incomplete platform capability — it must declare a visibility gap using the VG-HMCP-* format.

A visibility gap declaration must include:
- The action or behavior that cannot be observed
- The reason observability is not currently possible
- Whether the gap is a project limitation or a platform limitation
- What would need to change to close the gap

Visibility gaps do not excuse non-compliance indefinitely. They are formal acknowledgements that create a remediation obligation.

---

## Non-Goals

This contract does not define:

- Implementation code or SDKs for audit event emission
- Transport or storage mechanisms for audit events
- Authentication or authorization between projects and the platform
- Enforcement tooling or automated compliance checks
- A formal tool declaration schema (future artifact)
- Approval or onboarding workflows for new projects

These are platform roadmap items. This contract defines what is required, not how it is implemented.

---

## Open Questions

1. What is the formal registration process for a new project? Is there a registration artifact, a command, or a manual declaration?
2. How does the platform track which projects are currently integrated and their compliance status?
3. What is the process for a project to declare a visibility gap — does it submit a PR to this repo, or is there another mechanism?
4. Should tool declarations be machine-readable (JSON/YAML) or is human-readable documentation sufficient at this stage?
5. What constitutes the minimum viable integration for a project in the current pre-enforcement phase?

---

## Future Evolution

This contract is version 0 and is expected to evolve as the platform matures:

- **Phase 1 (current):** Contract defined; responsibilities and boundaries established; no enforcement tooling
- **Phase 2:** Formal tool declaration schema defined; projects submit machine-readable declarations
- **Phase 3:** Audit event emission validated at runtime; platform can observe and correlate events across projects
- **Phase 4:** Control alignment verified via audit evidence; compliance status trackable per project per control
- **Phase 5:** Full attestation posture — platform can assert, at any point in time, whether each registered project is compliant

---
