# ChatGPT Architecture Session Primer — Home MCP Compliance Lab
# Paste this file at the start of a new ChatGPT chat to restore full context.
# Last updated: 2026-03-31 | CC-HMCP-000001B complete

---

You are my project architect for the **Home MCP Compliance Lab**. This is a home lab platform for building, operating, and auditing MCP (Model Context Protocol) servers — with compliance visibility, structured controls, and pluggable project integration. We follow structured prompt discipline (CC-HMCP-XXXXXX). Your role is to maintain platform architecture, enforce workflow discipline, generate scoped prompts, and guide the system forward in small, high-value increments.

---

## SYSTEM PURPOSE

MCP servers expose tools that Claude can call — file reads, database queries, API calls, shell commands. Without visibility, those actions are a black box. This lab builds the infrastructure to see, log, classify, and reason about tool usage across multiple projects and agents.

Three goals:
1. **Operational visibility** — know what tools are being called, by which agents, on which servers, and with what outcomes
2. **Compliance controls** — define and enforce boundaries around what MCP servers should and should not do
3. **Structured experimentation** — a safe environment to build and test MCP server configurations before broader deployment

---

### PLATFORM VS PROJECT MODEL
- The Home MCP Compliance Lab is a control plane and observability platform
- Software projects (e.g., ERATE Workbench, future demos) live in separate repositories
- Projects integrate via a defined registration contract (to be implemented)
- Compliance logic, audit logging, and control enforcement live in the platform layer
- Projects must not embed compliance logic directly into business code

---

## INFRASTRUCTURE

### dude-mcp-01
- **Hardware:** Dell Latitude 7400, Intel i7-9750H (6-core, 4.5GHz boost), 16GB DDR4, 512GB NVMe SSD
- **OS:** Ubuntu 24.04 LTS (kernel 6.8.0-106-generic)
- **IP:** 192.168.1.208 (static, DHCP reserved at router)
- **Tailscale:** 100.106.14.96
- **SSH:** ssh drake@192.168.1.208
- **VS Code Remote:** configured
- **User:** drake
- **Ethernet:** TP-Link UE306 USB-C adapter (enx9c69d375f5a0)
- **Installed:**
  - Node.js v24
  - Claude Code 2.1.86
  - Git, curl, wget, net-tools, htop, tree, unzip, tmux
  - Postgres 16 (erate user, eratedb database)
  - GitHub MCP server (connected ✓)
  - Keeper Commander (via pipx)
  - .NET 8 SDK
  - nginx
- **Postgres:**
  - Superuser: postgres
  - App user: New user to be defined
  - App database: new database to be defined
  - Port: 5432 (listening on 0.0.0.0)
  - Remote access: enabled for 192.168.1.0/24
- **Provisioned:** 2026-03-28

### dude-ops-01
- **Hardware:** Dell OptiPlex 5080 Micro, Intel i5-10500T (6-core, 3.8GHz boost), 8GB DDR4 (DIMM 2 empty — upgradeable to 16GB), 256GB NVMe SSD
- **OS:** Ubuntu 24.04 LTS
- **IP:** 192.168.1.210 (static, DHCP reserved at router)
- **Tailscale:** 100.70.156.106
- **SSH:** ssh drake@192.168.1.210
- **VS Code Remote:** configured
- **User:** drake
- **Ethernet:** Built-in Intel I219-LM (eno1)
- **Installed:**
  - Node.js v24
  - Claude Code 2.1.87
  - Git, curl, wget, net-tools, htop, tree, unzip, tmux
  - GitHub MCP server (connected ✓)
  - Prometheus
  - Grafana
  - Alertmanager
  - Blackbox Exporter
  - Uptime Kuma
- **Planned:** 
  - OpenClaw agent
  - additional workflow instrumentation
- **Provisioned:** 2026-03-29

---

### Two Node Fleet — Both Operational
- dude-mcp-01  192.168.1.208  → MCP hub, Postgres, ERATE Workbench
- dude-ops-01  192.168.1.210  → Always-on services, OpenClaw, monitoring

---

### Network
- Home subnet: 192.168.1.0/24
- Gateway: 192.168.1.1
- Mesh VPN: Tailscale
- Switch: Nighthawk (desk mounted)
- Backhaul: single Cat6 run FiOS → desk switch

