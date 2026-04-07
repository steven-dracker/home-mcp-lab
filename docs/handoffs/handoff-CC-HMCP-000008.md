# Handoff — 2026-04-07 / CC-HMCP-000008

## Current System State

- **Last Completed Task:** CC-HMCP-000008 — Add canonical workspace and state-recovery guardrails
- **Current Phase:** Phase 3 — Platform Hardening and Reusability
- **Active Branch:** none (main is clean after PR merge)
- **PR Status:** All PRs merged through bootstrap kit series (#60, #61, #62); CC-HMCP-000008 pending merge

---

## Completed Work (Recent)

- CC-HMCP-000007A / PR #60 — Add reusable bootstrap kit for new MCP-governed repos (`bootstrap/project-repo-kit/`)
- PR #61 — Add GitHub backlog starter to project bootstrap kit
- PR #62 — Add operator guide starter to project bootstrap kit
- CC-HMCP-000008 — Add canonical workspace and state-recovery guardrails (this task)

---

## Key Artifacts

- `chatgpt-primer.md` — platform primer; now includes canonical workspace and state recovery section
- `CLAUDE.md` — boot block; now includes CANONICAL STATE RULES section
- `bootstrap/project-repo-kit/` — reusable bootstrap kit; canonical workspace guidance added throughout
- `bootstrap/project-repo-kit/chatgpt-primer.template.md` — new CANONICAL WORKSPACE AND STATE RECOVERY section with `[CANONICAL_HOST]:[CANONICAL_PATH]` placeholder
- `bootstrap/project-repo-kit/boot-block.template.md` — Canonical Workspace field in PROJECT IDENTITY; CANONICAL STATE RULES section replaces old HANDOFF PRECEDENCE RULE
- `bootstrap/project-repo-kit/handoffs/README.md` — State Recovery procedure added
- `bootstrap/project-repo-kit/docs/operator-guide.template.md` — Canonical Workspace section added; Common Mistakes table extended
- `bootstrap/project-repo-kit/docs/bootstrap-usage.md` — Step 3 added: Define Canonical Operational Workspace; steps renumbered (now 11 steps)
- `bootstrap/project-repo-kit/docs/bootstrap-validation-checklist.md` — Canonical Workspace section added
- `schemas/audit-event.schema.json` — platform audit event schema (v0.2.0)
- `src/emitter/index.js` — public emitter API
- `scripts/get-github-pat.sh` — PAT retrieval with `secret.retrieval` emission at all 6 outcomes
- `.github/workflows/sync-status-to-project.yml` — label-to-project sync
- `.github/workflows/reconcile-status-to-project.yml` — full repair pass
- `docs/controls/CTRL-HMCP-000001-runtime-secret-retrieval.md` — active control

---

## Active Constraints / Rules

- Platform vs project separation enforced — ADR-HMCP-001
- No secrets in any event payload, log, or committed file
- Event emission must be non-blocking — ADR-HMCP-002
- All events must conform to `schemas/audit-event.schema.json` v0.2.0
- Feature branches only — no direct commits to main
- PR process mandatory: branch → push → PR → merge → delete branch → sync main
- All Claude Code work must carry a CC-HMCP-XXXXXX prompt ID
- Model C (agent-mediated emission) is the Phase 2 approved instrumentation approach
- PAT retrieved at runtime only; never stored in repo, config, or committed env files
- Issues = canonical backlog; `status:*` labels = execution state; project board = derived visualization
- GitHub `main` and merged PR history are the authoritative source of truth for merged repo state

---

## Known Gaps

- VG-HMCP-000001 — Keeper service-context viability on dude-mcp-01 (Open — session expiry in systemd unconfirmed; no new evidence)
- VG-HMCP-000003 — GitHub PAT retrieval path visibility (Implementation complete — `secret.retrieval` events emitted at all 6 retrieval outcomes; awaiting live end-to-end validation on dude-mcp-01 with `EVENT_INGESTION_URL` set before full closure)

---

## Next Recommended Task

- **ID:** CC-HMCP-000009A (or architect-assigned)
- **Title:** Validate VG-HMCP-000003 end-to-end on dude-mcp-01
- **Description:** Run the full `get-github-pat.sh` path on dude-mcp-01 with the ingestion server running and `EVENT_INGESTION_URL` set. Verify that `secret.retrieval` events are received and persisted. Close VG-HMCP-000003 conditionally or fully based on results.
- **Rationale:** VG-HMCP-000003 has been implemented but not live-validated. This is the outstanding validation step before the gap can be formally closed.

Alternatively, the architect may define follow-on platform work (e.g., Phase 3 scope definition, ERATE Workbench integration planning).

---

## Open Questions

- Has VG-HMCP-000003 been validated end-to-end on dude-mcp-01? If not, this is the highest-priority open item before new feature work.
- `PROJECT_PAT` secret: still not configured in GitHub Actions — sync workflows will fail with a clear diagnostic until the operator adds it.
- Is `linkedin-thought-leadership` now using the bootstrap kit? If so, its canonical workspace (`dude-ops-01:/home/drake/projects/linkedin-thought-leadership`) should be reflected in that repo's primer and boot block.

---

## Notes

- Phase 2.5 (Secrets and Remaining Observability) is complete as of PR #57.
- Bootstrap kit series (PRs #60, #61, #62) represents Phase 3 initial work: making the platform reusable across governed repos.
- CC-HMCP-000008 (this task) adds operational discipline around workspace canonicality and state recovery — a guardrail prompted by the `linkedin-thought-leadership` bootstrap experience revealing that multi-clone repos need explicit workspace rules.
- The boot block in `CLAUDE.md` remains stale at CC-HMCP-000001D. This is intentional — the handoff is the authoritative state source. The boot block will be updated in a future task when the boot block update checklist is explicitly run.
