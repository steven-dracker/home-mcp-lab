# VG-HMCP-000002 — MCP Tool Invocation Visibility Gap

**Status:** Closed  
**Date:** 2026-03-31  
**Closed:** 2026-04-02 (CC-HMCP-000005D)  
**Related Prompt:** CC-HMCP-000002C  
**Source Integration:** CC-HMCP-000002B — GitHub MCP Integration Assessment  

---

## Summary

The platform has no visibility into MCP tool invocations at runtime. When an agent calls a tool through an MCP server, no audit event is emitted, no record is created, and the platform cannot observe what was called, by whom, with what arguments, or what the outcome was. This gap was surfaced during the GitHub MCP server integration assessment, but it applies to all MCP servers connected to the platform.

---

## Affected Platform Area

- Audit observability (tool invocation events)
- Compliance attestation
- Control pattern enforcement foundation (CTRL-HMCP-*)
- Integration contract audit emission requirement

---

## Closure Evidence (CC-HMCP-000005D — 2026-04-02)

Live validation confirmed end-to-end `tool.invocation` event emission and ingestion:

- **Session:** correlation_id `sess-20260402-fa14ce77`
- **MCP server:** `@modelcontextprotocol/server-github` (npm, v2025.4.8) via stdio
- **PAT:** real GitHub PAT (not stored)
- **Tool calls made:**
  - `search_repositories` — status: success, duration: 392ms, result: 3 real repos returned
  - `get_file_contents` — status: success, duration: 114ms, result: README.md content returned
- **Events ingested (4 total):**
  - `session.start` — event_id `51965d12-0431-45ad-9af6-869de596e1e5`
  - `tool.invocation` (search_repositories) — event_id `629a0af2-276f-4802-b339-f2882cac9e6f`, status: success
  - `tool.invocation` (get_file_contents) — event_id `11cb164f-4f01-47d7-9c24-964a6e5d6a2f`, status: success
  - `session.end` — event_id `d4cc5ee7-9b19-4d4d-876a-fa960042132a`, duration_ms: 1488
- **Schema:** v0.2.0, all events carry correlation_id, agent_id, project_id, mcp_server, initiating_context
- **Ingestion path:** HTTP delivery to `POST /events`, deduplication by event_id, persisted to JSONL

The platform now has full visibility into MCP tool invocations. The instrumentation layer is `session-runner.js` wrapping `withToolInstrumentation` from the emitter.

---

## Prior State (original, retained for history)

- The GitHub MCP server is connected on dude-mcp-01 and is actively used by Claude Code sessions
- Tool calls (file reads, PR creation, issue management, etc.) execute successfully
- No platform audit events of type `tool.invocation` are emitted for any tool call
- The audit event schema (`schemas/audit-event.schema.json`) defines the `tool.invocation` event type, but no mechanism exists to populate it
- The integration contract requires audit event emission; this requirement is currently unmet
- No platform-side instrumentation layer (proxy, wrapper, or middleware) exists to intercept and log tool calls

---

## Visibility Gap

The platform cannot currently:

1. **Observe** which tools are called during any agent session
2. **Record** the agent or session identity associated with a tool call
3. **Capture** non-sensitive argument context (e.g., which repository, which file, which issue)
4. **Detect** tool call failures or error outcomes
5. **Correlate** tool calls within a single workflow or session
6. **Distinguish** high-risk tool invocations (writes, merges, deletes) from low-risk ones (reads) in real time or after the fact

The gap is not limited to the GitHub MCP server. It applies to every MCP server connected to the platform because no instrumentation mechanism exists at the platform layer.

---

## Why This Matters

- **Audit posture is empty** — the platform claims audit ownership but currently produces no tool call audit records. The audit log is structurally defined but operationally empty.
- **High-risk operations are invisible** — destructive or external-impact operations (file writes, PR merges, issue updates) execute without any platform record. These are the operations most in need of oversight.
- **Control validation is impossible** — control patterns that govern tool behavior (present and future) cannot be validated without tool call visibility. Controls without observability are unenforceable.
- **Incident investigation has no record** — if an agent performs an unintended action, the platform has no log to reconstruct what happened.
- **Integration contract is structurally unmet** — the requirement for audit event emission is the core obligation in the integration contract. Without it, no project can be considered platform-compliant.

---

## Risks

| Risk | Severity | Notes |
|---|---|---|
| High-risk tool calls (writes, merges, deletes) execute without audit record | Critical | No post-hoc accountability or incident reconstruction possible |
| Compliance attestation is not achievable | High | Platform cannot attest to tool behavior without observability |
| Control patterns cannot be validated | High | All future CTRL-HMCP work depends on having tool call visibility |
| Pattern drift goes undetected | Medium | Agents may invoke tools outside intended scope with no platform awareness |
| Integration contract remains structurally unmet | High | No project can achieve compliant status until this gap is closed |

---

## Current Workaround or Operating Assumption

No formal workaround exists. Current operating assumption:

- Claude Code session transcripts in the IDE implicitly capture tool call context for the operator
- No platform-level record is produced or retained
- The platform is operating in a trust-without-verify posture for all tool invocations

This is not an acceptable long-term posture.

---

## Desired Future Capability

The platform should be able to:

1. **Record** a `tool.invocation` audit event for every MCP tool call, conforming to `schemas/audit-event.schema.json`
2. **Capture** at minimum: timestamp, agent identity, tool name, server identity, outcome (success/failure), and correlation ID
3. **Distinguish** risk levels at event time, enabling downstream filtering and alerting
4. **Store** events in a queryable form so that tool call history can be reconstructed
5. **Correlate** events across a session using the `correlation_id` field
6. **Operate** without modification to individual MCP server code — the instrumentation layer should be platform-owned

---

## Out of Scope

- Implementing the instrumentation layer (documentation only)
- Designing the storage or transport mechanism for audit events
- Modifying GitHub MCP server code
- Defining alerting or real-time control enforcement

---

## Open Questions

1. What is the appropriate instrumentation mechanism — a platform-side proxy, a session wrapper, or an agent-side emission convention?
2. Should event emission be synchronous (blocking) or asynchronous (fire-and-forget)?
3. How should non-sensitive argument context be captured without risking accidental sensitive data inclusion?
4. What is the minimum viable instrumentation that closes this gap without requiring changes to every MCP server?
5. Should high-risk tool invocations trigger different treatment (e.g., require confirmation event, additional metadata)?

---

## Suggested Follow-On Work

| ID | Type | Description |
|---|---|---|
| ADR-HMCP-002 | ADR | MCP tool call instrumentation strategy — evaluate and decide on the platform-approved mechanism for capturing tool invocation events |
| CTRL-HMCP-002 | Control Pattern | Tool invocation observability control — define requirements for audit event emission at tool call boundaries |
| (TBD) | Schema | Extend audit schema with session lifecycle event types to enable correlation |
| (TBD) | Workflow | Instrumentation implementation runbook once ADR decision is made |

---
