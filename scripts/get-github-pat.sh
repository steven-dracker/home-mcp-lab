#!/usr/bin/env bash
# Retrieves the GitHub Personal Access Token non-interactively.
#
# Priority order:
#   1. GITHUB_PERSONAL_ACCESS_TOKEN already set in environment (pass-through)
#   2. Keeper Commander  (requires: KEEPER_GITHUB_PAT_UID set, keeper in PATH,
#      a device-authorised session saved in the Keeper config file)
#   3. gh CLI            (requires: gh auth login already run — dev/CI contexts only)
#
# On success : prints the PAT to stdout (no trailing newline), exits 0.
# On failure : prints diagnostic to stderr, exits 1.
# Never prints the PAT value to stderr or any log stream.
#
# Environment variables:
#   KEEPER_GITHUB_PAT_UID  — UID of the Keeper record that holds the GitHub PAT
#                            (required to activate the Keeper path)
#   KEEPER_CONFIG_FILE     — override path to Keeper config JSON
#                            (default: ~/.keeper/config.json)
#   GITHUB_PERSONAL_ACCESS_TOKEN — if already set, returned immediately (pass-through)
#
# Exit codes:
#   0  — PAT obtained
#   1  — PAT not available via any path; diagnostic on stderr
#   2  — Keeper path attempted but failed; gh fallback also unavailable

set -euo pipefail

SCRIPT="get-github-pat"

# ── 1. Pass-through: already in environment ──────────────────────────────────

if [[ -n "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]]; then
  printf '%s' "$GITHUB_PERSONAL_ACCESS_TOKEN"
  exit 0
fi

# ── 2. Keeper Commander ───────────────────────────────────────────────────────

if [[ -n "${KEEPER_GITHUB_PAT_UID:-}" ]]; then
  if ! command -v keeper &>/dev/null; then
    echo "[$SCRIPT] KEEPER_GITHUB_PAT_UID is set but 'keeper' is not in PATH" >&2
    echo "[$SCRIPT] Expected Keeper Commander via pipx — check PATH or pipx install" >&2
    # Fall through to gh CLI
  else
    # Build keeper command — include config override if provided
    KEEPER_ARGS=()
    if [[ -n "${KEEPER_CONFIG_FILE:-}" ]]; then
      KEEPER_ARGS+=("--config" "$KEEPER_CONFIG_FILE")
    fi

    # Attempt non-interactive retrieval
    KEEPER_JSON=""
    KEEPER_EXIT=0
    KEEPER_JSON=$(keeper "${KEEPER_ARGS[@]}" get --uid "$KEEPER_GITHUB_PAT_UID" \
      --format json 2>/dev/null) || KEEPER_EXIT=$?

    if [[ $KEEPER_EXIT -ne 0 ]] || [[ -z "$KEEPER_JSON" ]]; then
      echo "[$SCRIPT] Keeper retrieval failed for UID=$KEEPER_GITHUB_PAT_UID (exit $KEEPER_EXIT)" >&2
      echo "[$SCRIPT] Possible causes: session not saved, auth token expired, record not found" >&2
      echo "[$SCRIPT] Run 'keeper login' interactively on dude-mcp-01 to refresh the saved session" >&2
      # Fall through to gh CLI
    else
      # Parse the PAT from the Keeper record JSON.
      # Handles both classic Keeper field format (fields[].type/value[])
      # and custom field format (custom_fields[].label/value[]).
      PAT=$(python3 - "$KEEPER_GITHUB_PAT_UID" <<'PYEOF'
import sys, json

uid = sys.argv[1] if len(sys.argv) > 1 else "(unknown)"

try:
    data = json.load(sys.stdin)
except Exception as e:
    print(f"[get-github-pat] JSON parse error from Keeper: {e}", file=sys.stderr)
    sys.exit(1)

def first_nonempty(vals):
    return next((v for v in (vals or []) if v), None)

# Standard fields: look for type=password first, then any field whose label/type
# suggests a PAT (token, pat, access_token, api_key).
TOKEN_TYPES = {"password", "token", "pat", "access_token", "api_key", "secret"}
TOKEN_LABELS = {"github pat", "pat", "token", "access_token", "github token", "api key"}

for field in data.get("fields", []):
    if field.get("type", "").lower() in TOKEN_TYPES:
        val = first_nonempty(field.get("value", []))
        if val:
            print(val, end="")
            sys.exit(0)

for field in data.get("custom_fields", []):
    label = field.get("label", "").lower()
    ftype = field.get("type", "").lower()
    if label in TOKEN_LABELS or ftype in TOKEN_TYPES:
        val = first_nonempty(field.get("value", []))
        if val:
            print(val, end="")
            sys.exit(0)

print(f"[get-github-pat] No token field found in Keeper record uid={uid}", file=sys.stderr)
sys.exit(1)
PYEOF
) || true

      if [[ -n "$PAT" ]]; then
        printf '%s' "$PAT"
        exit 0
      fi

      echo "[$SCRIPT] Keeper record found but no PAT field extracted — check record UID and field type" >&2
    fi
  fi
fi

# ── 3. gh CLI fallback (dev/CI — not service-safe in all systemd contexts) ───

if command -v gh &>/dev/null; then
  PAT=$(gh auth token 2>/dev/null) || true
  if [[ -n "$PAT" ]]; then
    echo "[$SCRIPT] Using gh CLI token (not Keeper — ensure this is intentional)" >&2
    printf '%s' "$PAT"
    exit 0
  fi
fi

# ── No path succeeded ─────────────────────────────────────────────────────────

cat >&2 <<EOF
[$SCRIPT] ERROR: No GitHub PAT available via any configured path.

To fix:
  Option A — Keeper (preferred for services):
    1. Run 'keeper login' interactively on the target host to save the device session
    2. Set KEEPER_GITHUB_PAT_UID to the UID of the record containing the GitHub PAT
    3. Re-run this script

  Option B — gh CLI (dev/CI only):
    1. Run 'gh auth login' to authenticate
    2. Re-run this script (no env vars required)

  Option C — direct injection (CI pipelines):
    1. Set GITHUB_PERSONAL_ACCESS_TOKEN in the environment before calling this script
EOF
exit 1
