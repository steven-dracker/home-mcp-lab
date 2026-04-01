'use strict';

// Selects the active MCP transport based on the MCP_TRANSPORT environment variable
// or an explicit mode argument passed to createTransport().
//
// Modes:
//   demo    — DemoTransport: simulated responses, no auth or network required
//   github  — GitHubStdioTransport: real connection via stdio subprocess (default)
//
// GitHub MCP server command configuration (used when mode = 'github'):
//   GITHUB_MCP_COMMAND  — executable to invoke (default: 'docker')
//   GITHUB_MCP_ARGS     — JSON-encoded array of arguments
//                         (default: docker run for ghcr.io/github/github-mcp-server)
//
// GITHUB_PERSONAL_ACCESS_TOKEN must be set in the environment when using GitHub mode.
// It is passed into the subprocess environment — never hard-coded or logged.

const { DemoTransport } = require('./transports/demo');
const { GitHubStdioTransport } = require('./transports/github-stdio');

const DEFAULT_COMMAND = 'docker';
const DEFAULT_ARGS = [
  'run', '-i', '--rm',
  '-e', 'GITHUB_PERSONAL_ACCESS_TOKEN',
  'ghcr.io/github/github-mcp-server'
];

/**
 * Create and return an MCP transport instance.
 *
 * @param {string} [mode] — 'demo' | 'github'; falls back to MCP_TRANSPORT env var, then 'github'
 * @returns {DemoTransport | GitHubStdioTransport}
 */
function createTransport(mode) {
  const effectiveMode = mode || process.env.MCP_TRANSPORT || 'github';

  if (effectiveMode === 'demo') {
    return new DemoTransport();
  }

  const command = process.env.GITHUB_MCP_COMMAND || DEFAULT_COMMAND;
  const args = process.env.GITHUB_MCP_ARGS
    ? JSON.parse(process.env.GITHUB_MCP_ARGS)
    : DEFAULT_ARGS;

  return new GitHubStdioTransport({ command, args });
}

module.exports = { createTransport };
