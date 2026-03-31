## BOOT BLOCK
— # Last updated: 2026-03-31 | Boot Block: CC-HMCP-000001B


### PROJECT IDENTITY
- App: **Home MCP Compliance Lab** — home lab platform for building, operating, and auditing MCP servers with compliance visibility and structured controls
- Repo: home-mcp-lab
- Prompt schema: CC-HMCP-XXXXXX (tracks all Claude Code work for traceability)

### MISSION
Provide operational visibility, compliance controls, and structured experimentation infrastructure for MCP server deployments in the home lab fleet.

### PLATFORM LAWS (immutable — do not violate without explicit architect approval)
- The platform owns compliance logic — audit schemas, control patterns, visibility gap register
- Projects remain independent — the platform wraps them, it does not absorb them
- All Claude Code work carries a CC-HMCP-XXXXXX prompt ID for traceability
- Feature branches only — never commit directly to main
- PR process mandatory: branch → commit → PR → merge → delete branch → sync main

### PROMPT TAXONOMY
| Prefix | Scope |
|---|---|
| `CC-HMCP-*` | Claude Code implementation prompts |
| `VG-HMCP-*` | Visibility gap register entries |
| `CTRL-HMCP-*` | Control pattern definitions |
| `ADR-HMCP-*` | Architecture Decision Records |
| `TD-HMCP-*` | Technical debt items |

### INFRASTRUCTURE
- **dude-mcp-01** — 192.168.1.208 — MCP hub, Postgres 16, primary MCP server host
- **dude-ops-01** — 192.168.1.210 — Always-on services, monitoring, agents
- Tailscale mesh VPN for remote access
- Home subnet: 192.168.1.0/24

### CURRENT STATE (as of CC-HMCP-000001B)
- **Last completed:** CC-HMCP-000001B — Operating model, conventions, and platform definition
- **Branch:** main
- **Active task / next prompt:** CC-HMCP-000001C (TBD — architect to define)

### ACTIVE TASK
- CC-HMCP-000001C — TBD

### KNOWN DEBT
- None yet
