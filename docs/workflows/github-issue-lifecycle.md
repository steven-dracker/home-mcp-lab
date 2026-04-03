# GitHub Issue Lifecycle — Home MCP Compliance Lab

**Related prompts:** CC-HMCP-000006E, CC-HMCP-000006F, CC-HMCP-000006G  
**Last updated:** 2026-04-03

---

## Canonical State Model

Three layers. Each layer has a distinct role. Do not collapse them.

| Layer | Tool | Purpose |
|---|---|---|
| **Issues** | GitHub Issues | Canonical backlog — source of truth for every work item |
| **`status:*` labels** | GitHub Labels | Execution state — Claude applies these; they are readable without project scope |
| **Project board** | [Project #1](https://github.com/users/steven-dracker/projects/1/views/1) | Visual display — synced from `status:*` labels via Actions workflow |
| **Milestones** | GitHub Milestones | Delivery grouping — which phase an issue belongs to |
| **Classification labels** | GitHub Labels | Type, priority, phase — separate from status |

### Why labels drive status (not project fields)

GitHub Projects v2 field mutations require a PAT with `project` OAuth scope. The platform PAT has full `repo` scope but not `project` scope. Applying a label requires only `repo` scope — so Claude can change `status:*` labels directly on issues, and a GitHub Actions workflow (`sync-status-to-project.yml`) syncs those changes to the project board automatically.

This means Claude updates state in one place (labels on issues), and the project board reflects it without Claude needing elevated permissions.

---

## Milestones

| Milestone | Scope |
|---|---|
| `HMCP-M2.5 — Secrets and Remaining Observability` | Complete observability + secret.retrieval events. Closes VG-HMCP-000003, VG-HMCP-000001 |
| `HMCP-M3 — Control Foundations` | Tool risk classification, deny-list, approval gate, session anomaly detection, event integrity |
| `HMCP-M4 — Platform Expansion` | Docker MCP runtime, Loki, Prometheus on dude-mcp-01, optional Windows node |

Milestones represent **outcomes**, not workflow states. An issue in M3 may be in any project column.

---

## Status Labels — Execution States

Claude applies these labels directly. No project scope required.

| Label | Meaning |
|---|---|
| `status:backlog` | Defined, not yet started |
| `status:ready` | Dependencies met, cleared to start |
| `status:in-progress` | Active work underway |
| `status:blocked` | Work started but cannot proceed |
| `status:done` | Acceptance criteria met; issue closed or confirmed closed |

Each issue carries exactly one `status:*` label at any time. When changing state, remove the old status label and add the new one.

### Project Board Sync

Two workflows manage project sync:

| Workflow | Trigger | Purpose |
|---|---|---|
| `sync-status-to-project.yml` | Issue labeled / `workflow_dispatch` | Syncs a single issue on label change |
| `reconcile-status-to-project.yml` | `workflow_dispatch` (manual only) | Full repair pass over all open issues |

Both require a repo secret `PROJECT_PAT` (PAT with `repo + project` scopes).

**Malformed state detection** (sync workflow):
- No `status:*` label → warning, skip, exit 0
- Multiple `status:*` labels → error, exit 1 (operator must remove extras)
- `PROJECT_PAT` missing → error, exit 1 with setup instructions
- Item not found after add → error, exit 1 with diagnostic

**Until `PROJECT_PAT` is configured:** Labels are the authoritative state. The project board may lag but issues are always current.

Project: https://github.com/users/steven-dracker/projects/1/views/1

---

## Standard Issue Lifecycle

### When Work Starts

Claude must:

1. Find the issue by ID:
   ```bash
   gh issue list --repo steven-dracker/home-mcp-lab --search "[CC-HMCP-XXXXXX]"
   ```
2. Remove `status:ready` or `status:backlog` label; add `status:in-progress`:
   ```bash
   gh issue edit <number> --repo steven-dracker/home-mcp-lab \
     --remove-label "status:ready" --add-label "status:in-progress"
   ```
3. Add a comment:
   ```
   Work started.
   - Prompt: CC-HMCP-XXXXXX
   - Branch: feature/cc-hmcp-XXXXXX-short-title
   - Scope: [brief scope statement]
   ```

### When a PR Is Created

Claude must:

1. Comment on the issue:
   ```
   PR opened: #<number>
   Summary: [what changed]
   ```
2. PR body must include `Closes #<issue>` for CC items (enables auto-close on merge).
3. VG / CTRL / INF / TD items: do **not** use `Closes` unless acceptance criteria are fully met.

### When Blocked

Claude must:

1. Remove `status:in-progress`; add `status:blocked`:
   ```bash
   gh issue edit <number> --repo steven-dracker/home-mcp-lab \
     --remove-label "status:in-progress" --add-label "status:blocked"
   ```
2. Comment with exact blocker detail.

### When Work Completes

Claude must:

1. Add a completion comment:
   ```
   Work complete.
   - Validation: [summary of what was tested]
   - Branch: feature/...
   - Commit: <hash>
   - PR: #<number> [merged / open]
   - Blockers: none / [description]
   ```
2. Update label to reflect outcome:
   - Fully complete → remove `status:in-progress`, add `status:done`
     ```bash
     gh issue edit <number> --repo steven-dracker/home-mcp-lab \
       --remove-label "status:in-progress" --add-label "status:done"
     ```
   - Blocked → remove `status:in-progress`, add `status:blocked`

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

## Activating and Testing Project Board Sync

### One-time setup (operator)

1. Generate a PAT at github.com/settings/tokens with scopes: `repo` + `project`
2. Add it to repo secrets: Settings → Secrets and variables → Actions → New repository secret → Name: `PROJECT_PAT`
3. The sync workflow fires on every `status:*` label event from that point forward

### Testing the sync (low-risk validation path)

Use issue #37 (CC-HMCP-000006B, currently `status:ready`):

```bash
# Step 1: Move to in-progress — triggers sync workflow
gh issue edit 37 --repo steven-dracker/home-mcp-lab \
  --remove-label "status:ready" --add-label "status:in-progress"

# Step 2: Verify workflow ran
gh run list --repo steven-dracker/home-mcp-lab --workflow sync-status-to-project.yml --limit 1

# Step 3: Check workflow logs
gh run view <run-id> --repo steven-dracker/home-mcp-lab --log

# Step 4: Verify project board moved
# Check https://github.com/users/steven-dracker/projects/1/views/1
# Issue #37 should now be in "In Progress" column

# Step 5: Restore to ready
gh issue edit 37 --repo steven-dracker/home-mcp-lab \
  --remove-label "status:in-progress" --add-label "status:ready"
```

### Manual single-issue sync (workflow_dispatch)

Run the sync workflow manually for a specific issue without touching labels:

```bash
gh workflow run sync-status-to-project.yml \
  --repo steven-dracker/home-mcp-lab \
  --field issue_number=37
```

### Full reconciliation pass

Scans all open issues and repairs any project drift from current labels:

```bash
gh workflow run reconcile-status-to-project.yml \
  --repo steven-dracker/home-mcp-lab

# Check results
gh run list --repo steven-dracker/home-mcp-lab --workflow reconcile-status-to-project.yml --limit 1
gh run view <run-id> --repo steven-dracker/home-mcp-lab --log
```

Safe to run repeatedly. Reports malformed issues as warnings without stopping the run.

Until `PROJECT_PAT` is configured, `status:*` labels are the authoritative state and the project board is updated manually by the operator.

---

## Label Reference

### Status (execution state — exactly one per issue)
| Label | Meaning |
|---|---|
| `status:backlog` | Not yet started |
| `status:ready` | Dependencies met, cleared to start |
| `status:in-progress` | Active work underway |
| `status:blocked` | Cannot proceed |
| `status:done` | Acceptance criteria met |

### Classification (can stack)
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

# Change status (example: backlog → in-progress)
gh issue edit <number> --repo steven-dracker/home-mcp-lab \
  --remove-label "status:backlog" --add-label "status:in-progress"

# Check current status of all open issues
gh issue list --repo steven-dracker/home-mcp-lab \
  --json number,title,labels --jq '.[] | "\(.number) \(.title) — \([.labels[].name | select(startswith("status:"))] | join(","))"'

# Check milestone assignments
gh api repos/steven-dracker/home-mcp-lab/milestones \
  --jq '.[] | "\(.number) \(.title) — \(.open_issues) open"'

# List issues in a milestone
gh issue list --repo steven-dracker/home-mcp-lab \
  --milestone "HMCP-M2.5 — Secrets and Remaining Observability"
```
