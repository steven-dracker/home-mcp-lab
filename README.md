# Home MCP Compliance Lab

A home lab platform for building, governing, and validating MCP (Model Context Protocol) projects with stronger workflow discipline, reusable bootstrap standards, and operational visibility.

This repository is the **platform layer**, not the home of every downstream project’s domain logic. It provides the shared operating model, templates, handoff patterns, bootstrap kit, and governance conventions used to stand up new MCP-governed repositories.

## Start Here

- **Wiki Home:** https://github.com/steven-dracker/home-mcp-lab/wiki/Home-MCP-Compliance-Lab
- **Bootstrap Kit:** `bootstrap/project-repo-kit/`
- **Latest Handoffs:** `docs/handoffs/`
- **Primer:** `chatgpt-primer.md`

The wiki is the best human-readable entry point.  
The repository handoffs and merged PR history are the authoritative record for current project state.

---

## Lab Environment Disclosure

This repository documents a personal home lab used for experimentation with MCP servers, observability patterns, workflow governance, and project bootstrapping.

All infrastructure details referenced here are:

- non-production
- non-publicly routable (private LAN and mesh VPN only)
- used strictly for local testing, validation, and architectural development

No secrets, credentials, or sensitive access mechanisms are stored in this repository.

Any infrastructure references are included for architectural clarity and reproducibility of the lab environment, not as externally accessible deployable systems.

---

## Purpose

The Home MCP Compliance Lab exists to answer a practical question:

**What is actually happening when MCP-enabled systems and agent-assisted workflows run in practice?**

MCP servers expose tools that models and agents can call — file reads, database queries, API calls, shell commands, and repo operations. Without visibility and structure, those actions become a black box.

This lab builds the platform needed to:

1. **Improve operational visibility**  
   Understand what tools are being called, by which agents, in which contexts, and with what outcomes.

2. **Establish workflow and governance guardrails**  
   Define how governed repos carry state, use handoffs, recover context, and move work through branches, PRs, and approvals.

3. **Provide reusable project bootstrap standards**  
   Make it easy to start new MCP-governed repositories with a consistent primer, boot block, handoff system, backlog model, and repo setup conventions.

4. **Support structured experimentation**  
   Create a safe environment for building and validating MCP-related workflows, integrations, and future automation patterns before wider use.

---

## What This Repository Is

This repository is a **platform and control-plane-style workspace** for:

- reusable bootstrap kit development
- MCP workflow governance
- handoff and state-recovery patterns
- control and visibility design
- project integration standards
- local validation of observability and compliance-oriented MCP behaviors

It is not intended to absorb the domain logic of every downstream project.

---

## Platform vs Project

The lab is organized as a **platform** that supports multiple **independent projects**.

| Layer | What it owns | Examples |
|---|---|---|
| Platform | Shared workflow, governance, bootstrap, and observability patterns | Bootstrap kit, primers, handoff system, control patterns, visibility-gap tracking |
| Project | Project-specific domain logic and outputs | LinkedIn Thought Leadership, future MCP node projects, future governed repos |

Projects may use the platform’s bootstrap kit and workflow conventions, but remain independent repositories with their own domain context and state.

---

## Core Operating Model

The platform uses a structured role model:

- **ChatGPT** — architect / scope enforcer
- **Claude Code** — executor / repo modifier
- **Operator** — final authority for prompts, approvals, merges, and session boundaries

State is intentionally split across layers:

- **GitHub merged history** — canonical source of truth for merged repo state
- **Primers** — durable behavioral guidance
- **Handoffs** — dynamic execution state
- **Boot blocks / `CLAUDE.md`** — compact operational context for Claude Code
- **Issues / labels / milestones** — canonical backlog and execution planning layer

---

## How Projects Plug In

A governed project typically plugs into the platform by adopting:

1. **A standardized repo bootstrap**
   - primer
   - boot block
   - handoff system
   - repo setup guidance
   - operator guide

2. **A structured workflow model**
   - feature branches
   - PR-first merge discipline
   - handoff-based state recovery
   - canonical workspace rules

3. **Optional MCP node starter artifacts**
   - starter node config
   - observability placeholders
   - metadata and integration conventions

4. **Backlog and issue-management conventions**
   - issues as canonical backlog
   - labels as execution-state markers
   - handoffs as session continuity, not backlog replacement

---

## Bootstrap Kit

The reusable bootstrap kit lives in:

- `bootstrap/project-repo-kit/`

It provides:

- ChatGPT primer template
- boot block template
- handoff template and guidance
- workflow rules template
- project metadata template
- MCP node starter structure
- repo hygiene files
- PR template
- repo setup checklist
- first-session checklist
- bootstrap validation checklist
- GitHub backlog starter layer
- operator guide template

This kit has already been used to bootstrap the first real downstream repo:

- `linkedin-thought-leadership`

---

## Repository Structure

Key areas in this repository:

- `bootstrap/project-repo-kit/` — reusable bootstrap kit for new MCP-governed repositories
- `docs/architecture/` — system design and component diagrams
- `docs/adr/` — Architecture Decision Records (`ADR-HMCP-*`)
- `docs/handoffs/` — Claude Code and project state handoffs
- `docs/workflows/` — operational runbooks and procedures
- `docs/visibility-gaps/` — visibility gap register entries (`VG-HMCP-*`)
- `docs/controls/` — control pattern definitions (`CTRL-HMCP-*`)
- `schemas/` — canonical event and data schemas
- `src/` — platform implementation code
- `scripts/` — utility and validation scripts
- `tests/` — validation and test helpers

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

This lab runs on a two-node home fleet.

| Node | Role |
|---|---|
| `dude-mcp-01` | MCP hub, platform validation, primary MCP-related testing |
| `dude-ops-01` | Always-on services, automation-heavy governed project execution |

Canonical operational workspaces are defined per repo.  
GitHub remains the canonical source of truth for repository state.  
Additional clones may exist for convenience, but are not treated as co-equal primary workspaces.

---

## Current Status

The platform has moved beyond initial setup and now includes:

- a reusable project bootstrap kit
- backlog and issue-management starter guidance
- operator guide starter artifacts
- canonical workspace and state-recovery guardrails
- validated use of the kit in a real downstream project

For the best human-readable overview, start with the wiki:

**https://github.com/steven-dracker/home-mcp-lab/wiki/Home-MCP-Compliance-Lab**
