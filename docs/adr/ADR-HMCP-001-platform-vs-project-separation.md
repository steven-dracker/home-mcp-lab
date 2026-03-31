# ADR-HMCP-001 — Platform vs Project Separation

**Status:** Accepted  
**Date:** 2026-03-31  

---

## Context

The Home MCP Compliance Lab hosts multiple MCP server projects. As project count grows, there is structural risk that compliance logic, audit behavior, and control enforcement will be duplicated or embedded inconsistently inside individual projects. This decision establishes a permanent, enforceable boundary between what the platform owns and what projects own.

This decision formalizes rules already present as platform laws in CLAUDE.md and the chatgpt-primer. It exists as a durable architectural record so that future contributors, future Claude Code sessions, and future ADRs can reference it explicitly.

---

## Decision

**The platform and projects have strictly separated, non-overlapping responsibilities. Compliance concerns belong to the platform. Business and domain concerns belong to projects.**

### Platform Owns

- Audit event schema — the canonical structure of all observable tool call events
- Visibility gap register — the formal register of what cannot yet be observed or attested
- Control patterns — the approved enforcement mechanisms for MCP server risk surfaces
- Compliance logic — the rules, checks, and policies that determine whether behavior is compliant
- Workflow definitions — the operational procedures for platform-managed processes
- Integration contract — the interface a project must implement to connect to the platform

### Projects Own

- MCP server implementations — the tool handlers, routing, and server configuration
- Tool definitions — what tools a server exposes, their inputs, and their behavior
- Domain and business logic — application-specific rules, data models, and workflows
- Project-level configuration — settings, dependencies, and deployment specifics not governed by the platform

### Integration Model

Projects connect to the platform by implementing the integration contract:
1. Declaring tools and their risk classification
2. Emitting audit events using the platform schema
3. Applying control patterns appropriate to the server's risk profile
4. Reporting visibility gaps for behaviors the platform cannot yet observe

The integration contract is defined in this repository. Projects reference it externally — they do not embed it.

---

## Explicitly Prohibited

The following are architectural violations:

- **Embedding compliance logic inside project code** — a project must not implement its own audit logging, policy enforcement, or control logic. These belong to the platform.
- **Duplicating audit event structures across projects** — all audit events must conform to the platform schema. Projects must not define their own event formats.
- **Bypassing platform logging or controls** — a project must not emit events outside the platform schema, suppress events, or route tool calls through paths that are unobservable to the platform.
- **Absorbing projects into the platform** — the platform must not contain project-specific logic, domain knowledge, or business rules.
- **Embedding platform governance in project repositories** — CLAUDE.md platform laws, control pattern logic, and compliance schemas must not be copied or re-implemented inside project repos.

---

## Rationale

**Separation of concerns.** Compliance logic is a cross-cutting concern. Embedding it in each project creates duplication, inconsistency, and ownership ambiguity. Centralization ensures a single authoritative source.

**Centralized enforcement.** A platform that owns compliance logic can evolve controls, schemas, and audit requirements independently of projects. Projects adopt changes by implementing updated contracts — they do not rewrite internal logic.

**Reusability.** The same audit schema, control patterns, and visibility gap register apply to every integrated project. This is only possible if projects do not own or duplicate those artifacts.

**Reduced drift.** When compliance logic is distributed, it diverges. Projects diverge from each other and from platform intent. A clear boundary with an integration contract is the mechanism to prevent drift.

**Independent evolution.** The platform must be able to upgrade its schema, tighten controls, or add visibility without requiring coordinated changes across all project codebases. The integration contract is the decoupling boundary that makes this possible.

---

## Consequences

### Positive

- **Consistent compliance posture** across all projects — the platform enforces the same rules for every integrated MCP server
- **Strong audit coverage** — all tool call events flow through a single schema, making cross-project audit and attestation possible
- **Clear ownership** — there is no ambiguity about where compliance logic lives or who is responsible for it
- **Platform can evolve independently** — adding a new control pattern or tightening an audit schema does not require changes to project business code
- **Visibility gap register is authoritative** — gaps are tracked in one place, not scattered across project READMEs or issue trackers

### Negative / Tradeoffs

- **Integration discipline required** — projects must implement the integration contract correctly; incorrect implementations create silent compliance gaps
- **Upfront structure** — new projects must understand and adopt the platform model before shipping; this adds friction at project inception
- **Early-phase overhead** — while the platform is still defining its schemas and contracts, projects may need to wait for stable interfaces before fully integrating
- **No escape hatch** — there is no approved way to partially comply; a project either implements the contract or it is outside the compliance boundary

---

## Alternatives Considered

**Embedding compliance logic in each project (rejected)**  
Each project would implement its own audit logging, control enforcement, and event schema. Rejected because this creates duplication, divergence, and makes cross-project visibility impossible. There is no way to enforce consistency without a platform.

**Hybrid / shared responsibility model (rejected)**  
Platform and projects would share compliance responsibility — the platform provides guidelines and each project decides how to implement them. Rejected because shared ownership with no clear boundary is equivalent to no boundary. Ambiguity creates the conditions for drift and enables non-compliance by design.

---
