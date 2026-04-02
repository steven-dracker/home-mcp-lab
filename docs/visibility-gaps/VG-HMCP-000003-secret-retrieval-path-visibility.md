# VG-HMCP-000003 — Secret Retrieval Path Visibility Gap (GitHub PAT)

**Status:** Narrowed  
**Date:** 2026-03-31  
**Narrowed:** 2026-04-02 (CC-HMCP-000006A)  
**Related Prompt:** CC-HMCP-000002C  
**Source Integration:** CC-HMCP-000002B — GitHub MCP Integration Assessment  

---

## Summary

The platform cannot confirm how the GitHub MCP server obtains its authentication credential (personal access token). The PAT is known to be in use — the server connects successfully — but the retrieval path is undocumented and unobservable. The platform cannot determine whether the credential is stored in a compliant location, retrieved at runtime, or injected through a prohibited pattern. This gap directly blocks CTRL-HMCP-000001 compliance attestation for the GitHub MCP server.

---

## Affected Platform Area

- Secrets compliance (CTRL-HMCP-000001 — Runtime Secret Retrieval)
- Audit observability (secret retrieval events)
- Integration contract control alignment

---

## Narrowed State (CC-HMCP-000006A — 2026-04-02)

The retrieval path is now defined, implemented, and documented. The following is resolved:

**What was resolved:**
- The retrieval mechanism is now documented: `scripts/get-github-pat.sh` defines the priority chain
  (pass-through → Keeper Commander → gh CLI fallback)
- The injection pattern is defined: `scripts/run-with-github-pat.sh` injects at the process boundary;
  PAT is never written to files, logs, or child-process stdout
- PAT hygiene is validated: no-leakage test passed; PAT value confirmed absent from all output streams
- CTRL-HMCP-000001 compliance: the platform-approved retrieval path now exists and is documented
- Host prerequisites and Keeper setup are documented in `docs/runbooks/keeper-noninteractive-setup.md`

**What remains open:**
1. **Keeper service-context viability not confirmed on dude-mcp-01** — the Keeper path logic is implemented
   and correct, but Keeper is not installed on the dev machine. Live execution of the Keeper code path
   requires SSH or direct access to dude-mcp-01. This is the same blocker as VG-HMCP-000001.
2. **No `secret.retrieval` audit event emitted** — the schema supports `secret.retrieval` (v0.2.0),
   but the emitter has no `emitSecretRetrieval` function and the retrieval scripts do not emit events.
   PAT access is still unobservable at the audit level. This is the primary remaining gap.

**Exact remaining blocker:** No `secret.retrieval` events are emitted when the PAT is retrieved.
Until these events are wired, credential access remains invisible to the platform audit log.

---

## Prior State (original, retained for history)

- The GitHub MCP server authenticates to the GitHub API using a personal access token
- The server connects successfully on dude-mcp-01, indicating the PAT is accessible at runtime
- The PAT storage location has not been inspected or documented in any platform artifact
- The retrieval mechanism is unknown — it may be stored in a Claude Code MCP config file, an environment variable, a shell profile, or retrieved via Keeper Commander
- No `secret.retrieval` audit event is emitted when the PAT is accessed
- CTRL-HMCP-000001 compliance for the GitHub MCP server has not been assessed or validated
- Keeper Commander is installed on dude-mcp-01 but its involvement in PAT retrieval is unconfirmed

---

## Visibility Gap

The platform cannot currently:

1. **Determine** where the GitHub PAT is stored (config file, environment, secrets manager, shell profile)
2. **Confirm** that the PAT is retrieved at runtime rather than stored in a persistent, insecure location
3. **Verify** that the retrieval path is compliant with CTRL-HMCP-000001
4. **Observe** when the PAT is accessed — no `secret.retrieval` event is emitted
5. **Detect** whether the credential rotates, expires, or is reused across sessions
6. **Attest** that the GitHub MCP server is operating with a compliantly sourced credential

