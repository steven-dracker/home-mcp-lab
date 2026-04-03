# GitHub Issue Lifecycle — Home MCP Compliance Lab

**Related prompt:** CC-HMCP-000006E  
**Last updated:** 2026-04-03

---

## Canonical State Model

Three layers. Each layer has a distinct role. Do not collapse them.

| Layer | Tool | Purpose |
|---|---|---|
| **Issues** | GitHub Issues | Canonical backlog — source of truth for every work item |
| **Project board** | [Project #1](https://github.com/users/steven-dracker/projects/1/views/1) | Execution state — current status of active work |
| **Milestones** | GitHub Milestones | Delivery grouping — which phase an issue belongs to |
| **Labels** | GitHub Labels | Classification — type, priority, phase |

---

## Milestones

| Milestone | Scope |
|---|---|
| `HMCP-M2.5 — Secrets and Remaining Observability` | Complete observability + secret.retrieval events. Closes VG-HMCP-000003, VG-HMCP-000001 |
| `HMCP-M3 — Control Foundations` | Tool risk classification, deny-list, approval gate, session anomaly detection, event integrity |
| `HMCP-M4 — Platform Expansion` | Docker MCP runtime, Loki, Prometheus on dude-mcp-01, optional Windows node |

Milestones represent **outcomes**, not workflow states. An issue in M3 may be in any project column.

---

## Project Board — Execution States

Project: https://github.com/users/steven-dracker/projects/1/views/1

| Column | Meaning |
|---|---|
| **Backlog** | Defined, not yet started |
| **Ready** | Dependencies met, cleared to start |
| **In Progress** | Active work underway |
| **Blocked** | Work started but cannot proceed |
| **Done** | Acceptance criteria met; issue closed or confirmed closed |

---

## Standard Issue Lifecycle

### When Work Starts

Claude must:

1. Find the issue by ID (`gh issue list --search "[CC-HMCP-XXXXXX]"`)
2. Add a comment:
   ```
   Work started.
   - Prompt: CC-HMCP-XXXXXX
   - Branch: feature/cc-hmcp-XXXXXX-short-title
   - Scope: [brief scope statement]
   ```
3. Move project item → **In Progress**
   ```bash
   gh project item-edit --id <item-id> --field-id <status-field-id> \
     --project-id <project-id> --single-select-option-id <in-progress-id>
   ```
   Note: requires PAT with `project` scope (see Project Board Limitation below).

### When a PR Is Created

Claude must:

1. Comment on the issue:
   ```
   PR opened: #<number>
   Summary: [what changed]
   ```
2. PR body must include `Closes #<issue>` for CC items (enables auto-close on merge).
3. VG / CTRL / INF / TD items: do **not** use `Closes` unless acceptance criteria are fully met.

### When Work Completes

Claude must add a completion comment:

```
Work complete.
- Validation: [summary of what was tested]
- Branch: feature/...
- Commit: <hash>
- PR: #<number> [merged / open]
- Blockers: none / [description]
```

Then update project state:
- Complete → **Done**
- Blocked → **Blocked** (with reason in issue comment)

---

## Closing Rules

| Issue type | Auto-close via PR merge | Manual close allowed |
|---|---|---|
| `type:cc` | Yes — `Closes #N` in PR body | Yes |
| `type:vg` | No | Only when all acceptance criteria are explicitly met |
| `type:ctrl` | No | Only when control is implemented and validated |
| `type:inf` | No | Only when infrastructure change is confirmed on target host |
| `type:td` | No | Only when implementation is complete and tests pass |

For narrowed gaps: add a comment documenting what was resolved and what remains. Do **not** close until fully satisfied.

---

## Project Board Limitation — PAT Scope

GitHub Projects v2 mutations (moving items between columns, adding items to project) require a PAT with the `project` OAuth scope. The current platform PAT (`gh auth token`) lacks this scope.

**Impact:** Claude cannot move project items programmatically in the current auth context.

**Workaround:** After Claude posts a completion comment on an issue, the operator moves the project item manually. The issue comment serves as the authoritative state record; the project column is a convenience display.

**Resolution path:** Generate a PAT with `project` scope and store it as a separate secret (e.g., `GH_PROJECT_PAT` in Keeper). Wire it into the lifecycle helper when available.

---

## Label Reference

| Label | Meaning |
|---|---|
| `type:cc` | CC-HMCP-* implementation prompt |
| `type:vg` | VG-HMCP-* visibility gap |
| `type:ctrl` | CTRL-HMCP-* control pattern |
| `type:inf` | INF-HMCP-* infrastructure item |
| `type:td` | TD-HMCP-* technical debt |
| `priority:p0` | Critical — blocks other work |
| `priority:p1` | High — next in queue |
| `priority:p2` | Normal |
| `phase:2.5` | HMCP-M2.5 |
| `phase:3` | HMCP-M3 |
| `phase:4` | HMCP-M4 |

---

## Quick Reference — gh CLI

```bash
# Find issue by ID
gh issue list --repo steven-dracker/home-mcp-lab --search "[CC-HMCP-000006B]"

# Comment on issue
gh issue comment <number> --repo steven-dracker/home-mcp-lab --body "..."

# Check milestone assignments
gh api repos/steven-dracker/home-mcp-lab/milestones --jq '.[] | "\(.number) \(.title) — \(.open_issues) open"'

# List issues in a milestone
gh issue list --repo steven-dracker/home-mcp-lab --milestone "HMCP-M2.5 — Secrets and Remaining Observability"
```
