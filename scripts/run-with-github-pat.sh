#!/usr/bin/env bash
# Injects a GitHub PAT into the process environment and runs the given command.
#
# Retrieves the PAT non-interactively via get-github-pat.sh, then execs the
# target command with GITHUB_PERSONAL_ACCESS_TOKEN and GITHUB_TOKEN set.
# The PAT value is never printed to stdout or stderr.
#
# Usage:
#   scripts/run-with-github-pat.sh <command> [args...]
#
# Examples:
#   scripts/run-with-github-pat.sh node src/mcp-client/discover-tools.js --probe
#   scripts/run-with-github-pat.sh bash tests/validate-real-github-mcp.sh
#   KEEPER_GITHUB_PAT_UID=abc123 scripts/run-with-github-pat.sh node src/mcp-client/demo-github-session.js
#
# Environment variables forwarded to get-github-pat.sh:
#   KEEPER_GITHUB_PAT_UID  — Keeper record UID for the GitHub PAT
#   KEEPER_CONFIG_FILE     — override path to Keeper config
#   GITHUB_PERSONAL_ACCESS_TOKEN — if already set, passed through without Keeper call
#
# Exit codes:
#   1  — no command provided, or PAT retrieval failed
#   *  — exit code of the wrapped command

set -euo pipefail

SCRIPT="run-with-github-pat"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -eq 0 ]]; then
  echo "[$SCRIPT] ERROR: No command provided" >&2
  echo "Usage: $0 <command> [args...]" >&2
  exit 1
fi

# Retrieve PAT from the priority chain (pass-through → Keeper → gh CLI).
# The helper prints only the PAT value to stdout; diagnostics go to stderr.
PAT=$("$SCRIPT_DIR/get-github-pat.sh") || {
  echo "[$SCRIPT] PAT retrieval failed — cannot proceed" >&2
  exit 1
}

echo "[$SCRIPT] PAT retrieved (source logged by get-github-pat.sh)" >&2

# Inject PAT into environment and exec the target command.
# Using exec so the wrapper process is replaced — no extra layer in the process tree.
exec env GITHUB_PERSONAL_ACCESS_TOKEN="$PAT" GITHUB_TOKEN="$PAT" "$@"
