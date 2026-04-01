# Handoff — 2026-04-01 / CC-HMCP-000004H

## Current System State

- **Last Completed Task:** CC-HMCP-000004H — Ingestion deduplication by event_id
- **Current Phase:** Phase 2 — Implementation (core pipeline complete)
- **Active Branch:** none (main is clean)
- **PR Status:** All PRs merged through CC-HMCP-000004H (PR #29)

---

## Completed Work (Recent)

- CC-HMCP-000004E — Append-only JSONL persistence at ingestion boundary
- CC-HMCP-000004F — `GET /events` readback with `correlation_id`, `event_type`, `limit` filters
- CC-HMCP-000004G — Bounded retry/backoff for HTTP delivery (3 attempts, 500ms fixed delay)
- CC-HMCP-000004H — Ingestion-side deduplication by `event_id`; seen-set survives server restart

---

## Key Artifacts

- `schemas/audit-event.schema.json` — platform audit event schema (v0.2.0)
- `src/emitter/index.js` — public emitter API: `withSession()`, `withToolInstrumentation()`, `emitToolInvocation()`, `emitSessionStart()`, `emitSessionEnd()`
- `src/emitter/event-builder.js` — builds `tool.invocation`, `session.start`, `session.end` events
- `src/emitter/transport.js` — HTTP delivery with 3-attempt bounded retry; JSONL fallback when no endpoint configured
- `src/emitter/failure-observer.js` — records emission failures to stderr; never propagates to caller
- `src/ingestion/server.js` — ingestion boundary: `POST /events` (persist + dedup), `GET /events` (readback)
- `ingestion-store/events.jsonl` — runtime append-only event store (gitignored)
- `docs/adr/ADR-HMCP-001-platform-vs-project-separation.md` — foundational separation ADR
- `docs/adr/ADR-HMCP-002-mcp-tool-call-instrumentation-strategy.md` — Model C selection and event semantics
- `docs/architecture/event-emitter-integration-pattern.md` — emitter integration pattern
- `docs/architecture/reference-event-emitter-design.md` — emitter component blueprint
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
- VG-HMCP-000002 — MCP tool invocation visibility (Unblocked by ADR-HMCP-002; emitter implemented but not yet wired to a real MCP server)
- VG-HMCP-000003 — GitHub PAT retrieval path visibility (Open — retrieval path uninvestigated; `secret.retrieval` events not yet emitted)
- VG-HMCP-000004 — MCP session lifecycle visibility (Unblocked; session lifecycle implemented in emitter; not yet wired to a real agent session)

---

## Next Recommended Task

- **ID:** CC-HMCP-000005A
- **Title:** Wire emitter to a real MCP server session (GitHub MCP)
- **Description:** Integrate `withSession()` and `withToolInstrumentation()` into an actual Claude Code / GitHub MCP server workflow so real tool calls produce real `tool.invocation` and `session.*` events delivered to the ingestion boundary.
- **Rationale:** The full pipeline (emit → deliver → deduplicate → persist → read back) is now implemented and validated end-to-end with simulated calls. The next gate is closing VG-HMCP-000002 and VG-HMCP-000004 with real signal. This is the first time the platform observes actual MCP tool usage, not just demo-generated events.

---

## Open Questions

- `seenEventIds` Set grows unboundedly in the ingestion server process — acceptable at current volume; a time-bounded or size-capped approach should be evaluated before production use.
- GitHub PAT retrieval path on dude-mcp-01 has not been inspected — VG-HMCP-000003 remains uninvestigated and blocks `secret.retrieval` event emission for the GitHub MCP integration.
- Should the ingestion server be run as a managed systemd service on dude-ops-01 or dude-mcp-01? Currently started manually.

---

## Notes

- The core Phase 2 pipeline is functionally complete: emission → retry → HTTP delivery → deduplication → persistence → readback. All slices (CC-HMCP-000004B through 000004H) are merged to main.
- No external dependencies have been introduced — the emitter and ingestion server use only Node.js built-ins.
- The emitter is demo-wired only. Real MCP server integration is the next phase of work.
- `ingestion-store/` and `audit-log/` are runtime directories, gitignored, and must be created at runtime.
