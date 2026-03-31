# VG-HMCP-000004 — MCP Session Lifecycle Visibility Gap

**Status:** Open  
**Date:** 2026-03-31  
**Related Prompt:** CC-HMCP-000002C  
**Source Integration:** CC-HMCP-000002B — GitHub MCP Integration Assessment  

---

## Summary

The platform has no visibility into MCP session lifecycle events — when a session starts, when it ends, which agent initiated it, and what execution boundary it represents. Without session boundary events, tool call audit records cannot be grouped, correlated, or attributed to a coherent unit of work. This gap makes audit trace reconstruction impossible even if tool invocation visibility (VG-HMCP-000002) is resolved.

---

## Affected Platform Area

- Audit observability (session lifecycle events)
- Event correlation (`correlation_id` field usage)
- Audit trace completeness
- Agent identity attribution

---

## Current State

- Claude Code sessions connect to MCP servers on dude-mcp-01 to perform tool calls
- Sessions begin and end without emitting any platform-observable event
- No session start, session end, or session summary event type exists in `schemas/audit-event.schema.json`
- The `correlation_id` field in the audit schema is defined and intended for grouping related events, but there is no mechanism to establish or broadcast a correlation ID at session start
- The `agent_id` field in the audit schema is defined, but there is no session initiation event that declares the agent identity before tool calls begin
- Session duration, scope, and outcomes are entirely unobservable at the platform level

---

## Visibility Gap

The platform cannot currently:

1. **Detect** when an MCP session begins or ends
2. **Identify** which agent or user initiated a session
3. **Establish** a correlation boundary across which tool call events should be grouped
4. **Determine** the intended scope or purpose of a session before or after it occurs
5. **Reconstruct** the full sequence of actions taken within a session, even if individual tool call events were available
6. **Attribute** a set of tool invocations to a single decision-making agent or workflow instance

Without session lifecycle visibility, tool call events (if and when captured via VG-HMCP-000002 resolution) are a disconnected stream of actions with no grouping, no context, and no causal chain.

---

## Why This Matters

- **Correlation requires anchors** — the `correlation_id` field in the audit schema is only useful if something establishes it at session start. Without a session start event, correlation IDs either cannot be set or must be inferred, which is unreliable.
- **Agent attribution requires declaration** — knowing that a tool was called is useful; knowing that a specific agent called it as part of a specific task is necessary for compliance. Session start events are the natural place to declare agent identity and intent.
- **Audit completeness depends on boundaries** — an audit trail that has a middle but no beginning or end is incomplete. Regulators, architects, and incident investigators all need to understand what a session was doing, not just individual actions within it.
- **Multi-session workflows are invisible** — workflows that span multiple sessions (e.g., a multi-step process over several days) have no platform-level continuity. Without lifecycle events, the platform cannot distinguish related sessions from unrelated ones.
- **Session failure modes are unobservable** — if a session ends unexpectedly (error, timeout, disconnect), the platform has no record of the incomplete state. Orphaned in-progress workflows cannot be detected.

---

## Risks

| Risk | Severity | Notes |
|---|---|---|
| Tool call events cannot be correlated without session anchors | High | Disconnected events are not actionable for audit or investigation |
| Agent identity cannot be confirmed at event attribution | High | Tool calls attributed to an unknown agent are not auditable |
| Incomplete workflows are undetectable | Medium | Platform cannot identify in-progress or abandoned sessions |
| Cross-session workflows have no continuity | Medium | Multi-session tasks appear as unrelated event streams |
| Session-level anomalies (unusually long, unusually high volume) are invisible | Medium | No baseline or threshold can be applied without session boundaries |

---

## Current Workaround or Operating Assumption

No formal workaround exists. Current operating assumption:

- Session context is implicit and known to the human operator present in the Claude Code UI
- No platform-level record of session identity, scope, or boundary exists
- Correlation IDs, where used, are set ad hoc without a session anchor

This assumption is insufficient for platform-level audit completeness.

---

## Desired Future Capability

The platform should be able to:

1. **Receive** a `session.start` event when an agent initiates an MCP connection, including: session ID, agent identity, intended scope or task reference, and timestamp
2. **Receive** a `session.end` event when the session concludes, including: session ID, duration, outcome summary (success/partial/failed), and count of tool calls made
3. **Use** the session ID as the `correlation_id` for all tool call events within that session, enabling full trace reconstruction
4. **Query** the audit log by session to reconstruct the complete sequence of actions taken
5. **Detect** sessions that end without a `session.end` event, indicating an abnormal termination
6. **Associate** sessions with higher-level workflows or task identifiers (e.g., CC-HMCP prompt IDs) for structured traceability

---

## Out of Scope

- Implementing session lifecycle event emission
- Designing the session management mechanism
- Modifying MCP server or client code
- Defining session authentication or authorization

---

## Open Questions

1. Should session lifecycle events be emitted by the MCP client (Claude Code), the MCP server, or a platform-side proxy?
2. What constitutes a "session" boundary — a single Claude Code conversation, a single MCP server connection, or a user-defined task unit?
3. How should the `correlation_id` be established and broadcast to all tool calls within a session?
4. Should sessions be linked to CC-HMCP prompt IDs or other task identifiers for structured traceability?
5. What is the appropriate schema extension for `session.start` and `session.end` event types?
6. How should the platform handle sessions initiated by automated agents (no human operator present)?

---

## Suggested Follow-On Work

| ID | Type | Description |
|---|---|---|
| (TBD) | Schema | Extend `schemas/audit-event.schema.json` with `session.start` and `session.end` event types |
| ADR-HMCP-002 | ADR | MCP tool call instrumentation strategy — session lifecycle is a prerequisite for correlation; must be addressed in the same decision |
| VG-HMCP-000002 | VG | Tool invocation visibility gap — closing that gap without session lifecycle events produces uncorrelated records; both gaps should be addressed together |
| (TBD) | Workflow | Session initiation and closure convention — define how agents declare session context when connecting to platform-managed MCP servers |

---
