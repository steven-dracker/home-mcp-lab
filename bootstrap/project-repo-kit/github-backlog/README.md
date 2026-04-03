# GitHub Backlog Starter — Project Repo Bootstrap Kit

A platform-owned, reusable starter layer for GitHub issue management, backlog discipline, and execution state in new MCP-governed repositories.

---

## What This Is

A set of templates, conventions, and guidance documents that give a new project repository a coherent GitHub work-management model from day one.

This starter layer is **optional but strongly recommended** for any project that will use GitHub as its primary backlog and progress-tracking system.

---

## Required vs Optional Components

| Artifact | Required | Description |
|---|---|---|
| `README.md` | Required | This file |
| `backlog-operating-rules.md` | Required | How backlog management works |
| `session-vs-backlog-state.md` | Required | Explicit state-layer distinction |
| `label-model.md` | Required | Default label taxonomy |
| `issue-taxonomy-guidance.md` | Recommended | Issue types and naming conventions |
| `milestone-guidance.md` | Recommended | When and how to use milestones |
| `example-bootstrap-backlog.md` | Recommended | Example first backlog items |
| `issue-templates/feature-template.md` | Optional | Starter issue template for features |
| `issue-templates/debt-template.md` | Optional | Starter issue template for debt |
| `issue-templates/risk-template.md` | Optional | Starter issue template for risks/gaps |
| `issue-templates/workflow-template.md` | Optional | Starter issue template for workflow/docs work |
| `optional-github-project-guidance.md` | Optional | GitHub Projects setup guidance |

**Minimum viable adoption:** implement `label-model.md` labels in GitHub, read `backlog-operating-rules.md` and `session-vs-backlog-state.md`, and create issues for the items in `example-bootstrap-backlog.md`.

---

## How This Layer Fits

```
Issue Tracker  — canonical backlog; what needs to be done
Labels         — execution state and classification on issues
Milestones     — phase/grouping mechanism
Handoffs       — dynamic session state; what is happening right now
Primers        — durable behavioral guidance; how to work
PRs            — implementation/change records; what was done
GitHub Project — optional derived visualization (not source of truth)
```

---

## Core Rules (Non-Negotiable)

1. **Issues are the canonical backlog** — not handoffs, not the primer, not comments
2. **Handoffs reference issues; they do not replace them**
3. **Labels carry execution state** — each issue should have exactly one `status:*` label
4. **GitHub Project is optional** — if used, it is a planning aid; issues remain authoritative
5. **Closed issues represent completed or explicitly abandoned work**
6. **Work generally starts from a defined issue or scoped prompt**

---

## Files in This Directory

| File | Purpose |
|---|---|
| `backlog-operating-rules.md` | How to manage the backlog day-to-day |
| `session-vs-backlog-state.md` | Distinguishes issue, handoff, primer, and PR roles |
| `label-model.md` | Default label taxonomy with required/optional guidance |
| `issue-taxonomy-guidance.md` | Issue types, naming, and platform taxonomy relationship |
| `milestone-guidance.md` | When and how to use milestones |
| `example-bootstrap-backlog.md` | Example first backlog items for a new repo |
| `optional-github-project-guidance.md` | Optional GitHub Projects usage |
| `issue-templates/` | Starter issue body templates |
