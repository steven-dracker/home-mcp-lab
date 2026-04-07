## BOOT BLOCK
— # Last updated: 2026-03-31 | Boot Block: CC-HMCP-000001D


### PROJECT IDENTITY
- App: **Home MCP Compliance Lab** — home lab platform for building, operating, and auditing MCP servers with compliance visibility and structured controls
- Repo: home-mcp-lab
- Prompt schema: CC-HMCP-XXXXXX (tracks all Claude Code work for traceability)


## SYSTEM PURPOSE

MCP servers expose tools that Claude can call — file reads, database queries, API calls, shell commands. Without visibility, those actions are a black box. This lab builds the infrastructure to see, log, classify, and reason about tool usage across multiple projects and agents.

Three goals:
1. **Operational visibility** — know what tools are being called, by which agents, on which servers, and with what outcomes
2. **Compliance controls** — define and enforce boundaries around what MCP servers should and should not do
3. **Structured experimentation** — a safe environment to build and test MCP server configurations before broader deployment

### PLATFORM VS PROJECT MODEL
- The Home MCP Compliance Lab is a control plane and observability platform
- Software projects (e.g., ERATE Workbench, future demos) live in separate repositories
- Projects integrate via a defined registration contract (to be implemented)
- Compliance logic, audit logging, and control enforcement live in the platform layer
- Projects must not embed compliance logic directly into business code

## REPOSITORY STRUCTURE
- Repo: /home/drake/projects/home-mcp-lab
- project identity: Home MCP Compliance Lab

### ARCHITECTURAL LAWS (immutable — do not violate without explicit architect approval)

#### Platform Governance
- The platform owns compliance logic, audit schemas, and control patterns
- Projects remain independent and must not embed platform governance logic
- All work must be traceable via CC-HMCP-XXXXXX prompt IDs

#### Workflow Discipline
- Feature branches only — never commit directly to main
- PR process is mandatory: branch → push → PR → review → merge → delete branch → sync main
- All significant changes must produce durable artifacts (docs, schemas, or code)

#### Observability & Compliance
- All simulated workflows must be observable through structured events
- Visibility gaps must be explicitly documented (VG-HMCP-*)
- Control patterns must be explicitly defined (CTRL-HMCP-*)
- No silent or untraceable actions in platform-managed workflows

#### Platform Design
- Platform is project-agnostic — no project-specific constraints allowed
- Platform must support multiple independent project integrations
- Compliance controls must minimize developer friction (do not create bypass incentives)

#### Evolution
- Architectural decisions must be recorded (ADR-HMCP-*)
- Platform behavior must be reconstructible from repository artifacts (not memory)

### PROJECT INTEGRATION CONCEPT

A project plugs into the platform by:
1. **Declaring tools** — registering what the MCP server exposes and their risk classification
2. **Emitting audit events** — logging tool calls using the platform's audit event schema
3. **Implementing controls** — applying platform control patterns appropriate to the server's risk profile
4. **Reporting visibility gaps** — documenting what the server does that cannot currently be observed

The integration contract (schema + interface) is defined in this repo. Projects reference it externally.

### PROMPT TAXONOMY
| Prefix | Scope |
|---|---|
| `CC-HMCP-*` | Claude Code implementation prompts |
| `VG-HMCP-*` | Visibility gap register entries |
| `CTRL-HMCP-*` | Control pattern definitions |
| `ADR-HMCP-*` | Architecture Decision Records |
| `TD-HMCP-*` | Technical debt items |

## HOME LAB INFRASTRUCTURE

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


### CURRENT STATE (as of CC-HMCP-000001D)
- Last completed: CC-HMCP-000001D — First visibility gap artifact: VG-HMCP-000001 Keeper non-interactive secret retrieval
- Branch: feature/cc-hmcp-000001d-first-visibility-gap (pending PR)
- Active task / next prompt: CC-HMCP-000001E — TBD (architect to define)

### ACTIVE TASK
- CC-HMCP-000001E — TBD

### KNOWN RISKS
- Non-interactive secret retrieval is not fully stable across service contexts (documented in VG-HMCP-000001)
- Workflow/tool-level observability not yet implemented (infra-level only)

### KNOWN DEBT
- None yet

### CANONICAL STATE RULES

- GitHub `main` and merged PR history are the authoritative source of truth for merged repo state
- This boot block is a convenience operational surface — it may lag behind merged work
- If this boot block conflicts with the latest handoff in `docs/handoffs/`, the handoff wins
- If merged work has advanced beyond the latest handoff, refresh state before starting major new work

---

### BOOT BLOCK UPDATE CHECKLIST (apply after every CC-HMCP task)

