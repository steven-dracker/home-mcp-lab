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
// Audit events are delivered to EVENT_INGESTION_URL if set, otherwise written
// to audit-log/tool-invocations.jsonl (JSONL fallback).
//
// To also write to the ingestion server:
//   EVENT_INGESTION_URL=http://localhost:4318/events \
//   MCP_TRANSPORT=demo \
//   node src/mcp-client/demo-github-session.js

const { createTransport } = require('./transport-factory');
const { runMcpSession } = require('./session-runner');

const SESSION_CONTEXT = {
  projectId: 'home-mcp-lab',
  agentId: 'cc-hmcp-000005a',
  mcpServer: 'github-mcp-server',
  initiatingContext: 'CC-HMCP-000005A'
};

async function main() {
  const mode = process.env.MCP_TRANSPORT || 'github';
  console.log(`[demo] Starting GitHub MCP session  transport=${mode}`);

  const transport = createTransport(mode);

  await runMcpSession(transport, SESSION_CONTEXT, async ({ callTool }) => {
    // Tool call 1: get authenticated user
    const me = await callTool('get_me', {});
    console.log('[demo] get_me result:', JSON.stringify(me).slice(0, 200));

    // Tool call 2: search repositories
    const repos = await callTool('search_repositories', { query: 'user:@me', per_page: 3 });
    console.log('[demo] search_repositories result:', JSON.stringify(repos).slice(0, 200));
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
