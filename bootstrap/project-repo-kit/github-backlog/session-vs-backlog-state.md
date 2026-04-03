# Session State vs Backlog State

An explicit guide to the four state layers in an MCP-governed repository and what each one owns.

---

## The Four Layers

| Layer | Artifact | Owns | Updated By |
|---|---|---|---|
| **Canonical backlog** | Issue tracker (GitHub Issues) | What needs to be done | Architect + Operator |
| **Durable behavioral guidance** | `chatgpt-primer.md` | How to work | Architect |
| **Dynamic session state** | Handoffs in `handoffs/` | What is happening right now | Claude Code + Architect |
| **Implementation/change record** | Pull requests | What was done | Claude Code |

These four layers are **not interchangeable**. Each one has a distinct role and must not absorb another's responsibility.

---

## Issue Tracker — Canonical Backlog

The issue tracker answers: **What needs to be done?**

- Issues are the authoritative list of work: features, debt, risks, controls, decisions
- Each issue carries a status label reflecting its current execution state
- Issues persist across sessions, handoffs, and even team changes
- The issue tracker is the single source of truth for planned and in-progress work

What the issue tracker is **not**:
- It is not a session log
- It is not a place to store behavioral rules or conventions
- It does not replace handoffs for session continuity

---

## ChatGPT Primer — Durable Behavioral Guidance

The primer answers: **How do we work?**

- The primer carries stable rules: role model, workflow conventions, branch/PR discipline, resume pattern
- The primer changes only when durable behavioral guidance actually changes
- The primer is not a live state tracker — do not update it to reflect current execution state
- The primer is read at the start of each ChatGPT session to restore behavioral context

What the primer is **not**:
- It is not a backlog
- It is not a handoff
- It does not track what was done last session

---

## Handoffs — Dynamic Session State

Handoffs answer: **What is happening right now?**

- Handoffs carry: last completed task, open branch/PR, active gaps, next recommended task
- Handoffs are created at session boundaries (PR merged, context running low, natural pause)
- The most recent handoff is authoritative for dynamic state
- Handoffs may reference issues (by number) but do not replace them

What handoffs are **not**:
- They are not a substitute for the issue tracker
- They are not architecture documentation
- They do not carry durable behavioral rules

---

## Pull Requests — Implementation/Change Records

PRs answer: **What was done?**

- PRs document the specific changes made in a Claude Code session
- PRs reference the issue they implement where possible
- PR descriptions explain scope and rationale
- Merged PRs are a permanent, browsable history of changes

What PRs are **not**:
- They are not backlog items
- They are not session handoffs
- They are not a substitute for issue closure

---

## Conflict Resolution

When layers appear to conflict, use this precedence order:

1. **Issue tracker** — for what needs to be done (backlog state)
2. **Most recent handoff** — for what is happening right now (session state)
3. **Primer** — for how to work (behavioral rules)
4. **PR record** — for what was done (change history)

If the primer and handoff give different next tasks, the handoff wins.
If the handoff and issue tracker are inconsistent, update the issue tracker to match reality.

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why It's Wrong |
|---|---|
| Using handoffs as the primary backlog | Handoffs expire; issues persist |
| Updating the primer to reflect current execution state | The primer is for durable rules, not live state |
| Not updating issue status labels after a PR merges | Leaves stale execution state in the tracker |
| Treating GitHub Project board as the canonical backlog | Project boards are derived visualizations |
| Closing issues without explaining abandoned work | Loses context for future sessions |