- [ ] Boot Block ID updated to current prompt (CC-HMCP-XXXXXX)
- [ ] CURRENT STATE — Last completed updated
- [ ] CURRENT STATE — Branch status updated
- [ ] CURRENT STATE — Summary updated
- [ ] ACTIVE TASK — Updated to next prompt
- [ ] KNOWN RISKS / DEBT — Updated if new issues identified
- [ ] BACKLOG — Items moved between states if applicable
- [ ] Handoff document created in docs/handoffs/ (if session boundary)
- [ ] chatgpt-primer.md updated if system understanding changed
- [ ] Visibility gaps identified documented (VG-HMCP-*)

---

## CLAUDE CODE EXECUTION & RESPONSE STANDARD (MANDATORY)

Claude must treat all CC-HMCP, VG-HMCP, CTRL-HMCP, ADR-HMCP, and TD-HMCP prompts as structured execution tasks — not open-ended requests.

---

### 1. Execution Discipline

Claude must:

- Execute ONLY what is defined in the prompt
- NOT expand scope beyond what is written
- NOT introduce additional features, files, or improvements
- NOT reinterpret the objective

If ambiguity exists:
- Choose the most minimal valid interpretation
- Do NOT invent requirements

---

### 2. No Silent Design Decisions

Claude must NOT:

- Introduce new architecture
- Change patterns
- Add abstractions not explicitly required

If a decision is unclear:
- Make the simplest possible choice
- Document it briefly in output

---

### 3. Output Structure (REQUIRED)

Every response must include:

### Summary
- What was done

### Changes Made
- Files created/modified
- High-level description only

### Notes
- Any assumptions made
- Any minor issues encountered

### Validation
- Confirmation that requirements were met

---

### 3.1 Prompt ID Traceability (REQUIRED)

Claude must include the prompt ID in its response.

Format:

Executed: <PROMPT-ID>

Example:
Executed: VG-HMCP-000001

This ensures traceability across:
- commits
- documents
- handoffs

---

### 4. File Creation Rules

- Only create files explicitly requested
- Do NOT create additional files under any circumstances unless the prompt explicitly requires them
- Do NOT rename files
- Do NOT reorganize directories

---

### 5. Strict Scope Enforcement

Claude must NOT:

- Refactor unrelated code
- Improve formatting outside scope
- Add logging, comments, or enhancements unless required

---

### 6. Git Behavior

- Follow provided branch name exactly
- Use the provided commit message exactly
- Do NOT modify commit message wording
- Do NOT squash or split commits unless instructed

---

### 7. Failure Handling

If the task cannot be completed:

- STOP execution
- Clearly explain the blocking issue
- Do NOT attempt alternative approaches unless instructed

---

### 8. Visibility Gap / ADR / Control Pattern Rules

For non-code artifacts:

- Treat as formal documents
- Follow required structure exactly
- Do NOT add extra sections
- Do NOT propose solutions unless explicitly requested
- Section names and order must match the prompt exactly
- Do NOT rename or reorganize sections

---

### 9. Deterministic Behavior Requirement

Claude should behave as a predictable system component:

- Same prompt → same structure of output
- No creative variation in format
- No stylistic drift

---

### 10. No Markdown Formatting Errors

Claude must:

- Avoid nested triple backticks unless required
- Ensure all markdown renders correctly
- Never break outer code blocks
- Prefer plain text for file paths

---

### 11. Scope Uncertainty Handling

If Claude is unsure whether an action is in scope:

- STOP
- Do NOT proceed
- Report the ambiguity

Do NOT guess or expand scope.

---

### 12. Handoff Behavior

When asked to prepare a session handoff:

- Use the canonical template at `docs/handoffs/HANDOFF-TEMPLATE.md`
- Output to `docs/handoffs/handoff-<prompt-id>.md`
- Handoffs carry dynamic state (last task, open gaps, next task, active branches)
- Keep handoffs concise and source-of-truth oriented — no prose, no duplication of architecture content
- Handoffs are the persistent continuity layer between sessions; treat them as authoritative

---

### 13. Interruption Recovery

If a prompt is resumed after an interruption:

- Inspect current repo state first (branch, uncommitted files, last commit)
- Determine what was completed before the interruption
- Continue or restart cleanly without duplicating work
- Prefer full prompt context over partial continuation guesses
- If state is ambiguous, report it and ask before proceeding

---

### 14. PR Workflow Awareness

- Claude Code is responsible for execution and accurate state reporting
- Do NOT generate PR title or description unless explicitly requested in the prompt
- After execution, report branch name and commit hash so the operator can open the PR
- PR text generation is a separate step, typically done after the execution summary is reviewed

---
