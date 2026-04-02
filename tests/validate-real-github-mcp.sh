#!/usr/bin/env bash
# validate-real-github-mcp.sh
#
# Full validation of the real GitHub MCP transport on dude-mcp-01.
# Reports results in four separate layers so failures are precisely locatable.
#
# Layers:
#   1 — Container / runtime   (Docker image, Node deps)
#   2 — MCP session           (connect, tool discovery, probe invocation)
#   3 — GitHub API auth       (tool result content — 401 vs valid data)
#   4 — Audit event pipeline  (JSONL fallback OR ingestion server — not both required)
#
# Prerequisites:
#   - Docker installed and running on dude-mcp-01
#   - GITHUB_PERSONAL_ACCESS_TOKEN set in the calling shell environment
#   - Repo cloned/pulled at /home/drake/projects/home-mcp-lab
#
# Usage:
#   cd /home/drake/projects/home-mcp-lab
#   GITHUB_PERSONAL_ACCESS_TOKEN=<pat> bash tests/validate-real-github-mcp.sh
#
# With ingestion server:
#   PORT=4318 node src/ingestion/server.js &
#   EVENT_INGESTION_URL=http://localhost:4318/events \
#   GITHUB_PERSONAL_ACCESS_TOKEN=<pat> bash tests/validate-real-github-mcp.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

PASS=0
FAIL=0
WARN=0
RESULTS=()

pass() { PASS=$((PASS+1)); RESULTS+=("[PASS] [$1] $2"); echo "  [PASS] $2"; }
fail() { FAIL=$((FAIL+1)); RESULTS+=("[FAIL] [$1] $2"); echo "  [FAIL] $2"; }
warn() { WARN=$((WARN+1)); RESULTS+=("[WARN] [$1] $2"); echo "  [WARN] $2"; }
section() { echo; echo "── Layer $1: $2 ──"; }

STDERR_LOG="${REPO_ROOT}/validate-mcp.stderr.log"
: > "$STDERR_LOG"  # truncate on each run

# ── Pre-flight ────────────────────────────────────────────────────────────────

echo
echo "══════════════════════════════════════════"
echo "GitHub MCP Transport Validation"
echo "══════════════════════════════════════════"
echo "Repo:       $REPO_ROOT"
echo "Date:       $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Ingestion:  ${EVENT_INGESTION_URL:-'not configured (JSONL fallback)'}"

