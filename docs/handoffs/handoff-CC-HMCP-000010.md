# Handoff — 2026-04-07 / CC-HMCP-000010

## Current System State

- **Last Completed Task:** CC-HMCP-000010 — Deny Destructive Tools by Default (CTRL-HMCP-000002)
- **Current Phase:** Control Layer — early enforcement
- **Active Branch:** `feature/cc-hmcp-000010-deny-destructive-tools-by-default`
- **PR Status:** PR #65 open — pending merge
- **Main Branch:** clean through PR #64 (CC-HMCP-000009 — Tool Risk Classification)

---

## Completed Work (This Session)

### CC-HMCP-000009 — Tool Risk Classification (PR #64, merged)

- `schemas/tool-classification.schema.json` — schema for registry entries; defines `tool_name`, `risk_level` (enum), `description`, `rationale`, `allowed_by_default`
- `config/tool-classifications.json` — registry seeded with 12 GitHub MCP tool classifications across LOW / MEDIUM / HIGH / DESTRUCTIVE
- `src/emitter/classification-registry.js` — registry loader; `lookupRiskLevel(toolName)` returns risk level or null
- `src/emitter/event-builder.js` — `buildToolInvocationEvent` attaches `risk_level` to metadata when present in context
- `src/emitter/index.js` — `emitToolInvocation` auto-resolves `risk_level` from registry before event construction
- `schemas/audit-event.schema.json` — `risk_level` documented in `tool.invocation` metadata fields
- `docs/controls/tool-risk-classification.md` — full model definition, seeded classifications table, usage guide

### CC-HMCP-000010 — Deny Destructive Tools by Default (PR #65, open)

- `src/policy/policy-gate.js` — pure policy decision module; `evaluatePolicy(toolName, executionContext)` reads the full registry (including `allowed_by_default`), applies enforcement rule, checks override state, returns a structured decision with no side effects
- `src/emitter/index.js` — adds `checkAndEnforcePolicy(context)`; the single enforcement call site; emits `tool.denial` when denied; returns decision to caller
- `src/emitter/event-builder.js` — adds `buildToolDenialEvent`; builds `tool.denial` events conforming to schema shape
- `schemas/audit-event.schema.json` — `tool.denial` added to `event_type` enum and definitions block
- `docs/controls/deny-destructive-tools-by-default.md` — full control documentation: deny behavior, override paths, denial result shape, audit evidence example, integration pattern, relationship to CTRL-HMCP-000001/000003
- `tests/validate-policy-gate.js` — 21 tests; all pass

---

## Current Behavior

### Policy Evaluation

When a caller invokes `checkAndEnforcePolicy(context)`, the system:

1. Loads `config/tool-classifications.json` (cached after first load)
2. Looks up the tool by name to retrieve its `risk_level` and `allowed_by_default` flag
3. Applies the enforcement rule: a tool is subject to denial only when `risk_level === 'DESTRUCTIVE'` AND `allowed_by_default === false`
4. Checks for an active override (see below)
5. Returns a structured decision object to the caller

The caller is responsible for gating execution on `decision.allowed`. The policy gate does not throw or invoke the tool itself.

### When Destructive Tools Are Denied

A tool is denied when:
- It is registered in `config/tool-classifications.json` with `risk_level: "DESTRUCTIVE"` and `allowed_by_default: false`
- No override is active

Currently the only `DESTRUCTIVE` tool in the registry is `delete_branch`.

HIGH tools with `allowed_by_default: false` (e.g., `merge_pull_request`) are **not** subject to this enforcement gate — only `DESTRUCTIVE` tools trigger it. This is intentional; HIGH enforcement is reserved for CTRL-HMCP-000003.

### Decision Result Shape

```json
{
  "allowed": false,
  "toolName": "delete_branch",
  "riskLevel": "DESTRUCTIVE",
  "reason": "policy_denied",
  "policyBasis": "destructive_tool_not_allowed_by_default"
}
```

