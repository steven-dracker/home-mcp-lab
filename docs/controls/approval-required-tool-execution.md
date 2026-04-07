# CTRL-HMCP-000003 — Approval-Required Tool Execution

## Control Summary

| Field | Value |
|---|---|
| Control ID | CTRL-HMCP-000003 |
| Implemented by | CC-HMCP-000011 |
| Status | Active |
| Enforcement tier | Tier 2 (HIGH tools) |
| Depends on | CTRL-HMCP-000001 (Tool Risk Classification), CTRL-HMCP-000002 (Deny Destructive Tools by Default) |

---

## Purpose

Extends the policy gate introduced in CTRL-HMCP-000002 with a second enforcement tier for `HIGH` risk tools that have `allowed_by_default: false`.

Where CTRL-HMCP-000002 denies `DESTRUCTIVE` tools outright, this control blocks `HIGH` tools pending an explicit, auditable approval signal. The distinction is intentional:

- `DESTRUCTIVE` tools are categorically blocked unless overridden (no routine approval path)
- `HIGH` tools with `allowed_by_default: false` require deliberate approval before each execution, producing audit evidence

---

## Enforcement Model

### Two-Tier Policy Gate

The policy gate (`src/policy/policy-gate.js`) evaluates tools in tier order:

**Tier 1 — DESTRUCTIVE (CTRL-HMCP-000002)**
- Applies to: `risk_level = DESTRUCTIVE` AND `allowed_by_default = false`
- Default outcome: `policy_denied` — outright denial, no approval path
- Override: `allowDestructive: true` in context, or `HMCP_ALLOW_DESTRUCTIVE=true` env var

**Tier 2 — HIGH approval-required (CTRL-HMCP-000003)**
- Applies to: `risk_level = HIGH` AND `allowed_by_default = false`
- Default outcome: `requires_approval` — execution blocked pending approval
- Approval: `approvalGranted: true` in context, or `HMCP_APPROVAL_GRANTED=true` env var

Tools that match neither tier proceed normally (`allowed`).

---

## Which Tools Require Approval

Approval is required for tools registered in `config/tool-classifications.json` with:
- `risk_level: "HIGH"`
- `allowed_by_default: false`

**Current approval-required tools:**

| Tool | Risk Level | Rationale |
|---|---|---|
| `merge_pull_request` | HIGH | Integrates changes into target branch; affects production branches if unscoped; reversible only via revert |

Tools with `risk_level: "HIGH"` and `allowed_by_default: true` (e.g., `create_issue`, `create_or_update_file`, `update_pull_request`) are **not** subject to this control — they execute normally without an approval signal.

---

## Decision Result Shape

### When approval is required but not satisfied

```json
{
  "allowed": false,
  "toolName": "merge_pull_request",
  "riskLevel": "HIGH",
  "reason": "requires_approval",
  "policyBasis": "high_risk_tool_requires_approval",
  "approvalRequired": true,
  "approvalSatisfied": false,
  "approvalMechanism": null
}
```

### When approval is explicitly satisfied

```json
{
  "allowed": true,
  "toolName": "merge_pull_request",
  "riskLevel": "HIGH",
  "reason": "approved",
  "policyBasis": "high_risk_tool_allowed_by_explicit_approval",
  "approvalRequired": true,
  "approvalSatisfied": true,
  "approvalMechanism": "context_flag"
}
```

`reason` values introduced by this control: `requires_approval` | `approved`

Full `reason` vocabulary (all tiers):
`allowed` | `policy_denied` | `override_allowed` | `requires_approval` | `approved`

---

## How Approval Is Satisfied

Two mechanisms, both intentional acts — neither is ever the default.

### 1. Per-call context flag

Pass `approvalGranted: true` in the context object passed to `checkAndEnforcePolicy`:

```js
const decision = checkAndEnforcePolicy({
  toolName: 'merge_pull_request',
  projectId: 'home-mcp-lab',
  agentId: 'claude-code-session',
  mcpServer: 'github-mcp-server',
  correlationId: 'sess-20260407-abc123',
  approvalGranted: true   // explicit approval for this call
});

if (decision.allowed) {
  // proceed with tool execution
}
```

Produces `approvalMechanism: 'context_flag'` in the decision and audit event.

### 2. Environment variable

Set `HMCP_APPROVAL_GRANTED=true` in the process environment. Applies for the lifetime of the process.

```bash
HMCP_APPROVAL_GRANTED=true node my-script.js
```

Produces `approvalMechanism: 'env_var'` in the decision and audit event.

Removing either mechanism restores the approval-required behavior with no code changes.

---

## Audit Events

### tool.denial — approval pending

Emitted when the tool is blocked by this control (`requires_approval`). Includes `approval_required: true` in metadata to distinguish from outright denial (`policy_denied`).

```json
{
  "event_type": "tool.denial",
  "action": "merge_pull_request",
  "status": "failure",
  "metadata": {
    "tool_name": "merge_pull_request",
    "risk_level": "HIGH",
    "denial_reason": "requires_approval",
    "policy_basis": "high_risk_tool_requires_approval",
    "approval_required": true
  }
}
```

### tool.approval_granted — approval satisfied

Emitted when approval is explicitly satisfied and execution is permitted. Precedes the `tool.invocation` event for the same call.

```json
{
  "event_type": "tool.approval_granted",
  "action": "merge_pull_request",
  "status": "success",
  "metadata": {
    "tool_name": "merge_pull_request",
    "risk_level": "HIGH",
    "policy_basis": "high_risk_tool_allowed_by_explicit_approval",
    "approval_mechanism": "context_flag"
  }
}
```

### tool.invocation — normal execution event

After `tool.approval_granted`, the instrumentation layer emits a standard `tool.invocation` event on completion. Both events share the same `correlation_id`.

---

## Integration Pattern

```
caller calls checkAndEnforcePolicy(context)
  └── policy gate evaluates tier 2 rule
        ├── approval missing  → returns { allowed: false, reason: 'requires_approval' }
        │                        emits tool.denial (denial_reason: 'requires_approval')
        └── approval present  → returns { allowed: true, reason: 'approved' }
                                 emits tool.approval_granted
                                 caller proceeds → emits tool.invocation
```

The caller is always responsible for gating execution on `decision.allowed`. The policy gate never invokes or blocks the tool directly.

---

## Relationship to Other Controls

| Control | Scope | Outcome when triggered |
|---|---|---|
| CTRL-HMCP-000001 | Classifies tools by risk level | Provides input to enforcement |
| CTRL-HMCP-000002 | DESTRUCTIVE + `allowed_by_default=false` | Outright denial (`policy_denied`) |
| CTRL-HMCP-000003 (this) | HIGH + `allowed_by_default=false` | Blocked pending approval (`requires_approval`) or explicitly allowed (`approved`) |

Tier 1 is evaluated before tier 2. A tool cannot simultaneously trigger both tiers.

---

## Future Extension Points

This control is designed to be tightened without architectural changes:

- Narrow approval scope: add per-tool approval checks (rather than per-risk-level)
- Strengthen approval mechanism: replace env var with a token, signed payload, or external authorization call
- Add expiry: scope approval to a session or time window
- Add multi-step: require approval from a second party before `approvalGranted` is populated

None of these require changes to the decision shape or audit schema. The `approvalMechanism` field in `tool.approval_granted` events provides a hook for distinguishing mechanism types as they evolve.
