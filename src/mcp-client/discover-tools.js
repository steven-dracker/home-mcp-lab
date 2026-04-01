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
//   --probe   Run a quick test tool call (uses first available tool with no required args)
//   --json    Output tools as JSON array (default: human-readable table)

const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client');
const _sdkClientDir = path.dirname(require.resolve('@modelcontextprotocol/sdk/client'));
const { StdioClientTransport } = require(path.join(_sdkClientDir, 'stdio'));

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
      // Find a tool with no required args to call as a connection probe.
      const probeTarget = tools.find(t =>
        !t.inputSchema || !t.inputSchema.required || t.inputSchema.required.length === 0
      );
      if (probeTarget) {
        process.stderr.write(`[discover] Probing tool: ${probeTarget.name}\n`);
        try {
          const result = await client.callTool({ name: probeTarget.name, arguments: {} });
          const summary = JSON.stringify(result).slice(0, 200);
          process.stderr.write(`[discover] Probe success: ${summary}\n`);
          console.log(`\nProbe result (${probeTarget.name}):`);
          console.log(JSON.stringify(result, null, 2));
        } catch (err) {
          process.stderr.write(`[discover] Probe failed: ${err.message}\n`);
        }
      } else {
        process.stderr.write('[discover] No zero-arg tool found for probe\n');
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
