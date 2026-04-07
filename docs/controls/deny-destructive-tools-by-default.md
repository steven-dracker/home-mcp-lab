# Deny Destructive Tools by Default — CTRL-HMCP-000002

**Status:** Active  
**Implemented by:** CC-HMCP-000010  
**Depends on:** CTRL-HMCP-000001 (Tool Risk Classification)

---

## Purpose

Implements the first enforcement control in the MCP control layer. Tools classified as `DESTRUCTIVE` with `allowed_by_default=false` are blocked by default before execution proceeds. The denial is recorded as an audit event.

---

## How Deny-by-Default Works

At the point of tool invocation, the caller invokes `checkAndEnforcePolicy(context)` before passing the tool call to the underlying MCP transport.

The policy gate:

1. Looks up the tool in `config/tool-classifications.json`
2. Checks whether `risk_level === 'DESTRUCTIVE'` and `allowed_by_default === false`
3. If both conditions are met and no override is active, the decision is `denied`
4. A `tool.denial` audit event is emitted with the tool name, risk level, and denial reason
5. The decision object is returned to the caller — the caller must not execute the tool if `allowed === false`

If the tool is not in the registry, it is allowed (unclassified tools are not subject to this enforcement gate).

---

## What Qualifies as DESTRUCTIVE

A tool is classified `DESTRUCTIVE` when it:

- Performs irreversible operations (deletions, truncations, force operations)
- Can cause data loss that has no automatic undo path
- Could cause significant service disruption

Current `DESTRUCTIVE` tools in the registry:

| Tool | Description |
|---|---|
| `delete_branch` | Deletes a branch; unmerged commits may be lost |

See `config/tool-classifications.json` for the full registry. See `docs/controls/tool-risk-classification.md` for classification definitions and the process for adding new entries.

---

## Denial Result Structure

`checkAndEnforcePolicy(context)` returns a decision object:

```json
{
  "allowed": false,
  "toolName": "delete_branch",
  "riskLevel": "DESTRUCTIVE",
  "reason": "policy_denied",
  "policyBasis": "destructive_tool_not_allowed_by_default"
}
```

| Field | Type | Values |
|---|---|---|
| `allowed` | boolean | `true` / `false` |
| `toolName` | string | tool name as passed |
| `riskLevel` | string\|null | `LOW` / `MEDIUM` / `HIGH` / `DESTRUCTIVE` / `null` |
| `reason` | string | `allowed` / `policy_denied` / `override_allowed` |
| `policyBasis` | string | machine-readable policy explanation |

---

## Audit Evidence

When a tool is denied, a `tool.denial` event is emitted:

```json
{
  "schema_version": "0.2.0",
  "event_id": "...",
  "event_type": "tool.denial",
  "timestamp": "2026-04-07T14:00:00Z",
  "platform": "home-mcp-lab",
  "project_id": "home-mcp-lab",
  "agent_id": "claude-code-session-dude-mcp-01",
  "mcp_server": "github-mcp-server",
  "action": "delete_branch",
  "status": "failure",
  "correlation_id": "sess-20260407-abc123",
  "metadata": {
    "tool_name": "delete_branch",
    "risk_level": "DESTRUCTIVE",
    "denial_reason": "policy_denied",
    "policy_basis": "destructive_tool_not_allowed_by_default"
  }
}
```

The `tool.denial` event is defined in `schemas/audit-event.schema.json`.

---

## Override Mechanism

Override is intentional by design. Two paths are available:

### Option 1 — Per-call context flag

Pass `allowDestructive: true` in the execution context:

```javascript
const decision = checkAndEnforcePolicy({
  toolName: 'delete_branch',
  projectId: 'home-mcp-lab',
  agentId: 'claude-code-1',
  mcpServer: 'github-mcp-server',
  correlationId: sessionCtx.correlationId,
  allowDestructive: true  // explicit override
});
```

When override is active, `reason` is `override_allowed` and `policyBasis` is `destructive_tool_allowed_by_explicit_override`. The decision is logged at the caller's discretion.

### Option 2 — Environment variable

Set `HMCP_ALLOW_DESTRUCTIVE=true` in the process environment.

This is intended for lab use only. It unlocks all `DESTRUCTIVE` tools for the lifetime of the process. It must not be set in production or CI environments.

**Both override paths are intentional acts. Neither is ever active by default.**

To restore deny-by-default:
- Remove `allowDestructive: true` from the context, or
- Unset the environment variable

---

## Integration Pattern

```javascript
const { checkAndEnforcePolicy, withToolInstrumentation } = require('./src/emitter');

// In the session invocation path:
const decision = checkAndEnforcePolicy({
  toolName,
  projectId,
  agentId,
  mcpServer,
  correlationId
});

if (!decision.allowed) {
  // Tool is denied. Do not invoke. The denial event is already emitted.
  return { denied: true, reason: decision.reason, policyBasis: decision.policyBasis };
}

// Allowed — proceed with instrumented invocation.
return withToolInstrumentation({ toolName, projectId, agentId, mcpServer, correlationId }, fn);
```

---

## Relationship to Other Controls

| Control | Status | Dependency |
|---|---|---|
| CTRL-HMCP-000001 — Tool Risk Classification | Active | Required — provides the risk level and `allowed_by_default` data this gate reads |
| CTRL-HMCP-000002 — Deny Destructive by Default | **Active (this doc)** | — |
| CTRL-HMCP-000003 — Approval-Required Execution (planned) | Planned | Will extend the policy gate to add an approval flow for HIGH tools before execution |

CTRL-HMCP-000003 will build on this gate. The `evaluatePolicy` function in `src/policy/policy-gate.js` is designed to be extended with additional enforcement tiers without breaking the existing denial path.

---

## Non-Goals

This control does not:

- Block HIGH, MEDIUM, or LOW tools
- Implement approval workflows
- Apply any logic based on argument content
- Enforce per-project or per-agent policies

Those are out of scope and reserved for future controls.
