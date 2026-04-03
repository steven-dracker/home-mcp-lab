# Backlog Operating Rules

How backlog management should work in a new MCP-governed repository.

---

## Core Principle

**Issues are the canonical backlog.** They are the authoritative record of what needs to be done, what is in progress, and what has been completed or explicitly abandoned.

Nothing else — not handoffs, not the primer, not PR descriptions, not commit messages — substitutes for a well-maintained issue tracker.

---

## Issue Lifecycle

### States

Every issue should carry exactly one `status:*` label at all times.

| Status Label | Meaning |
|---|---|
| `status:backlog` | Defined but not yet prioritized or ready to execute |
| `status:ready` | Scoped, prioritized, and ready for a Claude Code prompt |
| `status:in-progress` | A Claude Code session or PR is actively working this |
| `status:blocked` | Work is paused due to a dependency or unresolved question |
| `status:review` | Implementation complete; PR open or awaiting review |
| `status:done` | Work is complete and merged (or explicitly abandoned with explanation) |

### Transitions

State transitions should be intentional:

- Move `backlog → ready` when an issue is scoped and prioritized for near-term execution
- Move `ready → in-progress` when a Claude Code prompt is generated or execution begins
- Move `in-progress → review` when a PR is opened
- Move `review → done` when the PR is merged and the issue is closed
- Move any state → `blocked` when a dependency or open question prevents progress; document the blocker in the issue

### Malformed State

Malformed issue state — missing status labels, multiple status labels, or stale in-progress labels — should be corrected, not ignored.

If multiple `status:*` labels exist on one issue, remove all but the most current one.

If an issue is closed without a `status:done` label, that is acceptable — GitHub's closed state is sufficient for completion tracking.

---

## Relationship to Handoffs

**Handoffs are not a substitute for issue tracking.**

Handoffs may reference issues (by number or title), but they do not replace them. A handoff captures the dynamic state of an ongoing session — what was just completed, what is in flight, and what comes next. The issue tracker captures the full backlog across all sessions.

Use handoffs to reference issues, not to describe them.

Example:
> Next recommended task: Issue #12 (CC-MYPROJECT-000005) — Define MCP node transport configuration

---

## Relationship to PRs

PRs are implementation/change records. They document what was done and why.

- PRs should reference the issue they implement where possible (`Closes #N` or `Addresses #N`)
- PR descriptions should not be the primary source of backlog visibility
- Merging a PR does not automatically close an issue unless GitHub's close-on-merge keyword is used

---

## Relationship to Handoffs and Primers

| Artifact | Role |
|---|---|
| Issue tracker | Canonical backlog — what needs to be done |
| Handoff | Dynamic session state — what is happening right now |
| Primer | Durable behavioral guidance — how to work |
| PR | Implementation/change record — what was done |

Never use a primer or handoff to manage the backlog. They serve different purposes.

---

## When To Create Issues

Create an issue when:
- New work is identified (feature, debt, risk, control definition)
- A visibility gap or architectural question needs tracking
- Work is scoped enough to be described but not yet ready to execute
- A PR introduces follow-on work that should be tracked separately

Do not create issues for:
- work that will be done immediately without tracking
- ad hoc notes or scratchpad content (use a comment or a separate file)
- duplicates of existing open issues

---

## When To Close Issues

Close an issue when:
- The implementing PR is merged
- The work is explicitly abandoned (add a comment explaining why before closing)
- The issue is superseded by another issue (add a reference and close as duplicate)

Do not leave stale `status:in-progress` issues open after work is complete. Close or update them at every PR merge.

---

## Backlog Hygiene

At regular intervals (e.g., at the start of a phase or after a cluster of PRs):
- Review open issues for stale execution state
- Confirm `status:ready` issues are still prioritized correctly
- Archive or close issues that are no longer relevant
- Confirm `status:in-progress` issues reflect actual in-flight work
