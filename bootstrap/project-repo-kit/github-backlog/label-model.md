# Default Label Model

A reusable label taxonomy for new MCP-governed repositories.

---

## Overview

Labels serve two primary purposes:
1. **Execution state** — where is this issue in the workflow right now
2. **Classification** — what kind of work is this

Labels are cheap to create and easy to filter. Start with execution-state labels (required) and add classification labels as the project grows.

---

## Required: Execution State Labels

These labels are **mutually exclusive**. Each issue should have exactly one `status:*` label at all times.

| Label | Color (suggestion) | Meaning |
|---|---|---|
| `status:backlog` | `#e2e8f0` (light gray) | Defined but not yet prioritized or ready |
| `status:ready` | `#bfdbfe` (light blue) | Scoped and ready to execute |
| `status:in-progress` | `#fde68a` (yellow) | Actively being worked |
| `status:blocked` | `#fca5a5` (light red) | Paused due to dependency or open question |
| `status:review` | `#c4b5fd` (light purple) | PR open or awaiting review |
| `status:done` | `#bbf7d0` (light green) | Complete and merged (or explicitly abandoned) |

**Rule:** Every open issue must have exactly one `status:*` label. When a status changes, remove the old label before adding the new one.

---

## Recommended: Type Labels

These labels are **not mutually exclusive** with each other, but each issue typically has at most one `type:*` label.

| Label | Color (suggestion) | Meaning |
|---|---|---|
| `type:feature` | `#a5f3fc` (cyan) | New capability or implementation work |
| `type:debt` | `#fed7aa` (light orange) | Technical debt reduction or cleanup |
| `type:risk` | `#fda4af` (rose) | Visibility gap, risk, or limitation |
| `type:control` | `#d9f99d` (lime) | Control pattern or policy definition |
| `type:adr` | `#e9d5ff` (lavender) | Architecture Decision Record support |
| `type:docs` | `#e0e7ff` (indigo-tint) | Documentation or workflow refinement |

---

## Optional: Priority Labels

Use when the project needs explicit prioritization beyond ordering.

| Label | Color (suggestion) | Meaning |
|---|---|---|
| `priority:p0` | `#ef4444` (red) | Critical — blocking or urgent |
| `priority:p1` | `#f97316` (orange) | High — important for current phase |
| `priority:p2` | `#facc15` (yellow) | Normal — planned for upcoming work |

---

## Optional: Area / Domain Labels

Use when the project has distinct enough domains to warrant filtering. Add or remove as appropriate.

| Label | Color (suggestion) | Meaning |
|---|---|---|
| `area:workflow` | `#f0fdf4` | Process and operating conventions |
| `area:mcp-node` | `#eff6ff` | MCP server or node work |
| `area:automation` | `#fefce8` | Automation, CI/CD, or scripting |
| `area:content` | `#fdf4ff` | Content, signals, or output generation |
| `area:integration` | `#fff1f2` | Platform integration or external API work |

---

## Adoption Guidance

### Minimum viable label setup (small repos)
- Create all six `status:*` labels
- Assign `status:backlog` to all new issues immediately

### Growing repos
- Add `type:*` labels when issues start to accumulate and classification becomes useful
- Add `priority:*` labels when the team needs to distinguish urgency explicitly

### Larger or platform-integrated repos
- Add `area:*` labels when the project spans multiple distinct domains
- Consider labels for milestones or phases only if GitHub milestones are not sufficient

---

## Label Setup in a New Repo

GitHub does not automatically create labels in new repos beyond a default set. You have three options:

1. **Manual creation** — create labels via the GitHub web UI (Settings → Labels)
2. **GitHub CLI** — use `gh label create` to script label creation
3. **GitHub Actions** — run a label sync workflow on first push

A starter shell script using the GitHub CLI:

```bash
# Required: execution state
gh label create "status:backlog"     --color "e2e8f0" --description "Defined but not yet prioritized"
gh label create "status:ready"       --color "bfdbfe" --description "Scoped and ready to execute"
gh label create "status:in-progress" --color "fde68a" --description "Actively being worked"
gh label create "status:blocked"     --color "fca5a5" --description "Paused due to dependency or open question"
gh label create "status:review"      --color "c4b5fd" --description "PR open or awaiting review"
gh label create "status:done"        --color "bbf7d0" --description "Complete and merged"

# Recommended: type
gh label create "type:feature" --color "a5f3fc" --description "New capability or implementation work"
gh label create "type:debt"    --color "fed7aa" --description "Technical debt"
gh label create "type:risk"    --color "fda4af" --description "Risk, gap, or limitation"
gh label create "type:control" --color "d9f99d" --description "Control or policy definition"
gh label create "type:adr"     --color "e9d5ff" --description "Architecture Decision Record"
gh label create "type:docs"    --color "e0e7ff" --description "Documentation or workflow"
```

Remove this script from your committed files after running it — or store it in a `scripts/` directory without credentials.
