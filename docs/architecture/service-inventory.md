# Service Inventory

*Status: current state as of 2026-03-31*

Key: **known** = confirmed running / installed | **inferred** = expected based on role | **to-be-confirmed** = not yet verified

---

## dude-mcp-01 — MCP Hub (192.168.1.208 / 100.106.14.96)

---

### Postgres 16

| Field | Value |
|---|---|
| Host | dude-mcp-01 |
| Role | Relational database for application workloads |
| Port | 5432 |
| Status | **known — running** |
| Current databases | `eratedb` (ERATE Workbench app DB), `postgres` (system) |
| Users | `postgres` (superuser), `erate` (app user) |
| Remote access | Enabled for 192.168.1.0/24 subnet |
| Notes | Managed by systemd (`postgresql` service). Primary storage for current and future project workloads on this node. |

---

### nginx

| Field | Value |
|---|---|
| Host | dude-mcp-01 |
| Role | Reverse proxy and/or static file serving |
| Status | **known — installed** |
| Virtual hosts | *to-be-confirmed* |
| Notes | Installed as part of node provisioning. Specific virtual host configuration and what it proxies are not yet documented. |

---

### GitHub MCP Server

| Field | Value |
|---|---|
| Host | dude-mcp-01 |
| Role | MCP server exposing GitHub API tools to Claude Code |
| Status | **known — connected** |
| Runtime | Node.js v24 |
| Notes | Connected and verified working. Exposes tools for repo management, issue/PR operations, and code search via the MCP protocol. This is the first external MCP server integrated into the fleet. |

---

### Claude Code / MCP Tooling

| Field | Value |
|---|---|
| Host | dude-mcp-01 |
| Role | Interactive AI development CLI; MCP client for connected servers |
| Version | 2.1.86 (at time of provisioning) |
| Status | **known — installed** |
| Notes | Used for interactive Claude sessions and agent-driven development tasks. Acts as the MCP client that connects to MCP servers (e.g., GitHub MCP). |

---

### Keeper Commander

| Field | Value |
|---|---|
| Host | dude-mcp-01 |
| Role | CLI-based secrets retrieval from Keeper vault |
| Status | **known — installed** (via pipx) |
| Notes | Used for runtime credential retrieval in interactive scripts. Known stability issue in non-interactive/systemd contexts — see secrets-policy.md. |

---

### node_exporter

| Field | Value |
|---|---|
| Host | dude-mcp-01 |
| Role | Exposes host-level metrics (CPU, memory, disk, network) for Prometheus scraping |
| Status | **known — installed** |
| Scrape target | Prometheus on dude-ops-01 (via Tailscale) |
| Notes | Standard Prometheus exporter. Scraped remotely by dude-ops-01. |

---

### postgres_exporter

| Field | Value |
|---|---|
| Host | dude-mcp-01 |
| Role | Exposes Postgres metrics for Prometheus scraping |
| Status | **known — installed; operational status uncertain** |
| Scrape target | Prometheus on dude-ops-01 (via Tailscale) |
| Notes | Requires a Postgres connection string with credentials. Current secrets policy prohibits embedding credentials in systemd unit files. Non-interactive Keeper Commander retrieval has a known stability issue. This service may not currently be serving metrics as expected. Flagged as a potential visibility gap — full analysis deferred. |

---

## dude-ops-01 — Observability / Ops Node (192.168.1.210 / 100.70.156.106)

---

### Prometheus

| Field | Value |
|---|---|
| Host | dude-ops-01 |
| Role | Metrics collection, time-series storage, alerting rules |
| Status | **known — running** |
| Scrape targets | node_exporter (both nodes), postgres_exporter (dude-mcp-01) |
| Notes | Scrapes remote targets over Tailscale. Exact scrape intervals, retention period, and full target list are *to-be-confirmed*. |

---

### Grafana

| Field | Value |
|---|---|
| Host | dude-ops-01 |
| Role | Dashboard visualization and metric exploration |
| Status | **known — running** |
| Data source | Prometheus (local) |
| Notes | Dashboard contents and provisioning state are *to-be-confirmed*. Expected to have basic host metric dashboards. |

---

### Alertmanager

| Field | Value |
|---|---|
| Host | dude-ops-01 |
| Role | Alert routing and notification dispatch (receives alerts from Prometheus) |
| Status | **known — installed** |
| Notes | Alert rules and routing configuration are *to-be-confirmed*. Notification targets (email, webhook, etc.) not yet documented. |

---

### Blackbox Exporter

| Field | Value |
|---|---|
| Host | dude-ops-01 |
| Role | Endpoint probing — HTTP availability checks, TCP connectivity |
| Status | **known — installed** |
| Probe targets | *to-be-confirmed* |
| Notes | Used to probe HTTP endpoints and service ports for availability. Specific targets not yet documented. |

---

### Uptime Kuma

| Field | Value |
|---|---|
| Host | dude-ops-01 |
| Role | Uptime monitoring and status page |
| Status | **known — running** |
| Monitors | *to-be-confirmed* |
| Notes | Lightweight uptime tracker. Configured monitors not yet documented in this repo. |

---

### node_exporter (dude-ops-01)

| Field | Value |
|---|---|
| Host | dude-ops-01 |
| Role | Exposes host-level metrics for Prometheus (self-scrape) |
| Status | **known — installed** |
| Notes | Scraped by Prometheus on the same node (localhost). Standard self-monitoring pattern. |

---

## Inventory Summary

| Service | Host | Status |
|---|---|---|
| Postgres 16 | dude-mcp-01 | Known — running |
| nginx | dude-mcp-01 | Known — installed; config TBC |
| GitHub MCP server | dude-mcp-01 | Known — connected |
| Claude Code / MCP tooling | dude-mcp-01 | Known — installed |
| Keeper Commander | dude-mcp-01 | Known — installed |
| node_exporter | dude-mcp-01 | Known — installed |
| postgres_exporter | dude-mcp-01 | Uncertain — credential gap |
| Prometheus | dude-ops-01 | Known — running |
| Grafana | dude-ops-01 | Known — running |
| Alertmanager | dude-ops-01 | Known — installed |
| Blackbox Exporter | dude-ops-01 | Known — installed |
| Uptime Kuma | dude-ops-01 | Known — running |
| node_exporter | dude-ops-01 | Known — installed |
