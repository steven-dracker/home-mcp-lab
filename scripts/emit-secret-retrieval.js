#!/usr/bin/env node
'use strict';

/**
 * Thin CLI wrapper — emit a secret.retrieval audit event.
 *
 * Called from get-github-pat.sh at each retrieval exit point.
 * Never exits non-zero — emission failure must not block PAT retrieval.
 *
 * Required args:
 *   --status <success|failure>
 *   --mechanism <keeper-commander|env-passthrough|gh-cli>
 *   --secret-id <non-sensitive identifier; never the secret value>
 *
 * Optional args:
 *   --mode <non-interactive|interactive>   (default: non-interactive)
 *   --env-context <service|cli>            (default: cli)
 *   --failure-reason <string>              (required when status=failure)
 *
 * Environment:
 *   EVENT_INGESTION_URL   — HTTP ingestion endpoint (used by transport)
 *   PROJECT_ID            — platform project ID (default: home-mcp-lab)
 *   AGENT_ID              — agent identifier (default: get-github-pat)
 *   CORRELATION_ID        — session correlation ID (optional; generated if absent)
 */

const path = require('path');
const { emitSecretRetrieval } = require(path.join(__dirname, '..', 'src', 'emitter', 'index.js'));

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--') && i + 1 < argv.length) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv);

const status = args['status'];
const mechanism = args['mechanism'];
const secretId = args['secret-id'];
const mode = args['mode'] || 'non-interactive';
const envContext = args['env-context'] || 'cli';
const failureReason = args['failure-reason'] || null;

if (!status || !mechanism || !secretId) {
  process.stderr.write('[emit-secret-retrieval] Missing required args: --status, --mechanism, --secret-id\n');
  process.exit(0);
}

const context = {
  projectId: process.env.PROJECT_ID || 'home-mcp-lab',
  agentId: process.env.AGENT_ID || 'get-github-pat',
  mcpServer: 'n/a',
  correlationId: process.env.CORRELATION_ID || null,
  secretIdentifier: secretId,
  retrievalMechanism: mechanism,
  retrievalMode: mode,
  environmentContext: envContext
};

const outcome = { status };
if (failureReason) {
  outcome.failureReason = failureReason;
}

emitSecretRetrieval(context, outcome);
// Node.js stays alive until pending HTTP I/O completes, then exits naturally.
