'use strict';

/**
 * Demo — Session lifecycle instrumentation (CC-HMCP-000004C)
 *
 * Demonstrates:
 *   1. Successful session — session.start, multiple tool.invocation, session.end
 *   2. Failed session — session.start, tool failure, session.end (failure)
 *   3. All events share the same correlation_id within each session
 *
 * Run: node src/emitter/demo-session.js
 * Events are written to: audit-log/tool-invocations.jsonl
 */

const { withSession, withToolInstrumentation } = require('./index');
const { AUDIT_LOG_FILE } = require('./transport');
const fs = require('fs');

const BASE_CONTEXT = {
  projectId: 'home-mcp-lab',
  agentId: 'claude-code-demo',
  mcpServer: 'github-mcp-server',
  initiatingContext: 'CC-HMCP-000004C'
};

async function main() {
  console.log('--- CC-HMCP-000004C: Session Lifecycle Demo ---\n');

  // Record the start of the JSONL log so we can extract only this run's events.
  const linesBefore = countLines(AUDIT_LOG_FILE);

  // === Scenario 1: Successful multi-step session ===
  console.log('Scenario 1: Successful session with 3 tool calls');
  await withSession(BASE_CONTEXT, async (sessionCtx) => {
    await withToolInstrumentation(
      { ...sessionCtx, toolName: 'list_repositories' },
      async () => { await sleep(15); return ['home-mcp-lab', 'erate-workbench']; }
    );
    await withToolInstrumentation(
      { ...sessionCtx, toolName: 'get_file_contents' },
      async () => { await sleep(10); return 'README.md content (2.1KB)'; }
    );
    await withToolInstrumentation(
      { ...sessionCtx, toolName: 'create_issue' },
      async () => { await sleep(20); return { id: 42, title: 'Test issue' }; }
    );
  });
  console.log('   ✓ Session completed successfully\n');

  // === Scenario 2: Session containing a failing tool call ===
  console.log('Scenario 2: Session where a tool call fails mid-session');
  await withSession(BASE_CONTEXT, async (sessionCtx) => {
    // First tool succeeds
    await withToolInstrumentation(
      { ...sessionCtx, toolName: 'get_file_contents' },
      async () => { await sleep(10); return 'file content'; }
    );
    // Second tool fails — event is emitted, error is re-thrown, session continues
    try {
      await withToolInstrumentation(
        { ...sessionCtx, toolName: 'push_files' },
        async () => {
          await sleep(5);
          throw new Error('GitHub API: 422 Unprocessable Entity — branch is protected');
        }
      );
    } catch {
      // Session continues after tool failure — handled by caller
    }
    // Third tool proceeds after the failure
    await withToolInstrumentation(
      { ...sessionCtx, toolName: 'search_code' },
      async () => { await sleep(8); return '3 results'; }
    );
  });
  console.log('   ✓ Session ended (success) despite one tool failure\n');

  // === Scenario 3: Session-level failure (fn itself throws) ===
  console.log('Scenario 3: Session-level failure — session.end emits with status:failure');
  try {
    await withSession(BASE_CONTEXT, async (sessionCtx) => {
      await withToolInstrumentation(
        { ...sessionCtx, toolName: 'get_file_contents' },
        async () => { await sleep(5); return 'ok'; }
      );
      // Uncaught throw — propagates out of withSession
      throw new Error('Unrecoverable workflow state — aborting session');
    });
  } catch {
    console.log('   ✓ Session ended (failure); error propagated to caller\n');
  }

  // === Print full session traces ===
  console.log('--- Emitted Events (this run) ---\n');
  const allLines = fs.readFileSync(AUDIT_LOG_FILE, 'utf8').trim().split('\n');
  const thisRunLines = allLines.slice(linesBefore);

  const sessions = groupBySession(thisRunLines);

  for (const [correlationId, events] of Object.entries(sessions)) {
    console.log(`Session: ${correlationId}`);
    console.log(`  Events: ${events.length} (${events.map(e => e.event_type).join(' → ')})`);
    console.log();
    for (const event of events) {
      console.log(JSON.stringify(event, null, 2));
      console.log();
    }
    console.log('---\n');
  }

  console.log(`Audit log: ${AUDIT_LOG_FILE}`);
  console.log(`Sessions this run: ${Object.keys(sessions).length}`);
  console.log(`Total events this run: ${thisRunLines.length}`);
}

function groupBySession(lines) {
  const sessions = {};
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      const id = event.correlation_id || '__no_session__';
      if (!sessions[id]) sessions[id] = [];
      sessions[id].push(event);
    } catch {
      // skip malformed lines
    }
  }
  return sessions;
}

function countLines(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim().split('\n').length;
  } catch {
    return 0;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error('Demo failed:', err.message);
  process.exit(1);
});
