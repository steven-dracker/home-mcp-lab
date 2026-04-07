# Handoff System — [PROJECT NAME]

This directory contains session handoffs for the project.

---

## What Handoffs Are

Handoffs are the persistent state layer for session continuity. They carry dynamic execution state across session boundaries so that a new ChatGPT or Claude Code session can resume without re-explaining the full project.

Handoffs are **not** architecture documentation. They are operational state snapshots.

---

## What Handoffs Carry

- Last completed task and PR status
- Current phase
- Active branch
- Recent completed work (last 3–5 items)
- Key artifacts (current, not historical)
- Active constraints and rules
- Known gaps (open, narrowed, or resolved)
- Next recommended task
- Open questions or continuity caveats

---

## What Handoffs Do Not Carry

- Durable behavioral rules (those belong in the primer)
- Architecture documentation (that belongs in `docs/`)
- Full history (git log is authoritative for history)

---

## Naming Convention

Handoffs are named by task ID and date:

```
handoff-[TASK-ID].md
handoff-[TASK-ID]-[date].md
```

The most recently created file is authoritative. If two handoffs exist for the same date, check the task ID for ordering.

---

## When To Create a Handoff

Create a handoff when:
- A PR is merged and work pauses
- Context is running low (approximately 30% remaining)
- A phase boundary is reached
- The session is ending and work is in progress

Do not continue to the next task across a session boundary without a handoff.

---

## How To Use a Handoff

At the start of a new session:
1. Paste `chatgpt-primer.md` into ChatGPT
2. Paste the latest handoff from this directory
3. ChatGPT restores context — no re-explanation needed
4. Continue from the next recommended task

---

## Precedence Rule

The most recent handoff is authoritative for all dynamic state. If the primer or boot block conflicts with the latest handoff, the handoff wins.

---

## State Recovery

Use this procedure when the latest handoff predates significant merged work, the boot block is stale, or a local clone may be behind `origin/main`.

1. Run `git pull origin main` in the canonical operational workspace to ensure it is current
2. Run `git log --oneline -10` and compare against the latest handoff's "Last Completed Task"
3. If merged PRs exist that are not reflected in the handoff, create a fresh handoff before starting new work
4. Do not rely solely on the boot block (`CLAUDE.md`) for current state — check the latest handoff first
5. If multiple local clones exist, work only from the canonical operational workspace defined in `chatgpt-primer.md`

**GitHub is the canonical source of truth.** Merged PR history is authoritative. Handoffs, boot blocks, and primers are derived state and may be stale.

---

## Template

Use `HANDOFF-TEMPLATE.md` in this directory when creating new handoffs.
