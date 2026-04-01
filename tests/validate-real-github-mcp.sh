#!/usr/bin/env bash
# validate-real-github-mcp.sh
#
# Full validation of the real GitHub MCP transport on dude-mcp-01.
# Run on dude-mcp-01 after pulling the repo and running npm install.
#
# Prerequisites:
#   - Docker installed and running
#   - GITHUB_PERSONAL_ACCESS_TOKEN set in the calling shell environment
#   - Repo cloned/pulled at /home/drake/projects/home-mcp-lab
#   - npm install run in the repo root
#
# Usage:
#   cd /home/drake/projects/home-mcp-lab
#   GITHUB_PERSONAL_ACCESS_TOKEN=<pat> bash tests/validate-real-github-mcp.sh
#
# Optional: also validate event pipeline through ingestion server
#   GITHUB_PERSONAL_ACCESS_TOKEN=<pat> \
#   EVENT_INGESTION_URL=http://localhost:4318/events \
#   bash tests/validate-real-github-mcp.sh
#
# Output:
#   Validation log to stdout
#   MCP and emitter traces to stderr
#   Summary at end: PASS / FAIL per check

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

PASS=0
FAIL=0
RESULTS=()

pass() { PASS=$((PASS+1)); RESULTS+=("[PASS] $1"); echo "  [PASS] $1"; }
fail() { FAIL=$((FAIL+1)); RESULTS+=("[FAIL] $1"); echo "  [FAIL] $1"; }
section() { echo; echo "── $1 ──"; }

# ── 0. Pre-flight ─────────────────────────────────────────────────────────────

section "0. Pre-flight"

