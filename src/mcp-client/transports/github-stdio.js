'use strict';

// Real GitHub MCP transport — connects to the GitHub MCP server via stdio subprocess.
//
// Requirements:
//   - GITHUB_PERSONAL_ACCESS_TOKEN environment variable set with a valid PAT
//   - A GitHub MCP server accessible via the configured command (default: Docker)
//   - See GITHUB_MCP_COMMAND / GITHUB_MCP_ARGS in transport-factory.js for configuration
//
// This transport owns the full MCP client lifecycle: connect, callTool, close.
// The MCP SDK Client and StdioClientTransport are encapsulated here — they do
// not leak upward into session-runner or emitter code.

const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client');

// StdioClientTransport is not an explicit named export in the SDK's package.json.
// Resolve it from the same dist directory as the Client to avoid glob export issues
// with Node.js 18's CJS module resolver.
const _sdkClientDir = path.dirname(require.resolve('@modelcontextprotocol/sdk/client'));
const { StdioClientTransport } = require(path.join(_sdkClientDir, 'stdio'));

const MCP_CLIENT_INFO = { name: 'home-mcp-lab', version: '0.1.0' };

class GitHubStdioTransport {
  /**
   * @param {{ command: string, args: string[], env?: Record<string, string> }} config
   *   command  — executable to invoke (e.g. 'docker')
   *   args     — arguments array (e.g. ['run', '-i', '--rm', ...])
   *   env      — environment variables; defaults to process.env
   */
  constructor(config) {
    this._config = config;
    this._client = null;
  }

  async connect() {
    const { command, args, env } = this._config;
    process.stderr.write(`[mcp-github-transport] connecting: ${command} ${args.join(' ')}\n`);

    const mcpTransport = new StdioClientTransport({
      command,
      args,
      env: env || process.env
    });

    const client = new Client(MCP_CLIENT_INFO, { capabilities: {} });

    try {
      await client.connect(mcpTransport);
    } catch (err) {
      throw new Error(`[mcp-github-transport] connect failed: ${err.message}`);
    }

    this._client = client;
    process.stderr.write('[mcp-github-transport] connected\n');
  }

  async callTool(name, args) {
    if (!this._client) {
      throw new Error('GitHubStdioTransport: not connected');
    }
    try {
      return await this._client.callTool({ name, arguments: args });
    } catch (err) {
      throw new Error(`[mcp-github-transport] callTool(${name}) failed: ${err.message}`);
    }
  }

  async close() {
    if (!this._client) return;
    try {
      await this._client.close();
      process.stderr.write('[mcp-github-transport] closed\n');
    } catch (err) {
      // Log and swallow — close errors must not propagate to session teardown.
      process.stderr.write(`[mcp-github-transport] close error (ignored): ${err.message}\n`);
    } finally {
      this._client = null;
    }
  }
}

module.exports = { GitHubStdioTransport };
