# Handoff — 2026-04-03 / CC-HMCP-000006G

## Current System State

- **Last Completed Task:** CC-HMCP-000006G — Harden GitHub Actions project sync (PR #55)
- **Current Phase:** Phase 2.5 — Secrets and Remaining Observability (final item: CC-HMCP-000006B)
- **Active Branch:** none (main is clean at `1afab45`)
- **PR Status:** All PRs merged through CC-HMCP-000006G (#55)

---

## Completed Work (Recent)

- CC-HMCP-000006A — Non-interactive GitHub PAT retrieval and injection (PR #36)
- CC-HMCP-000006D — Backlog catalog into GitHub Issues (#37–#52, 16 items) (no PR — GitHub API only)
- CC-HMCP-000006E — GitHub milestones and issue-to-milestone assignments (PR #53)
- CC-HMCP-000006F — Status-driven execution state via `status:*` labels and Actions sync (PR #54)
- CC-HMCP-000006G — Harden project sync; add reconciliation workflow (PR #55)

---

## Key Artifacts

- `schemas/audit-event.schema.json` — platform audit event schema (v0.2.0); defines `tool.invocation`, `session.start`, `session.end`, `secret.retrieval`
- `src/emitter/index.js` — public emitter API: `withSession()`, `withToolInstrumentation()`, `emitSessionStart()`, `emitSessionEnd()`
- `src/emitter/transport.js` — HTTP delivery with 3-attempt bounded retry; JSONL fallback
- `src/ingestion/server.js` — ingestion boundary: `POST /events` (persist + dedup), `GET /events` (readback)
- `src/mcp-client/session-runner.js` — instrumented session orchestration
- `src/mcp-client/tool-selector.js` — safe probe tool selection; mutation denylist
- `src/mcp-client/transports/github-stdio.js` — real transport (`@modelcontextprotocol/sdk`)
- `scripts/get-github-pat.sh` — PAT retrieval: pass-through → Keeper Commander → gh CLI fallback
- `scripts/run-with-github-pat.sh` — injection wrapper: retrieves PAT, execs target command
- `tests/validate-mcp-transport.js` — 27-test validation suite
- `tests/validate-real-github-mcp.sh` — 4-layer live validation script for dude-mcp-01
- `docs/runbooks/keeper-noninteractive-setup.md` — Keeper host prerequisites and setup steps
- `.github/workflows/sync-status-to-project.yml` — label-to-project sync (hardened; `workflow_dispatch` support; multi-status detection; retry on item lookup)
- `.github/workflows/reconcile-status-to-project.yml` — full repair pass; scans all open issues; malformed issues reported but non-fatal
- `docs/workflows/github-issue-lifecycle.md` — canonical lifecycle reference: state model, Claude instructions, testing path, activation steps
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

- VG-HMCP-000001 — Keeper service-context viability on dude-mcp-01 (Open — session expiry in systemd unconfirmed)
- VG-HMCP-000003 — GitHub PAT retrieval path visibility (Narrowed — retrieval path defined; `secret.retrieval` events not yet emitted)

---

## Next Recommended Task

- **ID:** CC-HMCP-000006B
- **Title:** Emit `secret.retrieval` audit events from the PAT retrieval path
- **Issue:** #37 (`status:ready`)
- **Description:** Add `emitSecretRetrieval(context, outcome)` to `src/emitter/index.js`. Call it from the PAT retrieval path — either from `scripts/get-github-pat.sh` via a thin Node.js one-liner, or by promoting retrieval to a Node.js helper. Emit on every attempt (success and failure). `secret_identifier` must use `KEEPER_GITHUB_PAT_UID` or a label — never the PAT value. `retrieval_method` field captures which path (keeper / env / gh) was used. Events must reach the ingestion pipeline when `EVENT_INGESTION_URL` is set.
- **Rationale:** This is the sole remaining blocker for closing VG-HMCP-000003 and completing Milestone HMCP-M2.5. All prerequisites are in place: schema, emitter, ingestion, and retrieval path.

---

## Open Questions

- Does the Keeper session on dude-mcp-01 survive in a systemd service environment (no TTY, restricted PATH)? Must be confirmed before VG-HMCP-000001 can be closed.
- Should `secret.retrieval` events be emitted from a shell-invoked Node.js one-liner or should `get-github-pat.sh` be replaced with a full Node.js module?
- `PROJECT_PAT` secret not yet configured — sync workflows will fail with clear diagnostic until operator adds it. No unblocked work depends on this.

---

## Notes

- GitHub Projects v2 requires `project` OAuth scope; current platform PAT lacks it. Label-based state (`status:*` on issues) is the authoritative execution state and does not require elevated permissions. Project board sync is a derived visualization layer only.
- Reconcile workflow (`reconcile-status-to-project.yml`) processes malformed issues (no status label, multiple status labels) as warnings — they are reported but do not abort the run for other issues.
- Issue #37 (CC-HMCP-000006B) is `status:ready`. All other 15 backlog issues are `status:backlog` or `status:in-progress` (#38 VG-HMCP-000003).
- Milestones: HMCP-M2.5 (3 issues), HMCP-M3 (9 issues), HMCP-M4 (4 issues).
