# Handoff Template — [PROJECT NAME]

This template is used to persist system state across session boundaries.

When creating a handoff:
- Fill all required sections
- Keep content concise — no prose duplication of architecture content
- Treat this as the source of truth for resuming work
- Dynamic state here supersedes the primer and boot block

---

# Handoff — [DATE] / [TASK-ID]

## Current System State

- **Last Completed Task:** [TASK-ID] — [short description]
- **Current Phase:** [phase name]
- **Active Branch:** `feature/branch-name` or `none (main is clean)`
- **PR Status:** [None open / PR #N open / All PRs merged through TASK-ID]

---

## Completed Work (Recent)

_(Limit to last 3–5 items)_

- [TASK-ID] — [description]
- [TASK-ID] — [description]
- [TASK-ID] — [description]

---

## Key Artifacts

_(Update to reflect current state — remove stale entries)_

- `[path/to/file]` — [what it is and what it does]
- `[path/to/file]` — [what it is and what it does]

---

## Active Constraints / Rules

- Feature branches only — no direct commits to main
- PR process mandatory: branch → push → PR → merge → delete branch → sync main
- All Claude Code work must carry a prompt ID
- [Add any task-specific or phase-specific constraints here]

---

## Known Gaps

_(Remove closed gaps; add new ones as discovered)_

- [GAP-ID] — [description] ([Open / Narrowed / Implementation complete — validation pending])
- [GAP-ID] — [description] ([Open / Narrowed / Implementation complete — validation pending])

---

## Next Recommended Task

- **ID:** [TASK-ID]
- **Title:** [short title]
- **Description:** [1–2 sentences describing what needs to be done]
- **Rationale:** [why this is the logical next step]

---

## Open Questions _(optional)_

- [Question 1]
- [Question 2]

---

## Notes _(optional)_

- [Any continuity caveats, recent decisions, or context that does not fit above]