`reason` values: `allowed` | `policy_denied` | `override_allowed`

### Override Mechanism

Two paths, both intentional — neither is ever the default:

1. **Per-call context flag:** pass `allowDestructive: true` in the context object passed to `checkAndEnforcePolicy`. Produces `reason: override_allowed`.
2. **Environment variable:** set `HMCP_ALLOW_DESTRUCTIVE=true`. Applies for the lifetime of the process. Lab use only.

Removing either restores deny-by-default with no code changes.

### Audit Events Emitted

When a tool is denied, `checkAndEnforcePolicy` emits a `tool.denial` event before returning:

```json
{
  "event_type": "tool.denial",
  "action": "delete_branch",
  "status": "failure",
  "metadata": {
    "tool_name": "delete_branch",
    "risk_level": "DESTRUCTIVE",
    "denial_reason": "policy_denied",
    "policy_basis": "destructive_tool_not_allowed_by_default"
  }
}
```

When a tool is allowed, no additional event is emitted by the policy gate. The normal `tool.invocation` event is emitted by the instrumentation layer as before.

### Behavior for Unknown Tools

Tools not in the registry are allowed. Unclassified tools are outside the enforcement scope. `riskLevel` is `null` and `policyBasis` is `unclassified_tool_allowed` in the returned decision.

---

## Known Issues / Gaps

- **Missing `@modelcontextprotocol/sdk`:** 8 tests in `tests/validate-mcp-transport.js` fail because this npm dependency is not installed on the current machine. These failures are pre-existing and unrelated to the control layer work. All 21 policy gate tests pass.
- **Enforcement is caller-invoked, not universal:** `checkAndEnforcePolicy` is a function callers must explicitly call. There is no automatic interception at a transport or MCP protocol layer. Callers who do not call it are not subject to enforcement. This is a known architectural limitation of the Model C (agent-mediated) instrumentation approach (ADR-HMCP-002).
- **No approval workflow:** DESTRUCTIVE tools are denied outright with no approval path. This is intentional — approval-required execution is CTRL-HMCP-000003.
- **VG-HMCP-000001:** Keeper service-context viability on dude-mcp-01 — open, no new evidence.
- **VG-HMCP-000003:** GitHub PAT retrieval path visibility — implementation complete; awaiting live end-to-end validation on dude-mcp-01 with `EVENT_INGESTION_URL` set before full closure.

---

## Open Backlog (Relevant Subset)

- **CTRL-HMCP-000003** — Approval-required tool execution for HIGH tools (natural next step after this task)
- **TD-HMCP-000003** — Event completeness validation: verify that `tool.denial` and `tool.invocation` events are received and persisted correctly by the ingestion server under real conditions
- **VG-HMCP-000003** — Live validation of `secret.retrieval` event emission on dude-mcp-01 (outstanding from Phase 2.5)

---

## Recommended Next Task

**CTRL-HMCP-000003 — Approval-Required Tool Execution**

The policy gate introduced in CC-HMCP-000010 is designed to be extended. The natural next step is to add a second enforcement tier for `HIGH` tools with `allowed_by_default: false` (e.g., `merge_pull_request`) that requires an explicit approval signal rather than an outright deny — building directly on `evaluatePolicy` in `src/policy/policy-gate.js` without breaking the existing DESTRUCTIVE denial path.

---

## Resume Instructions

1. Merge PR #65 if not yet merged
2. `git checkout main && git pull origin main`
3. Verify the registry, policy-gate, and emitter are present on main (`config/tool-classifications.json`, `src/policy/policy-gate.js`, `src/emitter/index.js`)
4. Create a new feature branch: `git checkout -b feature/cc-hmcp-000011-approval-required-execution` (or architect-assigned ID)
5. Do not rely on the boot block (`CLAUDE.md`) for current state — it is stale. This handoff is authoritative.
6. Paste `chatgpt-primer.md` + this handoff into ChatGPT to restore architect context before generating the next prompt
