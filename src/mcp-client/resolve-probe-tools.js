'use strict';

// Resolves safe probe tool names from a live GitHub MCP server.
// Outputs a single JSON object to stdout — used by validate-real-github-mcp.sh.
//
// Output format:
//   {"identity": "get_me", "search": "search_repositories"}
//
// Exit codes:
//   0 — both tools resolved
//   1 — connection or discovery failure
//
// Usage (in shell):
//   PROBE_TOOLS=$(GITHUB_PERSONAL_ACCESS_TOKEN=<pat> node src/mcp-client/resolve-probe-tools.js)
//   IDENTITY=$(echo "$PROBE_TOOLS" | python3 -c "import sys,json; print(json.load(sys.stdin)['identity'])")
//   SEARCH=$(echo  "$PROBE_TOOLS" | python3 -c "import sys,json; print(json.load(sys.stdin)['search'])")

const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client');
const _sdkClientDir = path.dirname(require.resolve('@modelcontextprotocol/sdk/client'));
const { StdioClientTransport } = require(path.join(_sdkClientDir, 'stdio'));
const { selectIdentityProbe, selectSearchProbe } = require('./tool-selector');

const COMMAND = process.env.GITHUB_MCP_COMMAND || 'docker';
const ARGS = process.env.GITHUB_MCP_ARGS
  ? JSON.parse(process.env.GITHUB_MCP_ARGS)
  : ['run', '-i', '--rm', '-e', 'GITHUB_PERSONAL_ACCESS_TOKEN', 'ghcr.io/github/github-mcp-server'];

const MCP_CLIENT_INFO = { name: 'home-mcp-lab-resolver', version: '0.1.0' };

async function main() {
  const transport = new StdioClientTransport({ command: COMMAND, args: ARGS, env: process.env });
  const client = new Client(MCP_CLIENT_INFO, { capabilities: {} });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();

    const identity = selectIdentityProbe(tools);
    const search = selectSearchProbe(tools);

    if (!identity) {
      process.stderr.write('[resolve-probe-tools] No safe identity probe tool found\n');
      process.exit(1);
    }

    console.log(JSON.stringify({ identity, search: search || null }));
  } finally {
    try { await client.close(); } catch (_) {}
  }
}

main().catch(err => {
  process.stderr.write(`[resolve-probe-tools] Fatal: ${err.message}\n`);
  process.exit(1);
});
