# Optional GitHub Project Guidance

How to use GitHub Projects (v2) in an MCP-governed repository, and when not to.

---

## GitHub Project Is Optional

GitHub Projects is a visualization and planning layer. It is **not required** for repo bootstrap and should not be treated as the source of truth for execution state.

Issues and labels are canonical. The project board is derived.

---

## When a GitHub Project Adds Value

Consider setting up a GitHub Project when:
- The project has enough concurrent work to benefit from board-level visualization
- Multiple team members or agents need a shared at-a-glance view of execution state
- You want to use custom fields (e.g., priority, effort, area) beyond what labels provide
- The project is large enough that label filtering alone is not sufficient for planning

---

## When Not To Use GitHub Projects

Do not set up a project board when:
- The project is small and straightforward (fewer than ~10 active issues at a time)
- The added configuration overhead outweighs the visibility benefit
- You would spend more time maintaining the board than it saves

Starting without a project board and adding one later is always a valid approach.

---

## If You Do Use GitHub Projects

### Source of Truth Rule

**Issues and labels remain the canonical source of truth for backlog state.**

The project board is a derived visualization. If the board and the issue labels disagree, the issue labels win.

### Sync Strategy

GitHub Projects can be configured to automatically reflect label-based status through automation:
- Use `status:*` labels as the primary state mechanism
- Sync labels to project board columns via GitHub Actions if desired
- The `sync-status-to-project.yml` pattern from `home-mcp-lab` is available as a reference

### Scope

Project boards are appropriate for tracking:
- Issues in flight and their current status
- Phase-level progress
- Planning and prioritization views

Project boards are not appropriate for:
- Replacing handoffs as session continuity
- Replacing the issue tracker as the canonical backlog
- Storing behavioral rules or conventions

### Required OAuth Scope

GitHub Projects v2 API requires the `project` OAuth scope. If your PAT or GitHub App does not have this scope, project board sync workflows will fail. This does not affect issue or label management.

---

## Setup Steps (if adopting)

1. Create a GitHub Project (v2) from the repo's Projects tab
2. Add the `Status` field and map values to your `status:*` labels
3. Add all open issues to the project
4. Optionally configure a GitHub Actions workflow to sync `status:*` label changes to the board
5. Document the project board URL in the repo README or primer

---

## Summary

| Question | Answer |
|---|---|
| Is GitHub Project required? | No |
| When does it add value? | Larger projects with concurrent work needing board visualization |
| What is the source of truth? | Issues and labels |
| What is the board? | A derived, optional planning aid |
| What scope does the API need? | `project` OAuth scope |
