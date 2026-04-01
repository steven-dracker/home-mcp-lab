'use strict';

// Demo: run an instrumented GitHub MCP session.
//
// Demonstrates the full instrumented path:
//   session.start → tool.invocation (×2) → session.end
//
// Usage:
//
//   Demo mode (no auth or Docker required):
//     MCP_TRANSPORT=demo node src/mcp-client/demo-github-session.js
//
//   Real mode (requires Docker + GitHub PAT on dude-mcp-01 or equivalent):
//     GITHUB_PERSONAL_ACCESS_TOKEN=<pat> node src/mcp-client/demo-github-session.js
//
// Tool names in real mode are resolved from the server at runtime (see TOOL_NAMES below).
// Override them via env vars if the live server uses different names:
//   TOOL_NAME_ME=get_me TOOL_NAME_SEARCH=search_repositories
//
// Audit events are delivered to EVENT_INGESTION_URL if set, otherwise written
// to audit-log/tool-invocations.jsonl (JSONL fallback).
//
// To also write to the ingestion server:
//   EVENT_INGESTION_URL=http://localhost:4318/events \
//   MCP_TRANSPORT=demo \
//   node src/mcp-client/demo-github-session.js

const { createTransport } = require('./transport-factory');
const { runMcpSession } = require('./session-runner');

// Tool names for the real GitHub MCP server.
// Overridable via env in case the live server exposes different names.
const TOOL_NAMES = {
  me: process.env.TOOL_NAME_ME || 'get_me',
  search: process.env.TOOL_NAME_SEARCH || 'search_repositories'
};

const SESSION_CONTEXT = {
  projectId: 'home-mcp-lab',
  agentId: 'cc-hmcp-000005b',
  mcpServer: 'github-mcp-server',
  initiatingContext: 'CC-HMCP-000005B'
};

async function main() {
  const mode = process.env.MCP_TRANSPORT || 'github';
  console.log(`[demo] Starting GitHub MCP session  transport=${mode}`);
  console.log(`[demo] Tools: me=${TOOL_NAMES.me}  search=${TOOL_NAMES.search}`);

  const transport = createTransport(mode);

  await runMcpSession(transport, SESSION_CONTEXT, async ({ callTool }) => {
    // Tool call 1: get authenticated user
    const me = await callTool(TOOL_NAMES.me, {});
    console.log(`[demo] ${TOOL_NAMES.me} result:`, JSON.stringify(me).slice(0, 200));

    // Tool call 2: search repositories
    const repos = await callTool(TOOL_NAMES.search, { query: 'user:@me', per_page: 3 });
    console.log(`[demo] ${TOOL_NAMES.search} result:`, JSON.stringify(repos).slice(0, 200));
  });

  const target = process.env.EVENT_INGESTION_URL
    ? `ingestion server (${process.env.EVENT_INGESTION_URL})`
    : 'audit-log/tool-invocations.jsonl (JSONL fallback)';
  console.log(`[demo] Session complete. Events delivered to: ${target}`);
}

main().catch(err => {
  console.error('[demo] Fatal error:', err.message);
  process.exit(1);
});
