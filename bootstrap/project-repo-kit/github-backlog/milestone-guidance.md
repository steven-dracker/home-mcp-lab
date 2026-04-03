# Milestone Guidance

How to use GitHub milestones effectively in a new MCP-governed repository.

---

## What Milestones Are For

Milestones group issues into a named, bounded unit of work — typically a phase, release, or capability cluster.

They answer: **What set of issues must be complete before we consider this phase done?**

Milestones are a planning and progress tool, not a replacement for labels or handoffs.

---

## How Milestones Differ From Labels

| Dimension | Labels | Milestones |
|---|---|---|
| Purpose | Classify and filter individual issues | Group issues into a bounded phase |
| Scope | Per-issue | Cross-issue grouping |
| Mutually exclusive? | `status:*` labels are; others are not | No — issues can only be in one milestone |
| Progress tracking | Not directly (no %) | GitHub shows % complete automatically |
| Persistence | Permanent metadata | Closed when phase is done |

Use labels for **what kind of thing and what state** an issue is in. Use milestones for **which phase or cluster** the issue belongs to.

---

## When To Create Milestones

Create a milestone when:
- The project has a defined phase with a coherent set of deliverables (e.g., Phase 1 — Bootstrap, Phase 2 — Integration)
- A set of issues is logically grouped and should be completed together before moving on
- You want automatic progress tracking across a group of issues

Do **not** create milestones for:
- Individual issues or very small repos with fewer than 10 issues
- Ongoing maintenance work with no defined endpoint
- Administrative or housekeeping tasks that do not represent a phase of work

---

## Milestone Naming

Keep milestone names short and meaningful:

Examples:
- `Phase 1 — Bootstrap`
- `Phase 2 — MCP Integration`
- `M2.5 — Secrets and Observability`
- `v0.1 — Initial Release`
- `Q2-2026 — Content Pipeline`

Avoid milestone names that are too granular (they become labels) or too vague (e.g., `Work`, `Stuff`).

---

## Milestone Lifecycle

1. **Create** the milestone when a phase is defined
2. **Assign** issues to the milestone as they are scoped
3. **Track** progress through GitHub's built-in milestone % complete view
4. **Close** the milestone when all issues are resolved or the phase ends
5. **Reference** the closed milestone in the next handoff as a phase-complete marker

---

## Relationship to Handoffs

When a milestone closes, the corresponding handoff should note it:

```
- HMCP-M2.5 milestone: complete as of PR #57
```

Handoffs do not replace milestones. A handoff captures current session state; a milestone captures phase completion across potentially many sessions.

---

## Avoiding Overuse

For small repos or early-stage projects:
- A single active milestone or no milestones at all is fine
- Do not create milestones speculatively for phases that have not been planned yet
- Add milestones as the project matures and phases become well-defined

The goal is useful progress tracking, not process for its own sake.
