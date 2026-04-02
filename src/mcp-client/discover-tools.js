'use strict';

// Tool discovery utility for the real GitHub MCP server.
//
// Connects to the MCP server, lists all available tools (name + description),
// and optionally runs a single test tool call to validate connectivity.
//
// Usage:
//   GITHUB_PERSONAL_ACCESS_TOKEN=<pat> node src/mcp-client/discover-tools.js
//
// Output:
//   Tool list to stdout (JSON)
//   Connection lifecycle to stderr
//
// Flags:
//   --probe   Run the identity probe tool (get_me or safe fallback)
//   --json    Output tools as JSON array (default: human-readable table)

const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client');
const _sdkClientDir = path.dirname(require.resolve('@modelcontextprotocol/sdk/client'));
const { StdioClientTransport } = require(path.join(_sdkClientDir, 'stdio'));
const { selectIdentityProbe, classifyToolResult } = require('./tool-selector');

const COMMAND = process.env.GITHUB_MCP_COMMAND || 'docker';
const ARGS = process.env.GITHUB_MCP_ARGS
  ? JSON.parse(process.env.GITHUB_MCP_ARGS)
  : ['run', '-i', '--rm', '-e', 'GITHUB_PERSONAL_ACCESS_TOKEN', 'ghcr.io/github/github-mcp-server'];

const MCP_CLIENT_INFO = { name: 'home-mcp-lab-discovery', version: '0.1.0' };

const flags = new Set(process.argv.slice(2));
const doProbe = flags.has('--probe');
const doJson = flags.has('--json');

async function main() {
  process.stderr.write(`[discover] Connecting: ${COMMAND} ${ARGS.join(' ')}\n`);

  const transport = new StdioClientTransport({ command: COMMAND, args: ARGS, env: process.env });
  const client = new Client(MCP_CLIENT_INFO, { capabilities: {} });

  try {
    await client.connect(transport);
    process.stderr.write('[discover] Connected\n');

    const { tools } = await client.listTools();

    if (doJson) {
      console.log(JSON.stringify(tools, null, 2));
    } else {
      console.log(`\nGitHub MCP Server — ${tools.length} tool(s) available:\n`);
      for (const t of tools) {
        const req = t.inputSchema && t.inputSchema.required ? t.inputSchema.required.join(', ') : '(none)';
        console.log(`  ${t.name}`);
        console.log(`    description : ${(t.description || '').slice(0, 120)}`);
        console.log(`    required    : ${req}`);
        console.log();
      }
    }

    if (doProbe) {
      const probeName = selectIdentityProbe(tools);
      if (!probeName) {
        process.stderr.write('[discover] No safe identity probe tool found — cannot probe\n');
        process.exit(1);
      }

      process.stderr.write(`[discover] Probing tool: ${probeName}\n`);

      let result = null;
      let callErr = null;
      try {
        result = await client.callTool({ name: probeName, arguments: {} });
      } catch (err) {
        callErr = err;
      }

      const classification = classifyToolResult(result, callErr);
      process.stderr.write(`[discover] Probe classification: ${classification}\n`);

      if (classification === 'mcp_error') {
        process.stderr.write(`[discover] MCP transport error: ${callErr.message}\n`);
        process.exit(1);
      } else if (classification === 'auth_failure') {
        const summary = JSON.stringify(result).slice(0, 200);
        process.stderr.write(`[discover] GitHub API auth failure (MCP session OK): ${summary}\n`);
        // Exit 2 signals auth failure distinct from MCP failure (exit 1)
        process.exit(2);
      } else {
        const summary = JSON.stringify(result).slice(0, 200);
        process.stderr.write(`[discover] Probe success: ${summary}\n`);
        console.log(`\nProbe result (${probeName}):`);
        console.log(JSON.stringify(result, null, 2));
      }
    }

  } finally {
    try {
      await client.close();
      process.stderr.write('[discover] Disconnected\n');
    } catch (_) {}
  }
}

main().catch(err => {
  process.stderr.write(`[discover] Fatal: ${err.message}\n`);
  process.exit(1);
});
