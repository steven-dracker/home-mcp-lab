# Tool Risk Classification — CTRL-HMCP-000001

**Status:** Active  
**Implemented by:** CC-HMCP-000009  
**Schema version:** 0.1.0

---

## Purpose

Establishes a formal risk classification model for MCP tools. Every tool registered in the platform is assigned a risk level. This classification:

- Attaches risk context to audit events at the point of tool invocation
- Provides the data foundation for future control-layer enforcement
- Makes tool risk visible in the audit log without requiring manual annotation

---

## Risk Level Definitions

| Level | Meaning | Side Effects |
|---|---|---|
| `LOW` | Read-only, no external side effects | None. Data is read but not written or transmitted beyond the MCP server boundary. |
| `MEDIUM` | Limited external interaction | May read sensitive content or traverse access boundaries. Minor additive side effects permitted. |
| `HIGH` | Writes, mutations, or external system interaction | Changes are made to external systems (repositories, issues, PRs). Typically reversible but require explicit authorization. |
| `DESTRUCTIVE` | Irreversible or high-impact actions | Deletions, force operations, or actions that could cause data loss or service disruption. No automatic undo. |

---

## Registry

The classification registry lives at:

```
config/tool-classifications.json
```

Each entry conforms to `schemas/tool-classification.schema.json`.

Required fields per entry:

| Field | Type | Description |
|---|---|---|
| `tool_name` | string | Exact tool name as exposed by the MCP server |
| `risk_level` | enum | `LOW`, `MEDIUM`, `HIGH`, or `DESTRUCTIVE` |
| `description` | string | What the tool does |
| `rationale` | string | Why this risk level was assigned |
| `allowed_by_default` | boolean | Whether the tool is currently permitted without additional approval |

---

## Seeded Classifications (GitHub MCP Server)

| Tool | Risk Level | Allowed by Default |
|---|---|---|
| `get_me` | LOW | yes |
| `search_repositories` | LOW | yes |
| `list_issues` | LOW | yes |
| `list_commits` | LOW | yes |
| `get_file_contents` | MEDIUM | yes |
| `get_pull_request` | MEDIUM | yes |
| `add_comment_to_pending_review` | MEDIUM | yes |
| `create_issue` | HIGH | yes |
| `update_pull_request` | HIGH | yes |
| `create_or_update_file` | HIGH | yes |
| `merge_pull_request` | HIGH | no |
| `delete_branch` | DESTRUCTIVE | no |

---

## How Classification Is Used

At the point of tool invocation, the emitter automatically resolves the tool's risk level from the registry:

1. The instrumentation layer calls `emitToolInvocation` or `withToolInstrumentation`
2. The emitter looks up `toolName` in `config/tool-classifications.json`
3. If found, `risk_level` is attached to the event's `metadata` field
4. The event is emitted to the audit log with risk context intact

Callers may also supply `riskLevel` directly in the context object. An explicit caller-supplied value takes precedence over the registry lookup.

If a tool is not in the registry, `risk_level` is omitted from the event. The event is still emitted — the lookup is advisory, not blocking.

### Example Event (tool.invocation with risk_level)

```json
{
  "schema_version": "0.2.0",
  "event_id": "a3f7c12e-4b91-4d2a-9f0e-1c8d6e3b2a57",
  "event_type": "tool.invocation",
  "timestamp": "2026-04-07T14:00:00Z",
  "platform": "home-mcp-lab",
  "project_id": "home-mcp-lab",
  "agent_id": "claude-code-session-dude-mcp-01",
  "mcp_server": "github-mcp-server",
  "action": "create_or_update_file",
  "status": "success",
  "correlation_id": "sess-20260407-abc123",
  "metadata": {
    "tool_name": "create_or_update_file",
    "risk_level": "HIGH",
    "arguments_summary": "path=src/emitter/index.js, message=feat: add risk classification",
    "execution_duration_ms": 312
  }
}
```

---

## Adding New Classifications

To register a new tool:

1. Add an entry to `config/tool-classifications.json` conforming to `schemas/tool-classification.schema.json`
2. Choose the most conservative risk level that accurately describes the tool's capabilities
3. Set `allowed_by_default: false` for any HIGH or DESTRUCTIVE tool unless there is a specific operational reason to permit it
4. Submit the change via a feature branch and PR

---

## Relationship to Future Controls

This classification is the data foundation for the next control-layer tasks:

| Task | Dependency |
|---|---|
| CTRL-HMCP-000002 (planned) | Uses `risk_level` to gate tool execution at the platform boundary |
| CTRL-HMCP-000003 (planned) | Uses `allowed_by_default` to determine approval requirements |

No enforcement logic is implemented here. This task (CC-HMCP-000009) is classification and instrumentation only.

---

## Non-Goals

- No enforcement, deny rules, or approval workflows — those are CTRL-HMCP-000002 and beyond
- No cross-project classification inheritance — each project manages its own tool set
- No dynamic risk escalation based on argument content — classification is per tool, not per call
