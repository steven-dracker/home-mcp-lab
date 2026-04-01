# Handoff Template — Home MCP Compliance Lab

This template is used to persist system state across session boundaries.

When creating a handoff:
- Fill all required sections
- Keep content concise
- Do not include implementation details unless necessary
- Treat this as the source of truth for resuming work

---

# Handoff — <date or session identifier>

## Current System State

- **Last Completed Task:** CC-HMCP-XXXXXX — short title
- **Current Phase:** e.g., Architecture Definition / First Integration / Gap Remediation
- **Active Branch:** `feature/branch-name` or `none`
- **PR Status:** Open / Merged / None

---

## Completed Work (Recent)

- CC-HMCP-XXXXXX — description
- ADR-HMCP-XXX — description
- VG-HMCP-XXX — description
- CTRL-HMCP-XXX — description

_(Limit to last 3–5 items)_

---

## Key Artifacts

- `schemas/audit-event.schema.json` — platform audit event schema (v0.2.0)
- `docs/architecture/project-integration-contract.md` — integration contract v0
- `docs/architecture/instrumentation-layer.md` — instrumentation layer definition
- `docs/architecture/event-emitter-integration-pattern.md` — emitter pattern
- `docs/architecture/reference-event-emitter-design.md` — emitter blueprint
- `docs/workflows/audit-event-ingestion.md` — ingestion workflow
- `docs/controls/CTRL-HMCP-000001-runtime-secret-retrieval.md` — active control
- `docs/adr/ADR-HMCP-001-platform-vs-project-separation.md` — foundational ADR
- `docs/architecture/integrations/github-mcp-integration.md` — first integration

_(Update list to reflect current state)_

---

## Active Constraints / Rules

- Platform vs project separation enforced — ADR-HMCP-001
- No secrets in any event payload or log
- Event emission must be non-blocking
- All events must conform to `schemas/audit-event.schema.json`
- Feature branches only — no direct commits to main
- PR process mandatory: branch → push → PR → merge → delete branch → sync main
- All Claude Code work must carry a CC-HMCP-XXXXXX prompt ID

---

## Known Gaps

- VG-HMCP-000001 — Keeper non-interactive secret retrieval (Open)
- VG-HMCP-000002 — MCP tool invocation visibility (Open)
- VG-HMCP-000003 — GitHub PAT retrieval path visibility (Open)
- VG-HMCP-000004 — MCP session lifecycle visibility (Open)

_(Remove closed gaps; add new ones as identified)_

---

## Next Recommended Task

- **ID:** CC-HMCP-XXXXXX
- **Title:** Short title
- **Description:** One or two sentences describing what needs to be done
- **Rationale:** Why this is the logical next step

---

## Open Questions _(optional)_

- Question 1
- Question 2

---

## Notes _(optional)_

- Any continuity caveats, recent decisions, or context that does not fit above
