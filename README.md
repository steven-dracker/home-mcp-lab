# Home MCP Compliance Lab

A home lab platform for building, operating, and auditing MCP (Model Context Protocol) servers — with compliance visibility, structured controls, and pluggable project integration.

---

## Purpose

The Home MCP Compliance Lab exists to answer a practical question: **what is actually happening when Claude uses tools?**

MCP servers expose tools that Claude can call — file reads, database queries, API calls, shell commands. Without visibility, those actions are a black box. This lab builds the infrastructure to see, log, classify, and reason about tool usage across multiple projects and agents.

The lab serves three goals:

1. **Operational visibility** — know what tools are being called, by which agents, on which servers, and with what outcomes
2. **Compliance controls** — define and enforce boundaries around what MCP servers should and should not do
3. **Structured experimentation** — a safe environment to build and test new MCP server configurations before broader deployment

---

## Platform vs Project

The lab is organized as a **platform** that hosts multiple **projects**.

| Layer | What it is | Examples |
|---|---|---|
| Platform | Shared compliance infrastructure | Audit schema, control patterns, visibility gaps register, workflows |
| Project | A specific MCP server or agent integration | ERATE Workbench MCP, GitHub MCP, future agents |

Projects plug into the platform by implementing the integration contract defined here. The platform does not own project logic — projects remain independent. The platform owns the compliance layer that wraps them.

---

## How Projects Plug In

A project integration consists of:

1. **Declaring tools** — register what tools the MCP server exposes and their risk classification
2. **Emitting audit events** — log tool calls using the platform's audit event schema
3. **Implementing controls** — apply the platform's control patterns appropriate to the server's risk profile
4. **Reporting visibility gaps** — document what the server does that cannot currently be observed

Integration contracts and schemas live in this repo. Projects reference them; they do not live here.

---

## Repository Structure

```
docs/
  architecture/     System design and component diagrams
  adr/              Architecture Decision Records (ADR-HMCP-*)
  handoffs/         Claude Code session handoffs
  workflows/        Operational runbooks and procedures
  visibility-gaps/  VG-HMCP-* gap register entries
  controls/         CTRL-HMCP-* control pattern definitions

schemas/            Canonical event and data schemas
```

---

## Prompt Taxonomy

All structured work in this repo uses the following ID schemes for traceability:

| Prefix | Scope |
|---|---|
| `CC-HMCP-*` | Claude Code implementation prompts |
| `VG-HMCP-*` | Visibility gap register entries |
| `CTRL-HMCP-*` | Control pattern definitions |
| `ADR-HMCP-*` | Architecture Decision Records |
| `TD-HMCP-*` | Technical debt items |

---

## Infrastructure

This lab runs on a two-node home fleet:

| Node | Role |
|---|---|
| hostname-mcp-01 (###.###.###.###) | MCP hub — Postgres, primary MCP server host |
| hostname-ops-01 (###.###.###.###) | Always-on services — monitoring, agents |

Both nodes are on the ###.###.##.0/### home subnet with Tailscale mesh VPN for remote access.
