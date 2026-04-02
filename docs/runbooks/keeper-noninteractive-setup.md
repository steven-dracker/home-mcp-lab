# Runbook — Non-Interactive GitHub PAT Retrieval via Keeper Commander

**Related prompt:** CC-HMCP-000006A  
**Target host:** dude-mcp-01 (192.168.1.208)  
**Applies to:** `scripts/get-github-pat.sh`, `scripts/run-with-github-pat.sh`

---

## Purpose

This runbook enables the platform's GitHub MCP execution flow to retrieve the GitHub PAT
at runtime without interactive input. It must be completed once per host per Keeper session.
After setup, all platform scripts that call `run-with-github-pat.sh` will retrieve the PAT
automatically without human intervention.

---

## Prerequisites

All must be true on the target host before this runbook is executed:

- Keeper Commander installed: `keeper version` returns without error
  - Standard install: `pipx install keepercommander`
  - Verify PATH: `which keeper` — if not found, add `~/.local/bin` to PATH
- Keeper account with the GitHub PAT stored as a record
- The PAT record UID is known (see "Finding the UID" below)
- Python 3 is available: `python3 --version`
- The target record's password field contains the raw PAT value (not a field label)

---

## Step 1 — Interactive Login (one-time per host)

Log in interactively to save the device-authorised session to `~/.keeper/config.json`:

```sh
keeper login
```

Keeper will prompt for your master password and may require device approval.
After login, the session token is saved in `~/.keeper/config.json`. Subsequent
`keeper get` calls do not require interactive input until the session expires.

**Session expiry:** Keeper sessions can expire (typically after inactivity). If retrieval
starts failing, re-run `keeper login` to refresh. This is a known limitation
documented in VG-HMCP-000001.

---

## Step 2 — Find the GitHub PAT Record UID

List all records to locate the GitHub PAT record:

```sh
keeper list
```

Or search by title:

```sh
keeper search "github"
```

Note the UID (a 22-character alphanumeric string) for the record containing the PAT.

---

## Step 3 — Verify Non-Interactive Retrieval

Test that the record can be retrieved without input:

```sh
KEEPER_GITHUB_PAT_UID=<uid> scripts/get-github-pat.sh > /dev/null && echo "OK"
```

Expected output: `OK` and a note on stderr that the Keeper path succeeded.

If this fails:
- Run `keeper login` again to refresh the session
- Confirm the UID is correct: `keeper get --uid <uid>` (human-readable)
- Confirm the record has a `password` or `token` type field (not just a note)

---

## Step 4 — Configure for Service Use

Set `KEEPER_GITHUB_PAT_UID` in the service or shell profile so it is available without
manual export before each run.

**For interactive shell use (development):**

```sh
# Add to ~/.bashrc or ~/.profile on dude-mcp-01
export KEEPER_GITHUB_PAT_UID=<uid>
```

**For systemd service use:**

In the systemd unit file's `[Service]` section:

```ini
[Service]
Environment=KEEPER_GITHUB_PAT_UID=<uid>
ExecStart=/path/to/scripts/run-with-github-pat.sh node src/mcp-client/demo-github-session.js
```

Note: The UID is not a secret. It is a record identifier, not the credential itself.
Storing the UID in service config or shell profiles is safe.

---

## Step 5 — Run Validation with the Injection Wrapper

Confirm the full path: Keeper retrieval → PAT injection → MCP probe:

```sh
KEEPER_GITHUB_PAT_UID=<uid> \
GITHUB_MCP_COMMAND=docker \
scripts/run-with-github-pat.sh \
  node src/mcp-client/discover-tools.js --probe
```

Expected:
- `[get-github-pat]` shows Keeper path used (not gh CLI fallback)
- `[discover] Connected`
- Tools listed
- If `--probe` is appended: `[discover] Probe success` (not auth_failure)

---

## Fallback Paths

The retrieval script supports three paths in priority order:

| Priority | Path | Context |
|---|---|---|
| 1 | `GITHUB_PERSONAL_ACCESS_TOKEN` already set | CI pipelines, direct injection |
| 2 | Keeper Commander (`KEEPER_GITHUB_PAT_UID` set, `keeper` in PATH) | Production services on dude-mcp-01 |
| 3 | `gh auth token` | Local development only |

For unattended service execution, only paths 1 and 2 are service-safe.
Path 3 (gh CLI) requires a logged-in user session and is not reliable in systemd contexts.

---

## Known Limitations

- Keeper session tokens can expire, requiring periodic interactive re-authentication
  (documented in VG-HMCP-000001 — Keeper non-interactive retrieval stability is an open gap)
- No `secret.retrieval` audit event is emitted by these scripts (residual VG-HMCP-000003 gap)
- The `keeper` binary must be on PATH in the execution environment;
  pipx installs to `~/.local/bin`, which may not be in systemd service PATH
  (workaround: use `ExecStart=` with absolute path, or add `~/.local/bin` to `Environment=PATH=`)

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `keeper: command not found` | PATH missing `~/.local/bin` | Add to PATH or use absolute path |
| `Keeper retrieval failed (exit 1)` | Session expired | `keeper login` |
| `No token field found in record` | Record type/field not recognised | Check record; ensure password field is `type=password` or `type=token` |
| `No GitHub PAT available via any configured path` | Neither Keeper nor gh configured | Set `KEEPER_GITHUB_PAT_UID` or run `gh auth login` |
| PAT retrieved via gh CLI in production | `KEEPER_GITHUB_PAT_UID` not set | Set the env var; see Step 3 |
