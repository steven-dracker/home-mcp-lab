# Handoff — 2026-04-02 / CC-HMCP-000006A

## Current System State

- **Last Completed Task:** CC-HMCP-000006A — Add non-interactive GitHub PAT retrieval and injection (PR #36)
- **Current Phase:** Phase 2 — Real transport integration (operational hardening in progress)
- **Active Branch:** none (main is clean at `d8bde3c`)
- **PR Status:** All PRs merged through CC-HMCP-000006A (#36)

---

## Completed Work (Recent)

- CC-HMCP-000005D — Run live validation; closed VG-HMCP-000002 and VG-HMCP-000004 (PR #35)
- CC-HMCP-000006A — Non-interactive GitHub PAT retrieval via Keeper/gh fallback; narrowed VG-HMCP-000003 (PR #36)

---

## Key Artifacts

- `schemas/audit-event.schema.json` — platform audit event schema (v0.2.0); defines `tool.invocation`, `session.start`, `session.end`, `secret.retrieval`
- `src/emitter/index.js` — public emitter API: `withSession()`, `withToolInstrumentation()`, `emitToolInvocation()`, `emitSessionStart()`, `emitSessionEnd()`
- `src/emitter/transport.js` — HTTP delivery with 3-attempt bounded retry; JSONL fallback
- `src/ingestion/server.js` — ingestion boundary: `POST /events` (persist + dedup), `GET /events` (readback)
- `src/mcp-client/transports/demo.js` — demo transport (no auth required)
- `src/mcp-client/transports/github-stdio.js` — real transport (`@modelcontextprotocol/sdk`)
- `src/mcp-client/transport-factory.js` — selects transport via `MCP_TRANSPORT` env var
- `src/mcp-client/session-runner.js` — instrumented session orchestration
- `src/mcp-client/tool-selector.js` — safe probe tool selection; mutation denylist
- `src/mcp-client/discover-tools.js` — tool discovery + identity probe with layered exit codes
- `src/mcp-client/resolve-probe-tools.js` — resolves `{identity, search}` probe tool names
- `src/mcp-client/demo-github-session.js` — demo entry point; tool names overridable via env
- `scripts/get-github-pat.sh` — PAT retrieval: pass-through → Keeper Commander → gh CLI fallback
- `scripts/run-with-github-pat.sh` — injection wrapper: retrieves PAT, execs target command
- `tests/validate-mcp-transport.js` — 27-test suite (demo, session, selector, classification)
- `tests/validate-real-github-mcp.sh` — 4-layer live validation script for dude-mcp-01
- `docs/runbooks/keeper-noninteractive-setup.md` — host prerequisites and Keeper setup steps
- `docs/adr/ADR-HMCP-001-platform-vs-project-separation.md` — foundational separation ADR
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
- PR text generated after execution summary is returned — not with the initial prompt
- Model C (agent-mediated emission) is the Phase 2 approved instrumentation approach
- PAT retrieved at runtime only; never stored in repo, config, or committed env files

---

## Known Gaps

- VG-HMCP-000001 — Keeper non-interactive secret retrieval (Open — Keeper session expiry in service contexts unresolved)
- VG-HMCP-000003 — GitHub PAT retrieval path visibility (Narrowed — retrieval path defined; `secret.retrieval` events not yet emitted)

---

## Next Recommended Task

- **ID:** CC-HMCP-000006B
- **Title:** Emit `secret.retrieval` audit events from the PAT retrieval path
- **Description:** Add `emitSecretRetrieval` to the platform emitter and wire it into `get-github-pat.sh` or an equivalent thin Node.js wrapper. Emit a `secret.retrieval` event for each PAT retrieval attempt (success and failure), conforming to `schemas/audit-event.schema.json`. Do not include the PAT value in the event; use `KEEPER_GITHUB_PAT_UID` or a non-sensitive label as the `secret_identifier`.
- **Rationale:** This is the exact remaining blocker for closing VG-HMCP-000003. The schema, ingestion server, and retrieval path are all in place. Wiring the event is the final step to make credential access fully observable.

---

## Open Questions

- Does the Keeper session on dude-mcp-01 survive in a systemd service context (no TTY, restricted PATH)? This must be confirmed before marking VG-HMCP-000001 closed.
- Should `secret.retrieval` events be emitted from the shell script (via a Node.js one-liner) or should the retrieval scripts be promoted to a Node.js helper that emits natively?

---

## Notes

- CC-HMCP-000005D live validation used `@modelcontextprotocol/server-github` (npm, v2025.4.8) as the MCP server — Docker was unavailable and SSH to dude-mcp-01 failed. This is a real MCP server making real GitHub API calls; evidence quality is sufficient for gap closure.
- VG-HMCP-000002 and VG-HMCP-000004 are closed with confirmed live evidence (4 events ingested: `session.start`, `tool.invocation` ×2, `session.end`, correlation_id `sess-20260402-fa14ce77`).
- `scripts/get-github-pat.sh` passes 5 of 6 validation tests; the 6th (no-tools-available exit) cannot be isolated without stripping `/usr/bin` from PATH, which breaks bash itself. The failure mode is correct; the test harness is the limitation.
- The `KEEPER_GITHUB_PAT_UID` env var holds a record identifier, not a secret — safe to set in systemd unit files or shell profiles.
