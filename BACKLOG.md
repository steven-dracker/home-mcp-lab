# Home MCP Compliance Lab — Backlog

---

## Active

- CC-HMCP-000001E — TBD (architect to define next task)

---

## To-Do

- Project integration contract — define the interface a project must implement to plug into the platform (tool declaration, audit event emission, control application, gap reporting)
- Audit event schema — canonical schema for MCP tool call events (who, what tool, what args, what outcome, when)
- First workflow — operational runbook for a common scenario (e.g., adding a new MCP server to the platform)
- Control pattern register — CTRL-HMCP-* framework and first patterns for common MCP risk surfaces

---

## Planned

- ADR-HMCP-001 — Runtime secret retrieval strategy (triggered by VG-HMCP-000001)
- CTRL-HMCP-001 — Secret retrieval control pattern (triggered by VG-HMCP-000001)
- First ADR — ADR-HMCP-002: platform vs project separation decision
- First project integration — plug one existing MCP server into the platform (candidate: GitHub MCP on dude-mcp-01)
- Audit event storage — decide where audit events are stored and how they are queried

---

## Done

- CC-HMCP-000001A — Repository bootstrap (2026-03-31)
- CC-HMCP-000001B — Operating model, conventions, and platform definition (2026-03-31)
- CC-HMCP-000001C — Architecture synchronized with current homelab reality (2026-03-31)
- CC-HMCP-000001D — First visibility gap artifact: VG-HMCP-000001 Keeper non-interactive secret retrieval (2026-03-31)