This gap is distinct from VG-HMCP-000001 (Keeper non-interactive retrieval). That gap concerns whether Keeper can reliably deliver secrets in service contexts. This gap concerns a specific credential in active use whose retrieval path is entirely undocumented.

---

## Why This Matters

- **Active credential with unknown provenance** — the GitHub PAT in use on dude-mcp-01 may be stored in a location that violates the platform's secrets policy (no secrets in repos, configs, or environment files). Until the storage location is confirmed, this is an open compliance risk.
- **CTRL-HMCP-000001 cannot be applied** — the control defines required retrieval behavior, but enforcement requires knowing how the credential is currently handled. Without that baseline, there is no starting point for remediation.
- **No audit record for credential access** — the platform has no record of when the PAT is used or accessed. Credential usage is a high-value audit signal and is currently invisible.
- **Sets a precedent for other integrations** — if the first integrated project has undocumented credential handling, subsequent integrations will follow the same pattern by default.
- **Rotation and expiry are untracked** — if the PAT expires or is revoked, there is no platform-level record or alert. The failure surface is invisible until a tool call fails.

---

## Risks

| Risk | Severity | Notes |
|---|---|---|
| PAT stored in prohibited location (config file, env var, shell profile) | High | Directly violates CTRL-HMCP-000001 and platform secrets policy |
| PAT committed to repository accidentally | Critical | Would represent a permanent secret exposure regardless of later removal |
| Credential usage not auditable | High | No record of when or how frequently the PAT is used |
| PAT expiry causes silent service degradation | Medium | No platform-level monitoring for credential validity |
| Pattern propagates to future integrations | High | Undocumented credential handling will be replicated unless documented and corrected now |

---

## Current Workaround or Operating Assumption

No formal workaround exists. Current operating assumption:

- The PAT is stored somewhere accessible to the MCP server process on dude-mcp-01
- It is assumed (not confirmed) to not be in the repository
- No platform audit record exists for any PAT access event

This assumption is insufficient for compliance attestation.

---

## Desired Future Capability

The platform should be able to:

1. **Document** the exact storage location and retrieval mechanism for every credential used by platform-integrated MCP servers
2. **Validate** that each credential's retrieval path conforms to CTRL-HMCP-000001
3. **Observe** credential access events via `secret.retrieval` audit events, including: secret identifier (non-sensitive reference), retrieval mechanism, execution context, and outcome
4. **Track** credential lifecycle — when it was last validated, when it expires, and whether it has been rotated
5. **Alert** when a credential access fails or when a credential approaches expiry

---

## Out of Scope

- Implementing changes to how the PAT is stored or retrieved
- Rotating or replacing the current PAT
- Modifying GitHub MCP server authentication behavior
- Designing the audit emission mechanism

---

## Open Questions

1. Where is the GitHub PAT currently stored on dude-mcp-01 — in a Claude Code MCP config file, a shell environment, or elsewhere?
2. Is Keeper Commander involved in PAT retrieval, or is the credential statically configured?
3. What is the PAT's scope — does it have minimum necessary permissions, or is it broadly scoped?
4. When was the PAT last rotated, and what is its expiry?
5. Is the PAT shared across multiple tools or agents, or is it exclusive to the GitHub MCP server?
6. How should the `secret_identifier` field in audit events reference a PAT without exposing the token value?

---

## Suggested Follow-On Work

| ID | Type | Description |
|---|---|---|
| (Operational) | Investigation | Document the GitHub PAT storage location on dude-mcp-01 and validate against CTRL-HMCP-000001 |
| (Operational) | Remediation | If PAT is stored in a non-compliant location, migrate to a compliant retrieval path |
| ADR-HMCP-001 (secret retrieval) | ADR | Decision on platform-approved mechanism for runtime secret retrieval applies directly to this gap |
| (TBD) | Schema | Ensure `secret.retrieval` event type supports PAT-style credential references |
| VG-HMCP-000001 | VG | Resolution of Keeper non-interactive retrieval gap is a prerequisite for fully closing this gap |

---
