# VG-HMCP-000001 — Keeper Non-Interactive Secret Retrieval Visibility Gap

**Status:** Open  
**Date:** 2026-03-31  
**Related Prompt:** CC-HMCP-000001D  

---

## Summary

The platform cannot currently observe, standardize, or attest to secret retrieval behavior across service execution paths. Keeper Commander is installed on dude-mcp-01 and intended as the runtime secret source, but non-interactive, service-safe retrieval has not been validated across all execution contexts in which MCP servers and agents will operate. This creates a platform-level visibility and compliance gap: secrets may be retrieved inconsistently, opaquely, or through fallback patterns that the platform cannot audit.

---

## Affected Platform Area

- Secrets management (operational)
- Compliance posture (auditability)
- Future control pattern foundation (CTRL-HMCP-*)
- Service execution trust model

---

## Current State

- Keeper Commander is installed via pipx on dude-mcp-01 (192.168.1.208)
- The intended pattern is runtime retrieval: secrets are fetched at execution time and never stored in repos, config files, or environment files
- Non-interactive retrieval (i.e., without a logged-in interactive shell) is not fully validated in service and agent execution contexts
- No platform-defined procedure exists for how a service or agent should retrieve a secret
- No audit event is emitted when a secret is retrieved; the platform has no visibility into whether retrieval succeeded, failed, or fell back to an alternate pattern
- No failure handling standard is defined for the case where retrieval fails in a service context

---

## Visibility Gap

The platform cannot currently:

1. **Observe** whether a service retrieved a secret via Keeper, via a fallback, or not at all
2. **Verify** that retrieval occurred in a non-interactive, service-safe manner
3. **Detect** silent fallback to stored credentials or environment variables
4. **Audit** secret access events — who retrieved what, when, from which execution context
5. **Attest** that all running services are operating under compliant secret handling at any point in time

The gap is not merely operational reliability — it is that the platform has no mechanism to enforce, observe, or reason about secret access behavior across the fleet.

---

## Why This Matters

- **Unattended execution contexts** — MCP servers and agents run as services without interactive sessions. If Keeper Commander requires interactive authentication or a session token that is only present in a user shell, retrieval will silently fail or fall back to a weaker pattern.
- **Control posture degradation** — without a defined, observable retrieval path, future CTRL-HMCP control patterns cannot be grounded in a reliable mechanism. Controls built on an unvalidated assumption are not enforceable.
- **Audit posture** — a platform that cannot observe secret access events cannot provide meaningful compliance attestation. Audit logs will have gaps at the most sensitive boundary.
- **Pattern drift** — without a validated, platform-documented path, operators and developers will independently solve secret access in ad hoc ways. This increases surface area and makes future standardization harder.
- **Trust boundary** — the platform's ability to trust MCP server behavior depends on knowing that servers are operating with legitimately retrieved, appropriately scoped credentials.

---

## Risks

| Risk | Severity | Notes |
|---|---|---|
| Services fall back to stored credentials or env vars | High | Directly violates platform secrets policy |
| Secret retrieval fails silently in service context | High | Services may operate without required credentials or expose degraded behavior |
| No audit trail for secret access | Medium | Compliance attestation is impossible without observable retrieval events |
| Operator workarounds entrench weak patterns | Medium | Pattern drift is harder to correct once established |
| Non-interactive Keeper auth token expiry | Medium | Keeper may require periodic re-authentication that is incompatible with unattended services |

---

## Current Workaround or Operating Assumption

No formal workaround is defined. Current operating assumption:

- Secrets are retrieved interactively during development and testing
- Service-context secret access has not been fully exercised or validated
- The platform implicitly assumes Keeper retrieval will work in service contexts — this assumption is unvalidated

This assumption is not acceptable as a long-term operating posture.

---

## Desired Future Capability

The platform should be able to:

1. **Define** a documented, repeatable procedure for non-interactive, service-safe secret retrieval using Keeper Commander (or a successor mechanism)
2. **Validate** that the procedure works reliably in service and agent execution contexts on the homelab fleet
3. **Observe** secret retrieval behavior via audit events — at minimum: timestamp, requesting service/agent identity, secret reference (not value), outcome (success/failure), execution context
4. **Enforce** that services use the platform-approved retrieval path and do not fall back to weaker patterns
5. **Attest** at any point in time that all registered services are retrieving secrets through a compliant, observable path
6. **Handle failure** predictably — defined behavior when retrieval fails, with no silent fallback

This capability is foundational to the platform's compliance posture and is a prerequisite for any control pattern that involves credentials or authenticated tool calls.

---

## Out of Scope

- Implementing changes to Keeper Commander itself
- Selecting or replacing the secrets management tool
- Solving this gap within this artifact (documentation only)
- Project-specific secret handling (this gap is platform-scoped)
- Defining the audit event schema (separate artifact)

---

## Open Questions

1. Does Keeper Commander support a non-interactive, token-based retrieval mode that persists reliably in service execution contexts?
2. What authentication model does Keeper Commander use when invoked without an interactive session — does it require a session token, a device enrollment, or an API key?
3. If Keeper retrieval fails in a service context, what is the expected failure mode — exception, empty return, or process exit?
4. Is there a Keeper service account or API credential model suitable for unattended service use?
5. Should the platform emit a synthetic audit event for secret retrieval, or should Keeper itself be instrumented?
6. Does the current pipx installation of Keeper Commander support being called from systemd unit environments (no TTY, restricted PATH, isolated environment)?

---

## Suggested Follow-On Work

| ID | Type | Description |
|---|---|---|
| ADR-HMCP-001 | ADR | Runtime secret retrieval strategy — evaluate and decide on the platform-approved mechanism for non-interactive service-safe secret access |
| CTRL-HMCP-001 | Control Pattern | Secret retrieval control — define the required retrieval path, forbidden patterns, and audit event expectations for all platform-managed services |
| (TBD) | Workflow | Keeper non-interactive validation runbook — steps to validate that Keeper Commander functions correctly in a service execution context on dude-mcp-01 |
| (TBD) | Schema | Audit event definition for secret retrieval — extend or seed the platform audit schema with a secret_retrieval_attempt event type |

---