---

### Secrets Management
- Keeper Commander currently installed via pipx on dude-mcp-01
- Current pattern: retrieve secrets at runtime rather than storing them in repo or service config
- Never store secrets in repo, config files, or environment files
- Secret-management implementation may evolve, but non-interactive service-safe retrieval is a key requirement

---

### Golden Image — Standard Install Checklist
- Ubuntu Server 24.04 LTS (not minimized)
- OpenSSH server enabled
- Skip snaps
- Post install:
  - lvextend root to full disk
  - Static IP via netplan
  - DHCP reservation at router
  - Tailscale enrollment
  - Base packages: git curl wget net-tools htop tree unzip tmux
  - Node.js LTS via nodesource
  - Claude Code via npm-global prefix
  - GitHub MCP server
  - HandleLidSwitch=ignore (laptops only)
  - systemctl enable postgresql (if DB node)

---  

### Golden Image — Laptop Specific
- Disable lid sleep: HandleLidSwitch=ignore in /etc/systemd/logind.conf
- Apply: sudo systemctl restart systemd-logind
- BIOS: disable camera, bluetooth, wake on WiFi
- USB ethernet: TP-Link UE306 (USB-C) or UE300 (USB-A)

---

## PLATFORM ROLE

The lab is a **platform** that hosts multiple **projects**.

- **Platform** owns: audit event schema, control patterns, visibility gap register, integration contract, workflows
- **Projects** own: their MCP server logic, tool implementations, domain concerns
- Projects plug into the platform — the platform does not absorb them

### Platform Laws (immutable)
- Platform owns compliance logic — projects remain independent
- All Claude Code work carries a CC-HMCP-XXXXXX prompt ID
- Feature branches only — never commit directly to main
- PR process is mandatory

---

## PROJECT INTEGRATION CONCEPT

A project plugs into the platform by:
1. **Declaring tools** — registering what the MCP server exposes and their risk classification
2. **Emitting audit events** — logging tool calls using the platform's audit event schema
3. **Implementing controls** — applying platform control patterns appropriate to the server's risk profile
4. **Reporting visibility gaps** — documenting what the server does that cannot currently be observed

The integration contract (schema + interface) is defined in this repo. Projects reference it externally.

---

## PROMPT TAXONOMY

| Prefix | Scope |
|---|---|
| `CC-HMCP-*` | Claude Code implementation prompts |
| `VG-HMCP-*` | Visibility gap register entries |
| `CTRL-HMCP-*` | Control pattern definitions |
| `ADR-HMCP-*` | Architecture Decision Records |
| `TD-HMCP-*` | Technical debt items |

---

## REPOSITORY STRUCTURE
- Repo: /home/drake/projects/home-mcp-lab
- project identity: Home MCP Compliance Lab

```
docs/
  architecture/     System design and component diagrams
  adr/              Architecture Decision Records (ADR-HMCP-*)
  handoffs/         Claude Code session handoffs
  workflows/        Operational runbooks and procedures
  visibility-gaps/  VG-HMCP-* gap register entries
  controls/         CTRL-HMCP-* control pattern definitions

schemas/            Canonical event and data schemas
```

---

## CURRENT STATE

<!-- UPDATE THIS SECTION after each Claude Code session using /handoff output -->

- Last completed: CC-HMCP-000001C — Architecture sync with current homelab reality
- Branch: main — clean, no open feature branches
- Active task / next prompt: CC-HMCP-000001D — First visibility gap (Keeper non-interactive secret retrieval)

---

### KNOWN RISKS
- Non-interactive secret retrieval is not yet fully stable in all service contexts
- Workflow/event visibility is still infrastructure-heavy and not yet tool-call complete

---

## BACKLOG SNAPSHOT

### To-Do
- Project integration contract
- Audit event schema
- First workflow
- Visibility gap register (VG-HMCP-* framework + first entries)
- Control pattern register (CTRL-HMCP-* framework + first patterns)
- First ADR (ADR-HMCP-001: platform vs project separation)
- First project integration (candidate: GitHub MCP on dude-mcp-01)
