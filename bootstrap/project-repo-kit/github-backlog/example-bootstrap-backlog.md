# Example Bootstrap Backlog

A generic example of the first backlog items in a newly bootstrapped MCP-governed repository.

This is illustrative — adapt it to fit the actual project.

---

## Example Issues for a New Repo

| # | ID | Title | Type | Status |
|---|---|---|---|---|
| 1 | CC-[PROJECT]-000001 | Initialize project context files and primer | `type:feature` | `status:done` |
| 2 | CC-[PROJECT]-000002 | Define project scope and first active task | `type:docs` | `status:done` |
| 3 | CC-[PROJECT]-000003 | Create first handoff and validate bootstrap readiness | `type:docs` | `status:done` |
| 4 | CC-[PROJECT]-000004 | Define project label model and create GitHub labels | `type:docs` | `status:ready` |
| 5 | CC-[PROJECT]-000005 | Define MCP node configuration and transport | `type:feature` | `status:backlog` |
| 6 | CC-[PROJECT]-000006 | Establish first workflow definition | `type:docs` | `status:backlog` |
| 7 | TD-[PROJECT]-000001 | Review and clean up placeholder content in primer | `type:debt` | `status:backlog` |
| 8 | VG-[PROJECT]-000001 | Document MCP tool call observability gaps | `type:risk` | `status:backlog` |
| 9 | CC-[PROJECT]-000007 | Implement first MCP node feature | `type:feature` | `status:backlog` |
| 10 | ADR-[PROJECT]-000001 | Document architectural decision: platform integration approach | `type:adr` | `status:backlog` |

---

## Notes on This Example

**Issues 1–3** are typically complete before the first real Claude Code session. They represent bootstrap setup work.

**Issue 4** should be done early — getting labels in place makes every subsequent issue more useful.

**Issue 5** is the first real implementation work for an MCP-enabled project. For non-MCP projects, replace with the project's first domain task.

**Issue 8** (visibility gap) is appropriate for any project that will later integrate with the platform. Document gaps early so they are not forgotten.

**Issue 10** (ADR) is optional for small projects but recommended once a meaningful architectural decision has been made.

---

## Adapting This Example

Replace:
- `[PROJECT]` with the project's prompt ID prefix
- Issue titles with the project's actual first tasks
- Types and statuses based on real project state

Remove issues that do not apply:
- Skip `VG-*` and `ADR-*` issues for very small or standalone repos
- Skip MCP node issues for non-MCP projects

Add issues that are project-specific:
- Infrastructure setup tasks
- First integration tasks
- Any known debt or risk items identified during bootstrap
