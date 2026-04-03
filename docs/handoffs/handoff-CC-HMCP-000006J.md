# Handoff — 2026-04-03 / CC-HMCP-000006J

## Current System State

- **Last Completed Task:** CC-HMCP-000006B — emit `secret.retrieval` audit events from the PAT retrieval path (PR #57)
- **Current Phase:** Phase 2.5 — Secrets and Remaining Observability — **COMPLETE**
- **Active Branch:** none (main is clean, PR #57 merged)
- **PR Status:** All PRs merged through CC-HMCP-000006B (#57)

---

## Completed Work (Recent)

- CC-HMCP-000006F — Status-driven execution state via `status:*` labels and Actions sync (PR #54)
- CC-HMCP-000006G — Harden project sync; add reconciliation workflow (PR #55)
- CC-HMCP-000006B — Emit `secret.retrieval` audit events from PAT retrieval path (PR #57)

---

## Key Artifacts

- `schemas/audit-event.schema.json` — platform audit event schema (v0.2.0); defines `tool.invocation`, `session.start`, `session.end`, `secret.retrieval`
- `src/emitter/index.js` — public emitter API: `withSession()`, `withToolInstrumentation()`, `emitSessionStart()`, `emitSessionEnd()`, `emitSecretRetrieval()`
- `src/emitter/event-builder.js` — event builders including `buildSecretRetrievalEvent()`
- `src/emitter/transport.js` — HTTP delivery with 3-attempt bounded retry; JSONL fallback
- `src/ingestion/server.js` — ingestion boundary: `POST /events` (persist + dedup), `GET /events` (readback)
- `src/mcp-client/session-runner.js` — instrumented session orchestration
- `scripts/get-github-pat.sh` — PAT retrieval: pass-through → Keeper Commander → gh CLI fallback; emits `secret.retrieval` at every outcome
- `scripts/emit-secret-retrieval.js` — CLI wrapper: invoked by `get-github-pat.sh`; calls `emitSecretRetrieval()`; non-blocking and non-fatal
- `scripts/run-with-github-pat.sh` — injection wrapper: retrieves PAT, execs target command
- `.github/workflows/sync-status-to-project.yml` — label-to-project sync (hardened; `workflow_dispatch` support)
- `.github/workflows/reconcile-status-to-project.yml` — full repair pass; scans all open issues
- `docs/workflows/github-issue-lifecycle.md` — canonical lifecycle reference
- `docs/adr/ADR-HMCP-002-mcp-tool-call-instrumentation-strategy.md` — Model C selection
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

---

## Known Gaps

- VG-HMCP-000001 — Keeper service-context viability on dude-mcp-01 (Open — session expiry in systemd unconfirmed; no new evidence to close)
- VG-HMCP-000003 — GitHub PAT retrieval path visibility (Narrowed to closed — `secret.retrieval` events now emitted at all 6 retrieval outcomes; gap resolved pending live validation on dude-mcp-01 with `EVENT_INGESTION_URL` set)

---

## Next Recommended Task

- **ID:** CC-HMCP-000007A
- **Title:** Create reusable project bootstrap kit for new MCP-governed repositories
- **Description:** Build a bootstrap kit that a new project repository can use to adopt platform governance quickly. Should include: a vanilla project primer (adapted from `chatgpt-primer.md`), a CLAUDE.md boot block template, a handoff system stub, and a minimal MCP Node.js starter structure with the platform emitter wired in.
- **Rationale:** Phase 2.5 is complete. The platform now has event emission, session lifecycle, secret retrieval observability, issue-based backlog, and label-driven state. The next high-value step is making the platform reusable — lowering the cost of onboarding a second project (e.g., ERATE Workbench) by providing a structured starting point rather than repeating the bootstrap process from scratch.

---

## Open Questions

- Has VG-HMCP-000003 been validated end-to-end on dude-mcp-01 with the ingestion server running and `EVENT_INGESTION_URL` set? If not, close conditionally and document the outstanding live validation step.
- `PROJECT_PAT` secret: still not configured in GitHub Actions — sync workflows will fail with a clear diagnostic until the operator adds it. No unblocked work depends on it.

---

## Notes

- Phase 2.5 (Secrets and Remaining Observability) is complete as of PR #57. All three milestoned issues for HMCP-M2.5 are resolved.
- `secret.retrieval` events are emitted at 6 points in `get-github-pat.sh`: env passthrough success, Keeper success, Keeper failure (non-zero exit), Keeper record-found-no-field failure, gh CLI success, and no-path failure.
- `_emit_retrieval` is backgrounded (`&`) with output suppressed — emission failure cannot block or alter PAT retrieval behavior.
- `secret_identifier` uses `KEEPER_GITHUB_PAT_UID` (record UID, not the secret value) or a static label depending on path — PAT value never appears in any event field.
- GitHub Projects v2 requires `project` OAuth scope; current platform PAT lacks it. Label-based state (`status:*`) is authoritative. Project board sync is derived visualization only.
- Primer (`chatgpt-primer.md`) was not updated — durable behavioral rules are unchanged. Live state is carried by this handoff.
