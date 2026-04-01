'use strict';

/**
 * Demo — Model C tool.invocation event emission (CC-HMCP-000004B)
 *
 * Demonstrates:
 *   1. Successful tool call → success event emitted
 *   2. Failed tool call → failure event emitted
 *   3. Emission failure → failure observer records it; tool call is unaffected
 *
 * Run: node src/emitter/demo.js
 * Events are written to: audit-log/tool-invocations.jsonl
 */

const { withToolInstrumentation, emitToolInvocation } = require('./index');
const { AUDIT_LOG_FILE } = require('./transport');
const fs = require('fs');

const SESSION_CONTEXT = {
  projectId: 'home-mcp-lab',
  agentId: 'claude-code-demo',
  mcpServer: 'github-mcp-server',
  correlationId: 'sess-20260401-cc-hmcp-000004b',
  initiatingContext: 'CC-HMCP-000004B'
};

async function main() {
  console.log('--- CC-HMCP-000004B: Model C Emitter Demo ---\n');

  // 1. Successful tool call
  console.log('1. Simulating successful tool call: get_file_contents');
  await withToolInstrumentation(
    { ...SESSION_CONTEXT, toolName: 'get_file_contents' },
    async () => {
      await sleep(25); // simulate MCP server latency
      return 'File contents: README.md (1.2KB)';
    }
  );
  console.log('   ✓ Success event emitted\n');

  // 2. Failed tool call — MCP server error
  console.log('2. Simulating failed tool call: create_issue (permission denied)');
  try {
    await withToolInstrumentation(
      { ...SESSION_CONTEXT, toolName: 'create_issue' },
      async () => {
        await sleep(10);
        throw new Error('GitHub API: 403 Forbidden — insufficient scopes');
      }
    );
  } catch {
    // Caller receives the error; the event was emitted before re-throw
    console.log('   ✓ Failure event emitted; error propagated to caller\n');
  }

  // 3. Timeout mapped to failure semantics
  console.log('3. Simulating timed-out tool call: search_code');
  try {
    await withToolInstrumentation(
      { ...SESSION_CONTEXT, toolName: 'search_code' },
      async () => {
        await sleep(5);
        const err = new Error('Request timed out after 30000ms');
        err.code = 'ETIMEDOUT';
        throw err;
      }
    );
  } catch {
    console.log('   ✓ Timeout mapped to failure event; error propagated to caller\n');
  }

  // 4. Direct emit — for cases where the caller constructs outcome explicitly
  console.log('4. Direct emit: list_repositories (success, no wrapper)');
  emitToolInvocation(
    { ...SESSION_CONTEXT, toolName: 'list_repositories' },
    {
      status: 'success',
      executionDurationMs: 42,
      resultSummary: 'Returned 7 repositories'
    }
  );
  console.log('   ✓ Event emitted directly\n');

  // Print emitted events
  console.log('--- Emitted Events ---\n');
  const lines = fs.readFileSync(AUDIT_LOG_FILE, 'utf8').trim().split('\n');
  const demoLines = lines.filter(l => {
    try {
      return JSON.parse(l).correlation_id === SESSION_CONTEXT.correlationId;
    } catch {
      return false;
    }
  });

  demoLines.forEach((line, i) => {
    const event = JSON.parse(line);
    console.log(`Event ${i + 1}:`);
    console.log(JSON.stringify(event, null, 2));
    console.log();
  });

  console.log(`Audit log: ${AUDIT_LOG_FILE}`);
  console.log(`Total events this session: ${demoLines.length}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error('Demo failed:', err.message);
  process.exit(1);
});