if [ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
  echo "ERROR: GITHUB_PERSONAL_ACCESS_TOKEN is not set."
  echo "Usage: GITHUB_PERSONAL_ACCESS_TOKEN=<pat> bash tests/validate-real-github-mcp.sh"
  exit 1
fi
echo "  GITHUB_PERSONAL_ACCESS_TOKEN: set (not logged)"

if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker not found. Install Docker and retry."
  exit 1
fi
if ! docker info &>/dev/null; then
  echo "ERROR: Docker daemon is not running."
  exit 1
fi
echo "  Docker: running"

if [ ! -f "package.json" ] || [ ! -d "node_modules/@modelcontextprotocol/sdk" ]; then
  echo "  Running npm install..."
  npm install
fi
echo "  Dependencies: ok"

# ── 1. Docker image pull ──────────────────────────────────────────────────────

section "1. Pull GitHub MCP server image"

if docker pull ghcr.io/github/github-mcp-server 2>&1 | tail -3; then
  pass "Docker image pulled: ghcr.io/github/github-mcp-server"
else
  fail "Docker image pull failed"
  echo "Cannot continue without the image." && exit 1
fi

# ── 2. Transport unit tests (no network) ─────────────────────────────────────

section "2. Unit validation (demo transport)"

if node tests/validate-mcp-transport.js 2>/dev/null | tail -3; then
  pass "validate-mcp-transport.js: all tests passed"
else
  fail "validate-mcp-transport.js: one or more tests failed"
fi

# ── 3. Tool discovery ─────────────────────────────────────────────────────────

section "3. Tool discovery (real GitHub MCP server)"

TOOLS_JSON=$(mktemp /tmp/mcp-tools-XXXXXXXX.json)

if node src/mcp-client/discover-tools.js --json 2>>"$REPO_ROOT/validate-mcp.stderr.log" > "$TOOLS_JSON"; then
  TOOL_COUNT=$(python3 -c "import json; print(len(json.load(open('$TOOLS_JSON'))))" 2>/dev/null || echo 0)
  pass "Tool discovery: ${TOOL_COUNT} tools returned"
  echo
  echo "  Tool list:"
  python3 -c "
import json
tools = json.load(open('$TOOLS_JSON'))
for t in sorted(tools, key=lambda x: x['name']):
    req = ', '.join(t.get('inputSchema',{}).get('required',[]) or [])
    print(f'    {t[\"name\"]:40s}  required: [{req}]')
"
  echo

  # Extract key tool names for use in subsequent steps
  GET_ME=$(python3 -c "
import json; tools=json.load(open('$TOOLS_JSON'))
candidates = [t['name'] for t in tools if 'me' in t['name'].lower() or 'user' in t['name'].lower() and 'authenticated' in t.get('description','').lower()]
print(candidates[0] if candidates else 'get_me')
" 2>/dev/null || echo "get_me")
  SEARCH=$(python3 -c "
import json; tools=json.load(open('$TOOLS_JSON'))
candidates = [t['name'] for t in tools if 'search' in t['name'].lower() and 'repo' in t['name'].lower()]
print(candidates[0] if candidates else 'search_repositories')
" 2>/dev/null || echo "search_repositories")
  echo "  Resolved tool names: me=${GET_ME}  search=${SEARCH}"
else
  fail "Tool discovery failed — check validate-mcp.stderr.log"
  GET_ME="get_me"
  SEARCH="search_repositories"
fi

# ── 4. Connection probe ───────────────────────────────────────────────────────

section "4. Connection probe (real GitHub MCP server)"

if node src/mcp-client/discover-tools.js --probe 2>>"$REPO_ROOT/validate-mcp.stderr.log" | head -20; then
  pass "Connection probe: successful"
else
  fail "Connection probe: failed — check validate-mcp.stderr.log"
fi

# ── 5. Instrumented session ───────────────────────────────────────────────────

section "5. Instrumented session (real transport, JSONL fallback)"

SESSION_LOG=$(mktemp /tmp/mcp-session-XXXXXXXX.log)

# Run the instrumented demo session with real transport
# Events go to JSONL fallback if EVENT_INGESTION_URL is not set
JSONL_BEFORE=0
if [ -f "audit-log/tool-invocations.jsonl" ]; then
  JSONL_BEFORE=$(wc -l < "audit-log/tool-invocations.jsonl")
fi

if TOOL_NAME_ME="$GET_ME" TOOL_NAME_SEARCH="$SEARCH" \
   node src/mcp-client/demo-github-session.js \
   > "$SESSION_LOG" 2>>"$REPO_ROOT/validate-mcp.stderr.log"; then
  pass "Instrumented session: completed without error"
else
  fail "Instrumented session: exited with error"
fi

cat "$SESSION_LOG"

# Count new events appended to JSONL
if [ -f "audit-log/tool-invocations.jsonl" ]; then
  JSONL_AFTER=$(wc -l < "audit-log/tool-invocations.jsonl")
  NEW_EVENTS=$((JSONL_AFTER - JSONL_BEFORE))
  if [ "$NEW_EVENTS" -ge 4 ]; then
    pass "Audit events: ${NEW_EVENTS} new events emitted (expected ≥4)"
  else
    fail "Audit events: only ${NEW_EVENTS} new events (expected ≥4: session.start + 2×tool.invocation + session.end)"
  fi
else
  fail "Audit events: audit-log/tool-invocations.jsonl not found"
fi

# ── 6. Session trace verification ────────────────────────────────────────────

section "6. Session trace verification"

if [ -f "audit-log/tool-invocations.jsonl" ] && [ "$NEW_EVENTS" -ge 1 ] 2>/dev/null; then
  # Extract correlation_id from the latest session.start event
  CORR_ID=$(tail -"${NEW_EVENTS}" audit-log/tool-invocations.jsonl | \
    python3 -c "
import sys, json
for line in sys.stdin:
    e = json.loads(line.strip())
    if e.get('event_type') == 'session.start':
        print(e['correlation_id'])
        break
" 2>/dev/null || echo "")

  if [ -n "$CORR_ID" ]; then
    pass "session.start event found: correlation_id=${CORR_ID}"

    # Count events with this correlation_id
    TRACE_COUNT=$(tail -"${NEW_EVENTS}" audit-log/tool-invocations.jsonl | \
      python3 -c "
import sys, json
n=0
for line in sys.stdin:
    e=json.loads(line.strip())
    if e.get('correlation_id') == '${CORR_ID}':
        n+=1
print(n)
" 2>/dev/null || echo 0)

    HAS_END=$(tail -"${NEW_EVENTS}" audit-log/tool-invocations.jsonl | \
      python3 -c "
import sys, json
for line in sys.stdin:
    e=json.loads(line.strip())
    if e.get('event_type') == 'session.end' and e.get('correlation_id') == '${CORR_ID}':
        print('yes')
        break
" 2>/dev/null || echo "no")

    HAS_TOOL=$(tail -"${NEW_EVENTS}" audit-log/tool-invocations.jsonl | \
      python3 -c "
import sys, json
for line in sys.stdin:
    e=json.loads(line.strip())
    if e.get('event_type') == 'tool.invocation' and e.get('correlation_id') == '${CORR_ID}':
        print('yes')
        break
" 2>/dev/null || echo "no")

    [ "$HAS_END" = "yes" ] && pass "session.end event found for correlation_id" || fail "session.end event missing"
    [ "$HAS_TOOL" = "yes" ] && pass "tool.invocation event found for correlation_id" || fail "tool.invocation event missing"
    echo "  Trace: ${TRACE_COUNT} events under correlation_id=${CORR_ID}"

    # Print the trace
    echo
    echo "  Event trace:"
    tail -"${NEW_EVENTS}" audit-log/tool-invocations.jsonl | \
      python3 -c "
import sys, json
for line in sys.stdin:
    e = json.loads(line.strip())
    if e.get('correlation_id') == '${CORR_ID}':
        print(f'    [{e[\"event_type\"]:20s}] action={e[\"action\"]:30s} status={e[\"status\"]}')
"
  else
    fail "Could not extract correlation_id from session.start event"
  fi
fi

# ── 7. Ingestion server pipeline (optional) ───────────────────────────────────

section "7. Ingestion server pipeline"

if [ -n "${EVENT_INGESTION_URL:-}" ]; then
  echo "  EVENT_INGESTION_URL=${EVENT_INGESTION_URL}"
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${EVENT_INGESTION_URL%/events}/events?limit=1" 2>/dev/null || echo "000")
  if [ "$HTTP_STATUS" = "200" ]; then
    pass "Ingestion server reachable at ${EVENT_INGESTION_URL}"
    # Re-run session with ingestion server active
    if TOOL_NAME_ME="$GET_ME" TOOL_NAME_SEARCH="$SEARCH" \
       EVENT_INGESTION_URL="$EVENT_INGESTION_URL" \
       node src/mcp-client/demo-github-session.js \
       2>>"$REPO_ROOT/validate-mcp.stderr.log" >/dev/null; then
      pass "Instrumented session with ingestion pipeline: completed"
      # Wait briefly for async delivery
      sleep 1
      COUNT=$(curl -s "${EVENT_INGESTION_URL%/events}/events?limit=10" | \
        python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('count',0))" 2>/dev/null || echo 0)
      pass "Events readable from ingestion server: count=${COUNT}"
    else
      fail "Instrumented session with ingestion pipeline: failed"
    fi
  else
    echo "  Ingestion server not reachable (HTTP ${HTTP_STATUS}) — skipping pipeline check"
    echo "  To include this check: start the ingestion server first:"
    echo "    PORT=4318 node src/ingestion/server.js &"
  fi
else
  echo "  EVENT_INGESTION_URL not set — skipping ingestion pipeline check"
  echo "  To include: EVENT_INGESTION_URL=http://localhost:4318/events bash $0"
fi

# ── 8. Schema conformity spot-check ──────────────────────────────────────────

section "8. Schema conformity spot-check"

if [ -f "audit-log/tool-invocations.jsonl" ] && [ "${NEW_EVENTS:-0}" -ge 1 ]; then
  INVALID=$(tail -"${NEW_EVENTS}" audit-log/tool-invocations.jsonl | \
    python3 -c "
import sys, json
required = ['schema_version','event_id','event_type','timestamp','platform',
            'project_id','agent_id','mcp_server','action','status','correlation_id','metadata']
invalid = 0
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    try:
        e = json.loads(line)
        for f in required:
            if f not in e:
                print(f'Missing field: {f} in event_id={e.get(\"event_id\",\"?\")}')
                invalid += 1
    except Exception as ex:
        print(f'Parse error: {ex}')
        invalid += 1
print(f'invalid_count={invalid}')
" 2>/dev/null || echo "invalid_count=check_failed")

  if echo "$INVALID" | grep -q "invalid_count=0"; then
    pass "Schema conformity: all ${NEW_EVENTS} new events have required fields"
  else
    fail "Schema conformity: one or more events missing required fields"
    echo "$INVALID"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo
echo "══════════════════════════════════════════"
echo "Validation Summary"
echo "══════════════════════════════════════════"
for r in "${RESULTS[@]}"; do echo "  $r"; done
echo
echo "  Passed: ${PASS}  Failed: ${FAIL}"
echo

# Cleanup
rm -f "$TOOLS_JSON" "$SESSION_LOG" 2>/dev/null

if [ "$FAIL" -gt 0 ]; then
  echo "  Full stderr log: ${REPO_ROOT}/validate-mcp.stderr.log"
  exit 1
fi
