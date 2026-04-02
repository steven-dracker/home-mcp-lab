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

  // ── 5. Tool selector ─────────────────────────────────────────────────────

  console.log('\n5. Tool selector');

  const { selectIdentityProbe, selectSearchProbe, classifyToolResult, isMutationTool } =
    require('../src/mcp-client/tool-selector');

  // Helper: build a minimal tool descriptor
  const tool = (name, required = []) => ({ name, inputSchema: { required } });

  await test('selectIdentityProbe: prefers get_me when present', async () => {
    const tools = [
      tool('add_comment_to_pending_review', []),
      tool('search_repositories', []),
      tool('get_me', []),
      tool('list_issues', ['owner', 'repo'])
    ];
    assert.strictEqual(selectIdentityProbe(tools), 'get_me');
  });

  await test('selectIdentityProbe: uses preference-list fallback when get_me absent', async () => {
    const tools = [
      tool('search_repositories', []),
      tool('get_teams', []),
      tool('list_issues', ['owner', 'repo'])
    ];
    assert.strictEqual(selectIdentityProbe(tools), 'get_teams');
  });

  await test('selectIdentityProbe: never selects a mutation tool', async () => {
    // Only mutation tools + one search tool available — should return null or search
    const tools = [
      tool('create_issue', ['owner', 'repo', 'title']),
      tool('delete_branch', ['owner', 'repo', 'branch']),
      tool('add_comment_to_pending_review', []),
      tool('update_pull_request', ['owner', 'repo']),
      tool('search_repositories', [])  // search goes to searchProbe, not identityProbe
    ];
    const result = selectIdentityProbe(tools);
    // search_repositories is in SEARCH_PROBE_PREFERENCE, so selectIdentityProbe skips it
    assert.strictEqual(result, null, 'Expected null when only mutation or search tools available');
  });

  await test('selectIdentityProbe: returns null when no safe tool exists', async () => {
    const tools = [
      tool('create_issue', ['owner', 'repo', 'title']),
      tool('delete_branch', ['owner', 'repo'])
    ];
    assert.strictEqual(selectIdentityProbe(tools), null);
  });

  await test('selectSearchProbe: prefers search_repositories', async () => {
    const tools = [
      tool('list_repos', []),
      tool('search_repositories', ['query']),
      tool('get_me', [])
    ];
    assert.strictEqual(selectSearchProbe(tools), 'search_repositories');
  });

  await test('selectSearchProbe: falls back to list_ tool when search_repositories absent', async () => {
    const tools = [
      tool('get_me', []),
      tool('list_issues', ['owner', 'repo']),
      tool('list_repositories', [])
    ];
    assert.strictEqual(selectSearchProbe(tools), 'list_repositories');
  });

  await test('isMutationTool: identifies mutation tools correctly', async () => {
    assert.strictEqual(isMutationTool('create_issue'), true);
    assert.strictEqual(isMutationTool('delete_branch'), true);
    assert.strictEqual(isMutationTool('add_comment_to_pending_review'), true);
    assert.strictEqual(isMutationTool('update_pull_request'), true);
    assert.strictEqual(isMutationTool('get_me'), false);
    assert.strictEqual(isMutationTool('search_repositories'), false);
    assert.strictEqual(isMutationTool('list_issues'), false);
  });

  // ── 6. Tool result classification ─────────────────────────────────────────

  console.log('\n6. Tool result classification');

  await test('classifyToolResult: success on valid data', async () => {
    assert.strictEqual(
      classifyToolResult({ login: 'drake', id: 123 }, null),
      'success'
    );
  });

  await test('classifyToolResult: auth_failure on 401 response content', async () => {
    assert.strictEqual(
      classifyToolResult({ content: [{ text: 'HTTP 401: Bad credentials' }] }, null),
      'auth_failure'
    );
  });

  await test('classifyToolResult: auth_failure on "Unauthorized" in result', async () => {
    assert.strictEqual(
      classifyToolResult({ error: 'Unauthorized — check your token' }, null),
      'auth_failure'
    );
  });

  await test('classifyToolResult: auth_failure on 403 forbidden', async () => {
    assert.strictEqual(
      classifyToolResult({ message: '403 Forbidden' }, null),
      'auth_failure'
    );
  });

  await test('classifyToolResult: mcp_error when err is thrown', async () => {
    assert.strictEqual(
      classifyToolResult(null, new Error('ECONNREFUSED')),
      'mcp_error'
    );
  });

  await test('classifyToolResult: mcp_error takes priority over result content', async () => {
    // Even if result has auth-like text, a thrown error is always mcp_error
    assert.strictEqual(
      classifyToolResult({ message: '401' }, new Error('transport closed')),
      'mcp_error'
    );
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
