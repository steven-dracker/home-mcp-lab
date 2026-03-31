# CTRL-HMCP-000001 — Runtime Secret Retrieval Control

**Status:** Draft  
**Date:** 2026-03-31  

---

## Related Artifacts

- VG-HMCP-000001 — Keeper Non-Interactive Secret Retrieval Visibility Gap
- ADR-HMCP-001 — Platform vs Project Separation

---

## Summary

This control defines the platform's expectations for how secrets are retrieved by services, agents, and MCP servers at runtime. It directly responds to VG-HMCP-000001, which identified that non-interactive, service-safe secret retrieval is not yet validated or observable. This document establishes what compliant behavior looks like. It does not implement retrieval or define schema.

---

## Control Objective

Ensure that all platform-managed services and agents retrieve secrets at runtime via a non-interactive, service-safe, repeatable mechanism — and that this behavior is observable and attestable by the platform.

---

## Control Statement

**All services, agents, and MCP servers operating under the Home MCP Compliance Lab platform must retrieve secrets at runtime via the platform-approved retrieval mechanism. Secrets must never be stored in repositories, configuration files, or environment files. Retrieval must occur without manual intervention and must behave deterministically in service execution contexts.**

---

## Scope of Control

This control applies to:

- All MCP servers registered with the platform
- All agents operating under platform governance
- All services deployed to platform-managed nodes (dude-mcp-01, dude-ops-01)
- Any automation or workflow that requires a credential to execute a tool call

This control does not apply to:

- Interactive development sessions where a human operator is present
- Local experimentation outside platform-managed workflows
- Projects not yet registered with the platform

---

## Required Behavior

All in-scope services and agents must:

1. **Retrieve secrets at runtime** — credentials must be fetched at execution time, not pre-loaded, cached in persistent storage, or injected as environment variables at service startup
2. **Use a non-interactive mechanism** — retrieval must not require a TTY, a logged-in user session, or any form of manual input
3. **Operate in service execution contexts** — retrieval must succeed when invoked by systemd, a scheduled task, or an unattended agent without a user shell
4. **Handle failure deterministically** — if retrieval fails, the service must fail explicitly with a clear error; it must not silently continue with missing or stale credentials
5. **Avoid silent fallback** — there must be no fallback path to weaker storage patterns (env vars, config files, hardcoded values) if the approved retrieval mechanism fails
6. **Use the platform-approved retrieval mechanism** — as defined when ADR-HMCP-001 (runtime secret retrieval strategy) is completed; until then, retrieval must at minimum conform to the spirit of this control

---

## Prohibited Behavior

The following are non-compliant and must not occur in platform-managed contexts:

- **Hardcoding secrets** — secrets must never appear as literals in source code, scripts, or configuration templates
- **Storing secrets in repositories** — no credential, token, key, or password may be committed to version control under any circumstances
- **Storing secrets in configuration files** — `.env` files, YAML/JSON config, systemd unit files, and similar must not contain secret values
- **Injecting secrets as persistent environment variables** — setting secrets in shell profiles (`.bashrc`, `.profile`) or service environment files is prohibited
- **Manual secret injection for services** — a human operator must not be required to provide a secret at service start time or during normal operation
- **Silent fallback to weaker patterns** — if the approved retrieval path fails, the service must not silently degrade to any of the patterns listed above
- **Storing retrieved secrets in logs** — secret values must never appear in application logs, audit events, or any observable output

---

## Observability Requirements

For this control to be enforceable, the platform must be able to determine:

1. **When a secret was requested** — timestamp and requesting service/agent identity
2. **Whether retrieval succeeded or failed** — outcome of the retrieval attempt
3. **Which mechanism was used** — confirmation that the platform-approved path was invoked, not a fallback
4. **Execution context** — service name, node, and execution path from which retrieval was initiated

**Current capability:** Incomplete. As documented in VG-HMCP-000001, the platform currently has no mechanism to observe secret retrieval behavior. No audit events are emitted. No retrieval path has been validated in service contexts. This control cannot be fully enforced until the visibility gap is resolved.

This observability requirement is the binding link between this control and VG-HMCP-000001. The control defines the target state; the visibility gap documents what is missing to reach it.

---

## Enforcement Strategy (Conceptual)

When observability infrastructure is in place, this control should be enforced through:

1. **Integration contract requirement** — the platform integration contract must require that projects declare their secret retrieval mechanism and confirm it conforms to this control
2. **Audit event emission** — every secret retrieval attempt must emit a platform audit event containing the fields defined in the Observability Requirements section (secret value must never be included)
3. **Platform-level validation** — the platform should be capable of asserting, at any point in time, that all registered services have retrieved secrets through a compliant path within a defined window
4. **Failure alerting** — failed retrieval attempts must surface as observable events; silent failures are a compliance violation
5. **Pattern detection** — future tooling should be able to detect prohibited patterns (env var injection, config file secrets) in service definitions before deployment

None of these enforcement mechanisms are currently implemented. This section defines intent, not current capability.

---

## Risks if Not Enforced

| Risk | Severity | Description |
|---|---|---|
| Secret exposure via repository | Critical | Committed secrets are permanently exposed regardless of later deletion |
| Operator-driven pattern drift | High | Without a defined compliant path, operators will independently solve secret access in incompatible ways |
| Silent service failures | High | Services may fail to retrieve secrets and operate with missing credentials without surfacing the failure |
| Non-attestable compliance posture | High | The platform cannot claim or demonstrate compliant secret handling without observability |
| Control pattern erosion | Medium | If this control is not enforced, future controls that depend on it (e.g., audit event integrity) are weakened |

---

## Dependencies

| ID | Type | Description | Status |
|---|---|---|---|
| VG-HMCP-000001 | Visibility Gap | Keeper non-interactive retrieval gap — must be resolved for this control to be fully enforceable | Open |
| ADR-HMCP-001 (secret retrieval) | ADR | Decision on the platform-approved retrieval mechanism — required before the control can name a specific mechanism | Not yet created |
| (TBD) | Audit Schema | Secret retrieval event type — required for observability requirements to be implemented | Not yet created |
| (TBD) | Integration Contract | Must include secret retrieval compliance declaration | Not yet created |

---

## Open Questions

1. Will Keeper Commander be the long-term approved mechanism, or will an alternative be selected via ADR?
2. What constitutes the platform-approved retrieval mechanism for services currently running while the ADR is pending?
3. Should secret retrieval audit events be emitted by the service, by a platform agent, or by a sidecar/wrapper?
4. What is the acceptable window for re-attestation — how frequently must a service demonstrate compliant retrieval behavior?
5. How should this control apply to ephemeral agents (one-shot executions vs long-running services)?

---

## Future Evolution

This control is expected to evolve as the platform matures:

- **Phase 1 (current):** Control statement defined; behavior specified; enforcement not yet possible due to VG-HMCP-000001
- **Phase 2:** Retrieval mechanism approved via ADR; non-interactive path validated on dude-mcp-01; retrieval runbook published
- **Phase 3:** Audit event schema includes secret retrieval event type; services emit events; platform can observe retrieval outcomes
- **Phase 4:** Integration contract requires compliance declaration; platform validates declarations on registration; failure alerting active
- **Phase 5:** Pattern detection tooling deployed; prohibited patterns are blocked at deployment time; full attestation posture achieved

---
