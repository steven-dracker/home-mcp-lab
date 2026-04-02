'use strict';

// Tool selection logic for safe validation probes.
//
// Provides deterministic, safety-first selection of representative tools
// from a GitHub MCP server tool list. Never selects mutation tools as probes.
//
// Exported:
//   selectIdentityProbe(tools)  — safe read-only identity tool
//   selectSearchProbe(tools)    — safe read-only search/list tool
//   classifyToolResult(result, err) — distinguish MCP error, auth failure, and success

// ── Preference lists ──────────────────────────────────────────────────────────

// Ordered preference for identity/auth probe.
// These are safe read-only, zero-or-few-required-arg tools on GitHub MCP server.
const IDENTITY_PROBE_PREFERENCE = [
  'get_me',
  'get_authenticated_user',
  'get_teams',
  'list_teams',
  'list_org_teams'
];

// Ordered preference for search/list probe.
const SEARCH_PROBE_PREFERENCE = [
  'search_repositories',
  'list_repositories',
  'list_repos',
  'search_code',
  'search_issues'
];

// ── Mutation denylist ─────────────────────────────────────────────────────────

// Patterns that indicate a tool mutates GitHub state.
// A tool whose name contains any of these terms is never selected as a probe.
const MUTATION_PATTERNS = [
  /^create_/,
  /^delete_/,
  /^update_/,
  /^merge_/,
  /^add_/,
  /^remove_/,
  /^edit_/,
  /^close_/,
  /^reopen_/,
  /^comment_/,
  /_comment/,
  /^review_/,
  /_review/,
  /^approve_/,
  /^submit_/,
  /^push_/,
  /^fork_/,
  /^star_/,
  /^unstar_/,
  /^assign_/,
  /^unassign_/,
  /^dismiss_/,
  /^enable_/,
  /^disable_/,
  /^rename_/,
  /^transfer_/,
  /^archive_/,
  /^lock_/,
  /^unlock_/,
  /^request_/,
  /^invite_/,
  /^publish_/,
  /^draft_/,
  /^tag_/,
  /^release_/,
  /^pin_/,
  /^unpin_/,
  /^mark_/,
  /^set_/,
  /^clear_/,
  /^trigger_/
];

function isMutationTool(toolName) {
  return MUTATION_PATTERNS.some(p => p.test(toolName));
}

function hasNoRequiredArgs(tool) {
  const required = tool.inputSchema && tool.inputSchema.required;
  return !required || required.length === 0;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Select a safe identity probe tool from the server's tool list.
 *
 * Preference order:
 *   1. First match from IDENTITY_PROBE_PREFERENCE (exact name, any arg shape)
 *   2. First zero-arg, non-mutation tool not already in SEARCH_PROBE_PREFERENCE
 *
 * Returns null if no safe tool can be identified — caller must handle explicitly.
 *
 * @param {Array<{name: string, inputSchema?: object}>} tools
 * @returns {string|null}
 */
function selectIdentityProbe(tools) {
  const names = new Set(tools.map(t => t.name));

  // Step 1: explicit preference list
  for (const preferred of IDENTITY_PROBE_PREFERENCE) {
    if (names.has(preferred)) return preferred;
  }

  // Step 2: any safe read-only zero-arg tool not in search preference list
  const searchSet = new Set(SEARCH_PROBE_PREFERENCE);
  const fallback = tools.find(t =>
    !isMutationTool(t.name) &&
    hasNoRequiredArgs(t) &&
    !searchSet.has(t.name)
  );

  return fallback ? fallback.name : null;
}

/**
 * Select a safe search/list probe tool from the server's tool list.
 *
 * Preference order:
 *   1. First match from SEARCH_PROBE_PREFERENCE (exact name)
 *   2. First non-mutation tool whose name starts with 'list_' or 'search_'
 *
 * Returns null if no safe tool can be identified.
 *
 * @param {Array<{name: string, inputSchema?: object}>} tools
 * @returns {string|null}
 */
function selectSearchProbe(tools) {
  const names = new Set(tools.map(t => t.name));

  // Step 1: explicit preference list
  for (const preferred of SEARCH_PROBE_PREFERENCE) {
    if (names.has(preferred)) return preferred;
  }

  // Step 2: any list_ or search_ tool that isn't a mutation
  const fallback = tools.find(t =>
    !isMutationTool(t.name) &&
    (t.name.startsWith('list_') || t.name.startsWith('search_'))
  );

  return fallback ? fallback.name : null;
}

/**
 * Classify a tool call result into one of three categories:
 *   'success'      — tool returned valid data
 *   'auth_failure' — GitHub API rejected the request (401/403/bad credentials)
 *   'mcp_error'    — transport or MCP protocol-level error (err was thrown)
 *
 * When callTool() throws, pass the error as `err`. When it returns normally,
 * pass the result as `result` and leave `err` null.
 *
 * @param {any} result   — return value from callTool (may be null if err is set)
 * @param {Error|null} err — caught error from callTool, or null on success
 * @returns {'success'|'auth_failure'|'mcp_error'}
 */
function classifyToolResult(result, err) {
  if (err) {
    return 'mcp_error';
  }

  const text = JSON.stringify(result || '');
  const lower = text.toLowerCase();

  if (
    lower.includes('401') ||
    lower.includes('bad credentials') ||
    lower.includes('unauthorized') ||
    lower.includes('403') ||
    lower.includes('forbidden') ||
    lower.includes('requires authentication')
  ) {
    return 'auth_failure';
  }

  return 'success';
}

module.exports = { selectIdentityProbe, selectSearchProbe, classifyToolResult, isMutationTool };