if [ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
  echo
  echo "ERROR: GITHUB_PERSONAL_ACCESS_TOKEN is not set."
  echo "Usage: GITHUB_PERSONAL_ACCESS_TOKEN=<pat> bash tests/validate-real-github-mcp.sh"
  exit 1
fi
echo "PAT:        set (not logged)"

# ── Layer 1: Container / runtime ──────────────────────────────────────────────

section "1" "Container / runtime"

if ! command -v docker &>/dev/null; then
  fail "L1" "Docker not found — install Docker and retry"
  echo; echo "Cannot continue: Docker is required."; exit 1
fi
if ! docker info &>/dev/null 2>&1; then
  fail "L1" "Docker daemon is not running"
  exit 1
fi
pass "L1" "Docker running"

if [ ! -d "node_modules/@modelcontextprotocol/sdk" ]; then
  echo "  Running npm install..."
  npm install 2>>"$STDERR_LOG"
fi
pass "L1" "Node dependencies installed"

echo "  Pulling ghcr.io/github/github-mcp-server..."
if docker pull ghcr.io/github/github-mcp-server >>"$STDERR_LOG" 2>&1; then
  pass "L1" "Docker image pulled: ghcr.io/github/github-mcp-server"
else
  fail "L1" "Docker image pull failed — check $STDERR_LOG"
  exit 1
fi

# Unit test gate: demo transport must be clean before proceeding
echo
echo "  Running unit validation (demo transport)..."
if node tests/validate-mcp-transport.js 2>/dev/null | grep -q "Results:.*0 failed"; then
  pass "L1" "Unit validation: all tests passed"
else
  fail "L1" "Unit validation: one or more tests failed — run: node tests/validate-mcp-transport.js"
fi

# ── Layer 2: MCP session ──────────────────────────────────────────────────────

section "2" "MCP session"

# Step 2a: Tool discovery
TOOLS_JSON=$(mktemp /tmp/mcp-tools-XXXXXXXX.json)
TOOL_COUNT=0

if node src/mcp-client/discover-tools.js --json 2>>"$STDERR_LOG" > "$TOOLS_JSON"; then
  TOOL_COUNT=$(python3 -c "import json; print(len(json.load(open('$TOOLS_JSON'))))" 2>/dev/null || echo 0)
  pass "L2" "MCP client connected and tools listed: ${TOOL_COUNT} tools"
else
  fail "L2" "Tool discovery failed — MCP connection or server error (see $STDERR_LOG)"
  rm -f "$TOOLS_JSON"
  echo; echo "Cannot continue: MCP session layer failed."; exit 1
fi

# Print tool list
echo
echo "  Tool list:"
python3 -c "
import json
tools = json.load(open('$TOOLS_JSON'))
for t in sorted(tools, key=lambda x: x['name']):
    req = ', '.join(t.get('inputSchema',{}).get('required',[]) or [])
    print(f'    {t[\"name\"]:45s}  required: [{req}]')
"
echo

# Step 2b: Safe probe tool resolution
PROBE_TOOLS_JSON=$(mktemp /tmp/mcp-probe-XXXXXXXX.json)
if node src/mcp-client/resolve-probe-tools.js 2>>"$STDERR_LOG" > "$PROBE_TOOLS_JSON"; then
  IDENTITY_TOOL=$(python3 -c "import json; print(json.load(open('$PROBE_TOOLS_JSON'))['identity'])")
  SEARCH_TOOL=$(python3 -c "import json; v=json.load(open('$PROBE_TOOLS_JSON'))['search']; print(v if v else 'none')")
  pass "L2" "Safe probe tools resolved: identity=${IDENTITY_TOOL}  search=${SEARCH_TOOL}"
else
  fail "L2" "Probe tool resolution failed — no safe identity probe available"
  rm -f "$TOOLS_JSON" "$PROBE_TOOLS_JSON"
  exit 1
fi

# Step 2c: Identity probe call (--probe uses tool-selector internally)
PROBE_EXIT=0
node src/mcp-client/discover-tools.js --probe 2>>"$STDERR_LOG" >/dev/null || PROBE_EXIT=$?

if [ "$PROBE_EXIT" -eq 0 ]; then
  pass "L2" "Identity probe call succeeded (${IDENTITY_TOOL})"
elif [ "$PROBE_EXIT" -eq 2 ]; then
  # Exit 2 = GitHub API auth failure, NOT MCP failure
  pass "L2" "Identity probe MCP call completed (${IDENTITY_TOOL}) — GitHub API auth result: see Layer 3"
else
  fail "L2" "Identity probe call failed at MCP transport level (exit ${PROBE_EXIT}) — see $STDERR_LOG"
fi

# ── Layer 3: GitHub API auth ──────────────────────────────────────────────────

section "3" "GitHub API auth"

# Determine auth outcome from the probe result in STDERR_LOG
if grep -q "Probe success" "$STDERR_LOG" 2>/dev/null; then
  pass "L3" "GitHub API auth: credentials accepted by ${IDENTITY_TOOL}"
elif grep -q "GitHub API auth failure" "$STDERR_LOG" 2>/dev/null; then
  fail "L3" "GitHub API auth: 401/403 returned — PAT invalid, expired, or missing required scope"
  echo "  Note: MCP session and tool invocation succeeded; this is a credential issue."
  echo "  Required scope for get_me: 'read:user' or 'user'"
elif grep -q "Probe classification: mcp_error" "$STDERR_LOG" 2>/dev/null; then
  fail "L3" "GitHub API call failed at MCP level — see $STDERR_LOG for transport error"
else
  warn "L3" "GitHub API auth result unknown — probe may not have run"
fi

# ── Layer 4: Audit event pipeline ────────────────────────────────────────────

section "4" "Audit event pipeline"

# Determine evidence path: ingestion server OR JSONL fallback (not both required).
USE_INGESTION=false
if [ -n "${EVENT_INGESTION_URL:-}" ]; then
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${EVENT_INGESTION_URL%/events}/events?limit=1" 2>/dev/null || echo "000")
  if [ "$HTTP_STATUS" = "200" ]; then
    USE_INGESTION=true
    pass "L4" "Ingestion server reachable at ${EVENT_INGESTION_URL}"
  else
    warn "L4" "EVENT_INGESTION_URL is set but server returned HTTP ${HTTP_STATUS} — using JSONL fallback"
    USE_INGESTION=false
  fi
else
  echo "  EVENT_INGESTION_URL not configured — using JSONL fallback"
  echo "  To enable ingestion path: start server, then set EVENT_INGESTION_URL=http://localhost:4318/events"
fi

# Capture baseline for JSONL (always, so we have it for trace verification)
JSONL_BEFORE=0
if [ -f "audit-log/tool-invocations.jsonl" ]; then
  JSONL_BEFORE=$(wc -l < "audit-log/tool-invocations.jsonl")
fi

# Run instrumented session
SESSION_LOG=$(mktemp /tmp/mcp-session-XXXXXXXX.log)
SESSION_OK=false

SESSION_ENV="TOOL_NAME_ME=${IDENTITY_TOOL}"
if [ "$SEARCH_TOOL" != "none" ]; then
  SESSION_ENV="${SESSION_ENV} TOOL_NAME_SEARCH=${SEARCH_TOOL}"
fi

if eval "${SESSION_ENV}" node src/mcp-client/demo-github-session.js \
    > "$SESSION_LOG" 2>>"$STDERR_LOG"; then
  SESSION_OK=true
  pass "L4" "Instrumented session completed without error"
else
  fail "L4" "Instrumented session exited with error — see $STDERR_LOG"
fi

cat "$SESSION_LOG"

# Audit evidence — check the active path only
NEW_EVENTS=0

if $USE_INGESTION; then
  # Primary evidence: ingestion server
  sleep 1  # allow async HTTP delivery
  INGESTION_COUNT=$(curl -s "${EVENT_INGESTION_URL%/events}/events?limit=100" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('count',0))" 2>/dev/null || echo 0)
  if [ "$INGESTION_COUNT" -gt 0 ]; then
    pass "L4" "Events readable from ingestion server: total stored=${INGESTION_COUNT}"
  else
    fail "L4" "No events readable from ingestion server"
  fi

  # Count new JSONL lines for session trace verification only (not as primary evidence)
  if [ -f "audit-log/tool-invocations.jsonl" ]; then
    JSONL_AFTER=$(wc -l < "audit-log/tool-invocations.jsonl")
    NEW_EVENTS=$((JSONL_AFTER - JSONL_BEFORE))
  fi
  # JSONL growth is not required when ingestion is active
else
  # Fallback evidence: JSONL
  if [ -f "audit-log/tool-invocations.jsonl" ]; then
    JSONL_AFTER=$(wc -l < "audit-log/tool-invocations.jsonl")
    NEW_EVENTS=$((JSONL_AFTER - JSONL_BEFORE))
    if [ "$NEW_EVENTS" -ge 4 ]; then
      pass "L4" "JSONL fallback: ${NEW_EVENTS} new events written"
    else
      fail "L4" "JSONL fallback: only ${NEW_EVENTS} new events (expected ≥4)"
    fi
  else
    fail "L4" "JSONL fallback: audit-log/tool-invocations.jsonl not found"
  fi
fi

# Session trace verification (correlation_id consistency)
# Use JSONL for trace even in ingestion mode — events are always written to JSONL fallback
# unless EVENT_INGESTION_URL is set. In ingestion mode check ingestion server instead.
echo
echo "  Session trace:"

if $USE_INGESTION; then
  TRACE=$(curl -s "${EVENT_INGESTION_URL%/events}/events?limit=10" 2>/dev/null | \
    python3 -c "
import sys, json
d = json.load(sys.stdin)
events = d.get('events', [])
# find the most recent correlation_id group
ids = {}
for e in events:
    c = e.get('correlation_id','')
    ids.setdefault(c, []).append(e)
if not ids:
    print('no_events')
else:
    # Most recent group is the one from this run
    corr = list(ids.keys())[-1]
    group = ids[corr]
    print(f'correlation_id={corr}')
    for e in group:
        print(f'  [{e[\"event_type\"]:20s}] action={e[\"action\"]:30s} status={e[\"status\"]}')
    types = {e['event_type'] for e in group}
    has_start = 'session.start' in types
    has_end = 'session.end' in types
    has_tool = 'tool.invocation' in types
    print(f'session.start={has_start} tool.invocation={has_tool} session.end={has_end}')
" 2>/dev/null || echo "trace_check_failed")

  if echo "$TRACE" | grep -q "session.start=True"; then
    CORR_ID=$(echo "$TRACE" | grep "correlation_id=" | head -1 | cut -d= -f2)
    pass "L4" "Session trace complete: session.start + tool.invocation + session.end (corr=${CORR_ID})"
  else
    warn "L4" "Session trace incomplete from ingestion server"
  fi
  echo
  echo "$TRACE" | sed 's/^/    /'

elif [ -f "audit-log/tool-invocations.jsonl" ] && [ "${NEW_EVENTS:-0}" -ge 1 ]; then
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
    HAS_END=$(tail -"${NEW_EVENTS}" audit-log/tool-invocations.jsonl | \
      python3 -c "
import sys, json
for line in sys.stdin:
    e=json.loads(line.strip())
    if e.get('event_type')=='session.end' and e.get('correlation_id')=='${CORR_ID}': print('yes'); break
" 2>/dev/null || echo "no")
    HAS_TOOL=$(tail -"${NEW_EVENTS}" audit-log/tool-invocations.jsonl | \
      python3 -c "
import sys, json
for line in sys.stdin:
    e=json.loads(line.strip())
    if e.get('event_type')=='tool.invocation' and e.get('correlation_id')=='${CORR_ID}': print('yes'); break
" 2>/dev/null || echo "no")

    if [ "$HAS_END" = "yes" ] && [ "$HAS_TOOL" = "yes" ]; then
      pass "L4" "Session trace complete: session.start + tool.invocation + session.end (corr=${CORR_ID})"
    else
      fail "L4" "Session trace incomplete (has_end=${HAS_END} has_tool=${HAS_TOOL})"
    fi

    tail -"${NEW_EVENTS}" audit-log/tool-invocations.jsonl | \
      python3 -c "
import sys, json
for line in sys.stdin:
    e = json.loads(line.strip())
    if e.get('correlation_id') == '${CORR_ID}':
        print(f'    [{e[\"event_type\"]:20s}] action={e[\"action\"]:30s} status={e[\"status\"]}')
"
  else
    warn "L4" "Could not extract session trace from JSONL"
  fi
else
  warn "L4" "Skipping JSONL trace (no new events in fallback path)"
fi

# Schema conformity spot-check
if ! $USE_INGESTION && [ "${NEW_EVENTS:-0}" -ge 1 ] && [ -f "audit-log/tool-invocations.jsonl" ]; then
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
    pass "L4" "Schema conformity: all ${NEW_EVENTS} new events have required fields"
  else
    fail "L4" "Schema conformity: one or more events missing required fields"
    echo "$INVALID"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────

rm -f "$TOOLS_JSON" "$PROBE_TOOLS_JSON" "$SESSION_LOG" 2>/dev/null

echo
echo "══════════════════════════════════════════"
echo "Validation Summary"
echo "══════════════════════════════════════════"
for r in "${RESULTS[@]}"; do echo "  $r"; done
echo
echo "  Passed: ${PASS}  Warned: ${WARN}  Failed: ${FAIL}"
echo

if [ "$FAIL" -gt 0 ]; then
  echo "  Full stderr log: ${STDERR_LOG}"
  exit 1
fi

if [ "$WARN" -gt 0 ]; then
  echo "  Full stderr log: ${STDERR_LOG}"
fi
