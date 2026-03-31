# Secrets Policy

*Status: current state as of 2026-03-31*

---

## Principles

Secrets — passwords, tokens, API keys, connection strings, and any credential material — must never be persisted in static, readable form in locations accessible to the version control system, shared config files, or service unit definitions.

The guiding principle is: **secrets are retrieved at runtime, not stored at rest in project artifacts.**

---

## Prohibited Storage Locations

The following locations are explicitly prohibited for storing secret material:

| Location | Prohibited | Reason |
|---|---|---|
| Git repository (any file) | **Yes** | Permanent history; risk of exposure on push or clone |
| `.env` files | **Yes** | Commonly committed by accident; not access-controlled |
| `docker-compose.yml` / `docker-compose.override.yml` | **Yes** | Often committed; secrets become part of image environment |
| systemd unit files (`/etc/systemd/system/*.service`) | **Yes** | World-readable by default on Linux; not suitable for credentials |
| Application config files (`appsettings.json`, `config.yaml`, etc.) | **Yes** | Committed to repo; checked into version control |
| Shell profile files (`.bashrc`, `.profile`, `.zshrc`) | **Yes** | Persistent in user environment; risk of logging or leakage |
| Log files | **Yes** | Logs are often forwarded, stored, and inspected by multiple parties |

---

## Runtime Retrieval Pattern

Secrets are retrieved at the moment of use, not pre-loaded into the environment. The pattern:

1. At startup or invocation time, the process requests the secret from the secrets store
2. The secret is held in memory for the duration of the operation
3. The secret is not written to disk, logged, or passed to child processes beyond what is strictly necessary

This pattern limits the window of exposure and prevents secrets from appearing in persistent storage.

---

## Current Implementation: Keeper Commander

**Keeper Commander** is the current secrets retrieval tool in use on dude-mcp-01.

- CLI-based credential retrieval from the Keeper vault
- Used interactively in scripts (e.g., validation scripts that prompt for or retrieve DB credentials at runtime)
- Not embedded in service definitions or config files

**Current limitation:** Keeper Commander works well in interactive terminal sessions. There is a known stability issue with non-interactive retrieval in systemd service contexts. This means some services that require credentials at startup (e.g., postgres_exporter) cannot currently retrieve secrets via Keeper Commander in an automated way without additional mechanism design.

This issue is acknowledged but not fully resolved. Full analysis and remediation are deferred to a future task. Any service that currently works around this issue by storing credentials in a static location is out of compliance with this policy and should be flagged as a visibility gap.

---

## Scope

This policy applies to:

- All nodes in the home lab fleet (dude-mcp-01, dude-ops-01, and any future nodes)
- All services running on those nodes
- All scripts and automation that operate against those services
- All project workloads deployed onto the platform

---

## What This Policy Does Not Cover (Yet)

- Secret rotation schedule or expiration policy
- Access control model for the Keeper vault (who can retrieve which secrets)
- Audit trail for secret retrievals
- Alternative retrieval mechanisms for non-interactive service contexts (e.g., systemd credential stores, HashiCorp Vault, or equivalent)

These are future concerns. This document reflects current state and intent, not a fully realized secrets management system.

---

## Future Improvements

The current model is intentionally simple: use Keeper Commander; don't persist secrets. As the lab matures, improvements to consider include:

- A secrets retrieval mechanism compatible with systemd service startup (resolving the known non-interactive gap)
- An audit trail showing which secrets were retrieved, when, and by which process
- Rotation and expiration controls

Any changes to the secrets retrieval mechanism should be treated as an architectural decision and documented as an ADR.
