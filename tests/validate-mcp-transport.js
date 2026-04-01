'use strict';

// Lightweight validation for the MCP client transport integration.
//
// Validates:
//   1. Transport selection — demo and github modes resolve correctly
//   2. Demo transport lifecycle — connect, callTool, close, error paths
//   3. Session runner lifecycle — happy path, failure handling, close-on-throw
//   4. Regression: emitter contract and transport.submit unchanged
//
// No network, no auth, no real GitHub MCP server required.
// Run: node tests/validate-mcp-transport.js

const assert = require('assert');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

(async () => {

  // ── 1. Transport selection ────────────────────────────────────────────────

  console.log('\n1. Transport selection');

  await test('createTransport("demo") returns DemoTransport', async () => {
    const { createTransport } = require('../src/mcp-client/transport-factory');
    const { DemoTransport } = require('../src/mcp-client/transports/demo');
    const t = createTransport('demo');
    assert.ok(t instanceof DemoTransport, 'Expected DemoTransport instance');
  });

  await test('createTransport("github") returns GitHubStdioTransport', async () => {
    const { createTransport } = require('../src/mcp-client/transport-factory');
    const { GitHubStdioTransport } = require('../src/mcp-client/transports/github-stdio');
    const t = createTransport('github');
    assert.ok(t instanceof GitHubStdioTransport, 'Expected GitHubStdioTransport instance');
  });

  await test('createTransport() with MCP_TRANSPORT=demo env var selects demo', async () => {
    const saved = process.env.MCP_TRANSPORT;
    process.env.MCP_TRANSPORT = 'demo';
    // Re-require to pick up new env value (factory reads env at call time, not load time)
    const key = require.resolve('../src/mcp-client/transport-factory');
    delete require.cache[key];
    const { createTransport } = require('../src/mcp-client/transport-factory');
    const { DemoTransport } = require('../src/mcp-client/transports/demo');
    try {
      const t = createTransport();
      assert.ok(t instanceof DemoTransport, 'Expected DemoTransport via env var');
    } finally {
      if (saved === undefined) delete process.env.MCP_TRANSPORT;
      else process.env.MCP_TRANSPORT = saved;
      delete require.cache[require.resolve('../src/mcp-client/transport-factory')];
    }
  });

  // ── 2. Demo transport lifecycle ───────────────────────────────────────────

  console.log('\n2. Demo transport lifecycle');

  await test('connect → callTool("get_me") → close succeeds', async () => {
    const { DemoTransport } = require('../src/mcp-client/transports/demo');
    const t = new DemoTransport();
    await t.connect();
    const result = await t.callTool('get_me', {});
    assert.ok(result && result.login, 'Expected get_me to return an object with login');
    await t.close();
  });

  await test('callTool before connect throws "not connected"', async () => {
    const { DemoTransport } = require('../src/mcp-client/transports/demo');
    const t = new DemoTransport();
    await assert.rejects(
      () => t.callTool('get_me', {}),
      /not connected/i
    );
  });

  await test('callTool with unknown tool name throws descriptively', async () => {
    const { DemoTransport } = require('../src/mcp-client/transports/demo');
    const t = new DemoTransport();
    await t.connect();
    await assert.rejects(
      () => t.callTool('nonexistent_tool', {}),
      /unknown tool/i
    );
    await t.close();
  });

  await test('close on unconnected transport does not throw', async () => {
    const { DemoTransport } = require('../src/mcp-client/transports/demo');
    const t = new DemoTransport();
    await t.close(); // should not throw
  });

  // ── 3. Session runner lifecycle ───────────────────────────────────────────

  console.log('\n3. Session runner lifecycle');

  await test('runMcpSession: completes successfully with demo transport', async () => {
    const { createTransport } = require('../src/mcp-client/transport-factory');
    const { runMcpSession } = require('../src/mcp-client/session-runner');

    const transport = createTransport('demo');
    const sessionContext = {
      projectId: 'home-mcp-lab',
      agentId: 'validate-agent',
      mcpServer: 'github-mcp-server'
    };

    let toolCalled = false;
    await runMcpSession(transport, sessionContext, async ({ callTool }) => {
      const result = await callTool('get_me', {});
      assert.ok(result && result.login, 'Expected a result from callTool');
      toolCalled = true;
    });

    assert.ok(toolCalled, 'Expected fn body to execute');
  });

  await test('runMcpSession: fn failure is re-thrown', async () => {
    const { createTransport } = require('../src/mcp-client/transport-factory');
    const { runMcpSession } = require('../src/mcp-client/session-runner');

    const transport = createTransport('demo');
    const sessionContext = {
      projectId: 'home-mcp-lab',
      agentId: 'validate-agent',
      mcpServer: 'github-mcp-server'
    };

    await assert.rejects(
      () => runMcpSession(transport, sessionContext, async () => {
        throw new Error('deliberate test failure');
      }),
      /deliberate test failure/
    );
  });

  await test('runMcpSession: transport.close() called even when fn throws', async () => {
    const { createTransport } = require('../src/mcp-client/transport-factory');
    const { runMcpSession } = require('../src/mcp-client/session-runner');

    const transport = createTransport('demo');
    let closeCalled = false;
    const origClose = transport.close.bind(transport);
    transport.close = async () => { closeCalled = true; return origClose(); };

    const sessionContext = {
      projectId: 'home-mcp-lab',
      agentId: 'validate-agent',
      mcpServer: 'github-mcp-server'
    };

    await assert.rejects(
      () => runMcpSession(transport, sessionContext, async () => {
        throw new Error('test throw');
      }),
      /test throw/
    );

    assert.ok(closeCalled, 'Expected transport.close() to be called on fn failure');
  });

  await test('runMcpSession: multiple tool calls in one session', async () => {
    const { createTransport } = require('../src/mcp-client/transport-factory');
    const { runMcpSession } = require('../src/mcp-client/session-runner');

    const transport = createTransport('demo');
    const sessionContext = {
      projectId: 'home-mcp-lab',
      agentId: 'validate-agent',
      mcpServer: 'github-mcp-server'
    };

    let callCount = 0;
    await runMcpSession(transport, sessionContext, async ({ callTool }) => {
      await callTool('get_me', {});
      callCount++;
      await callTool('search_repositories', { query: 'user:@me' });
      callCount++;
    });

    assert.strictEqual(callCount, 2, 'Expected both tool calls to complete');
  });

  // ── 4. Regression: existing emitter contract ──────────────────────────────

  console.log('\n4. Regression: existing emitter contract');

  await test('emitter public API exports unchanged', async () => {
    const emitter = require('../src/emitter/index');
    const expected = [
      'emitToolInvocation',
      'withToolInstrumentation',
      'emitSessionStart',
      'emitSessionEnd',
      'withSession'
    ];
    for (const fn of expected) {
      assert.strictEqual(typeof emitter[fn], 'function', `Expected emitter.${fn} to be a function`);
    }
  });

  await test('transport.submit still available (JSONL fallback)', async () => {
    const { submit, AUDIT_LOG_FILE } = require('../src/emitter/transport');
    assert.strictEqual(typeof submit, 'function', 'Expected submit to be a function');
    assert.ok(AUDIT_LOG_FILE.endsWith('.jsonl'), 'Expected AUDIT_LOG_FILE to be a .jsonl path');
  });

  await test('GitHubStdioTransport: instantiates with config, close on unconnected is safe', async () => {
    const { GitHubStdioTransport } = require('../src/mcp-client/transports/github-stdio');
    const t = new GitHubStdioTransport({ command: 'echo', args: ['hello'] });
    assert.ok(t, 'Expected instance');
    await t.close(); // safe on unconnected
  });

  // ── Summary ───────────────────────────────────────────────────────────────

  const bar = '─'.repeat(40);
  console.log(`\n${bar}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);

})().catch(err => {
  console.error('\nValidation script crashed:', err.message);
  process.exit(1);
});
