'use strict';

// Instrumented MCP session runner.
//
// Wires the platform emitter's withSession + withToolInstrumentation around
// an MCP transport connection. Emits:
//   session.start  — before transport connects
//   tool.invocation — for each callTool() call
//   session.end    — after transport closes (success or failure)
//
// Transport contract (implemented by DemoTransport and GitHubStdioTransport):
//   connect()              → Promise<void>   open connection
//   callTool(name, args)   → Promise<any>    invoke a named MCP tool
//   close()                → Promise<void>   tear down connection
//
// The transport is always closed in a finally block. If fn throws, session.end
// emits with status 'failure' and the original error is re-thrown (via withSession).

const { withSession, withToolInstrumentation } = require('../emitter/index');

/**
 * Run an instrumented MCP session.
 *
 * @param {object} transport — MCP transport instance (from createTransport)
 * @param {object} sessionContext — base context for session events:
 *   { projectId, agentId, mcpServer, initiatingContext? }
 * @param {function} fn — async function receiving { callTool, sessionCtx }
 *   callTool(toolName, toolArgs?) — wraps real MCP tool calls with emitter instrumentation
 *   sessionCtx                   — full context with correlationId populated
 * @returns {Promise<any>} — return value of fn
 */
async function runMcpSession(transport, sessionContext, fn) {
  return withSession(sessionContext, async (sessionCtx) => {
    await transport.connect();
    process.stderr.write(`[mcp-session] connected correlation_id=${sessionCtx.correlationId}\n`);

    const callTool = (toolName, toolArgs) => {
      return withToolInstrumentation(
        { ...sessionCtx, toolName },
        () => transport.callTool(toolName, toolArgs || {})
      );
    };

    try {
      return await fn({ callTool, sessionCtx });
    } finally {
      await transport.close();
      process.stderr.write(`[mcp-session] closed correlation_id=${sessionCtx.correlationId}\n`);
    }
  });
}

module.exports = { runMcpSession };
