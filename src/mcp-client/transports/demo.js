'use strict';

// Demo MCP transport — simulates GitHub MCP server responses.
// No network, no auth, no subprocess required.
// Use when MCP_TRANSPORT=demo for local development and emitter validation.

const DEMO_RESPONSES = {
  get_me: {
    login: 'demo-user',
    name: 'Demo User',
    public_repos: 42
  },
  search_repositories: {
    total_count: 2,
    items: [
      { name: 'home-mcp-lab', full_name: 'demo-user/home-mcp-lab', description: 'Demo repo A' },
      { name: 'demo-project', full_name: 'demo-user/demo-project', description: 'Demo repo B' }
    ]
  },
  list_repositories: [
    { name: 'home-mcp-lab', full_name: 'demo-user/home-mcp-lab', private: false },
    { name: 'demo-project', full_name: 'demo-user/demo-project', private: false }
  ]
};

class DemoTransport {
  constructor() {
    this._connected = false;
  }

  async connect() {
    this._connected = true;
    process.stderr.write('[mcp-demo-transport] connected (simulated)\n');
  }

  // Simulate a brief async response matching the tool's registered demo fixture.
  async callTool(name, _args) {
    if (!this._connected) {
      throw new Error('DemoTransport: not connected');
    }
    const response = DEMO_RESPONSES[name];
    if (response === undefined) {
      throw new Error(`DemoTransport: unknown tool "${name}"`);
    }
    await new Promise(resolve => setTimeout(resolve, 10));
    return response;
  }

  async close() {
    this._connected = false;
    process.stderr.write('[mcp-demo-transport] closed (simulated)\n');
  }
}

module.exports = { DemoTransport };
