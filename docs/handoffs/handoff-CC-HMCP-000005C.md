# Handoff — 2026-04-02 / CC-HMCP-000005C

## Current System State

- **Last Completed Task:** CC-HMCP-000005C — Fix live GitHub MCP validation classification (PR #33)
- **Current Phase:** Phase 2 — Real transport integration (live validation in progress)
- **Active Branch:** none (main is clean at `38369fc`)
- **PR Status:** All PRs merged through CC-HMCP-000005C (#33)

---

## Completed Work (Recent)

- CC-HMCP-000005A — Wire emitter to real GitHub MCP session (transport layer, `DemoTransport`, `GitHubStdioTransport`, `session-runner.js`)
- CC-HMCP-000005B — Add live validation tooling for dude-mcp-01 (`discover-tools.js`, `validate-real-github-mcp.sh`)
- CC-HMCP-000005C — Fix validation: safe probe tool selection, layered result reporting, corrected JSONL/ingestion evidence path

---

## Key Artifacts

- `schemas/audit-event.schema.json` — platform audit event schema (v0.2.0)
- `src/emitter/index.js` — public emitter API: `withSession()`, `withToolInstrumentation()`, `emitToolInvocation()`, `emitSessionStart()`, `emitSessionEnd()`
- `src/emitter/transport.js` — HTTP delivery with 3-attempt bounded retry; JSONL fallback
- `src/ingestion/server.js` — ingestion boundary: `POST /events` (persist + dedup), `GET /events` (readback)
- `src/mcp-client/transports/demo.js` — demo transport (simulated responses, no auth required)
- `src/mcp-client/transports/github-stdio.js` — real transport (`@modelcontextprotocol/sdk` + `StdioClientTransport`)
- `src/mcp-client/transport-factory.js` — selects transport via `MCP_TRANSPORT` env var
- `src/mcp-client/session-runner.js` — instrumented session orchestration (`withSession` + `withToolInstrumentation` over transport)
- `src/mcp-client/tool-selector.js` — safe probe tool selection with explicit preference list and mutation denylist
- `src/mcp-client/discover-tools.js` — connects to real server, lists tools, runs safe identity probe
- `src/mcp-client/resolve-probe-tools.js` — resolves `{identity, search}` probe tool names for shell script use
- `src/mcp-client/demo-github-session.js` — demo entry point; tool names overridable via env
- `tests/validate-mcp-transport.js` — 27-test validation suite (demo, session, selector, classification)
- `tests/validate-real-github-mcp.sh` — 4-layer live validation script for dude-mcp-01
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

---

## Known Gaps

- VG-HMCP-000001 — Keeper non-interactive secret retrieval (Open — separate workstream)
- VG-HMCP-000002 — MCP tool invocation visibility (Unblocked; real transport wired; live evidence not yet confirmed)
- VG-HMCP-000003 — GitHub PAT retrieval path visibility (Open — retrieval path uninvestigated)
- VG-HMCP-000004 — MCP session lifecycle visibility (Unblocked; session runner wired; live evidence not yet confirmed)

---

## Next Recommended Task

- **ID:** CC-HMCP-000005D
- **Title:** Run live validation on dude-mcp-01 and capture evidence for VG-HMCP-000002 and VG-HMCP-000004
- **Description:** Execute `validate-real-github-mcp.sh` on dude-mcp-01 with a PAT that has `read:user` scope. Capture the full validation output. If Layer 3 (GitHub API auth) passes, use the session trace as evidence to formally close or partially close VG-HMCP-000002 and VG-HMCP-000004. If auth fails, document the PAT scope requirement and update VG entries accordingly.
- **Rationale:** The transport layer is complete and the validation tooling is correct. The only remaining gate to closing the two open visibility gaps is confirmed live evidence from a real agent session on dude-mcp-01. All prior blockers (wrong probe tool, misclassified auth failure, bad JSONL expectation) are resolved.

---

## Open Questions

- Does the PAT on dude-mcp-01 have `read:user` scope? Without it, `get_me` returns 401 at Layer 3. This must be verified before VG-HMCP-000002 / VG-HMCP-000004 can be closed.
- Should the ingestion server be run as a managed systemd service on dude-ops-01 or dude-mcp-01? Currently started manually for validation runs.

---

## Notes

- The full Phase 2 pipeline is implemented end-to-end: emit → retry → HTTP delivery → deduplication → persistence → readback.
- Live validation (CC-HMCP-000005B) confirmed MCP session established and 41 tools discovered on the real server. Tool invocations returned GitHub API auth failures due to PAT scope, not transport failures. This is correctly classified as a Layer 3 issue by the updated script.
- No external dependencies beyond `@modelcontextprotocol/sdk` have been introduced. No secrets are in the repo.
- VG-HMCP-000002 and VG-HMCP-000004 cannot be closed until Layer 3 auth passes and real `tool.invocation` + `session.*` events are confirmed in the ingestion pipeline.
