# Project Repo Bootstrap Kit

A platform-owned, reusable starter kit for new MCP-governed project repositories.

---

## What This Kit Is

A collection of templates, checklists, and conventions that give a new project repository the same structural discipline used by the Home MCP Compliance Lab — without re-deriving it from scratch.

This kit is **platform-owned**. It lives in `home-mcp-lab` and is adapted (not embedded) into new project repos. Changes to the kit are governed by platform workflow rules.

---

## When To Use It

Use this kit when initializing a new repository that will:
- be governed by Claude Code and ChatGPT under the platform workflow model
- use MCP servers, agents, or structured tool-calling
- require handoff-based state continuity across sessions
- integrate with (or eventually integrate with) the Home MCP Compliance Lab platform

---

## When Not To Use It

Do not use this kit for:
- repositories that will not use Claude Code or structured AI workflow
- throwaway or ephemeral experimental repos
- repositories that already have established conventions that conflict with this model

---

## What This Kit Includes

| Artifact | Required | Description |
|---|---|---|
| `README.md` | Required | This file |
| `chatgpt-primer.template.md` | Required | Primer template for ChatGPT sessions |
| `boot-block.template.md` | Required | Explicit project boot block |
| `context/workflow-rules.template.md` | Required | Role model and operating conventions |
| `handoffs/HANDOFF-TEMPLATE.md` | Required | Session handoff template |
| `handoffs/README.md` | Required | Handoff system guidance |
| `project-metadata.template.yaml` | Required | Machine-readable project identity |
| `docs/operator-guide.template.md` | Required | Plain-language operator guide; also usable as wiki-home |
| `docs/repo-setup-checklist.md` | Required | One-time repo setup steps |
| `docs/first-session-checklist.md` | Required | Pre-work checklist for first Claude Code session |
| `docs/bootstrap-validation-checklist.md` | Required | Confirm the repo is operationally ready |
| `docs/bootstrap-usage.md` | Required | Repeatable bootstrap procedure |
| `docs/example-repo-structure.md` | Required | Recommended directory layout |
| `.gitignore.template` | Required | Conservative vanilla `.gitignore` |
| `.editorconfig` | Required | Cross-editor whitespace consistency |
| `.github/pull_request_template.md` | Required | PR template |
| `mcp-node/README.md` | Optional | MCP node starter guidance |
| `mcp-node/project-node.template.json` | Optional | MCP node identity and config starter |
| `CLAUDE.template.md` | Optional | Minimal `CLAUDE.md` starter |
| `github-backlog/README.md` | Recommended | Backlog starter layer overview |
| `github-backlog/backlog-operating-rules.md` | Recommended | How to manage backlog day-to-day |
| `github-backlog/session-vs-backlog-state.md` | Recommended | Explicit state-layer distinction |
| `github-backlog/label-model.md` | Recommended | Default label taxonomy |
| `github-backlog/issue-taxonomy-guidance.md` | Optional | Issue types and naming conventions |
| `github-backlog/milestone-guidance.md` | Optional | When and how to use milestones |
| `github-backlog/example-bootstrap-backlog.md` | Optional | Example first backlog items |
| `github-backlog/optional-github-project-guidance.md` | Optional | GitHub Projects usage guidance |
| `github-backlog/issue-templates/feature-template.md` | Optional | Starter issue template — features |
| `github-backlog/issue-templates/debt-template.md` | Optional | Starter issue template — debt |
| `github-backlog/issue-templates/risk-template.md` | Optional | Starter issue template — risks/gaps |
| `github-backlog/issue-templates/workflow-template.md` | Optional | Starter issue template — docs/workflow |

---

## GitHub Backlog Starter Layer

The `github-backlog/` subdirectory contains a reusable starter layer for GitHub issue management, backlog discipline, and execution state.

Minimum viable adoption: create the `status:*` labels in GitHub (see `github-backlog/label-model.md`), read `backlog-operating-rules.md` and `session-vs-backlog-state.md`, and create issues for the items in `example-bootstrap-backlog.md`.

GitHub Project board usage is optional — see `optional-github-project-guidance.md`.

---

## What Should Be Customized

In a new repo, adapt:
- `chatgpt-primer.template.md` — fill in project name, purpose, and any project-specific context
- `boot-block.template.md` — fill in project ID, phase, and initial task
- `project-metadata.template.yaml` — fill in project identity fields
- `mcp-node/project-node.template.json` — fill in node identity if using MCP

---

## What Should Remain Standardized

Do not remove or rewrite:
- the role model (ChatGPT / Claude Code / operator)
- the handoff system structure
- the branch/PR discipline rules
- the distinction between primer (durable) and handoff (dynamic state)
- the boot block format

Structural changes to these patterns should be proposed back to the platform, not silently diverged from.

---

## Platform vs Project Separation

This kit helps projects adopt platform workflow discipline — it does not merge projects into the platform.

- The platform owns: audit event schema, control patterns, visibility gap register, integration contracts
- Projects own: their MCP server logic, domain concerns, tool implementations
- The bootstrap kit provides: workflow conventions, state continuity infrastructure, repo hygiene

A project using this kit is not a platform component. It is a governed consumer.

---

## Dynamic State vs Durable Guidance

| Layer | Artifact | Owned By |
|---|---|---|
| Durable behavioral guidance | `chatgpt-primer.md` (adapted) | Architect |
| Dynamic execution state | Handoffs in `handoffs/` | Claude Code + Architect |
| Per-session boot | Boot block in `CLAUDE.md` or primer | Architect |

The primer carries stable rules. The handoff carries what is true right now. When they conflict, the most recent handoff wins for dynamic state.
