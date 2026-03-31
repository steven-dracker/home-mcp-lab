# Observability Stack

*Status: current state as of 2026-03-31*

---

## Overview

The observability stack provides infrastructure-level visibility across the two-node fleet. It runs entirely on dude-ops-01 and scrapes metrics from both nodes over the Tailscale private network.

**Important distinction:** this is *infrastructure* observability — host metrics, service health, and endpoint availability. It does not yet cover MCP workflow events, tool call audit logs, or compliance-level visibility. That gap is a core motivation for this lab and is tracked separately.

---

## Components

### Prometheus — dude-ops-01

- **Role:** Metrics collection, alerting rules, time-series storage
- **Location:** dude-ops-01 (192.168.1.210 / 100.70.156.106)
- **Scrape model:** Pulls metrics from exporters on a configured interval
- **Remote targets:** node_exporter and postgres_exporter on dude-mcp-01, scraped over Tailscale (100.106.14.96)
- **Local targets:** node_exporter on dude-ops-01 (self-scrape)
- **Status:** *known — running*

---

### Grafana — dude-ops-01

- **Role:** Dashboard visualization and metric exploration
- **Location:** dude-ops-01
- **Data source:** Prometheus (local)
- **Dashboards:** *to-be-confirmed — assumed basic host metric dashboards; custom dashboards not yet verified*
- **Status:** *known — running*

---

### Alertmanager — dude-ops-01

- **Role:** Alert routing and notification dispatch from Prometheus
- **Location:** dude-ops-01
- **Configuration:** *to-be-confirmed — alert rules and routing targets not yet documented*
- **Status:** *known — installed; active configuration not confirmed*

---

### Blackbox Exporter — dude-ops-01

- **Role:** Endpoint probing — HTTP/HTTPS availability checks, TCP connectivity checks
- **Location:** dude-ops-01
- **Probe targets:** *to-be-confirmed — specific probe targets not yet documented*
- **Status:** *known — installed*

---

### Uptime Kuma — dude-ops-01

- **Role:** Uptime monitoring, service availability tracking, status page
- **Location:** dude-ops-01
- **Monitors:** *to-be-confirmed — configured monitors not yet documented*
- **Status:** *known — running*

---

### node_exporter — dude-mcp-01 and dude-ops-01

- **Role:** Host-level metrics — CPU, memory, disk, network, system
- **Location:** Both nodes (each exports its own host metrics)
- **Scraped by:** Prometheus on dude-ops-01
- **Status:** *known — installed on both nodes*

---

### postgres_exporter — dude-mcp-01

- **Role:** Postgres metrics — connections, query performance, replication lag, table stats
- **Location:** dude-mcp-01 (alongside Postgres 16)
- **Scraped by:** Prometheus on dude-ops-01
- **Status:** *known — installed; see note below*
- **Note:** postgres_exporter requires a Postgres connection string containing credentials. Current secrets policy prohibits embedding credentials in static config files or systemd unit files. There is a known non-interactive/systemd retrieval issue with Keeper Commander in this context. This is a confirmed open gap — postgres_exporter may not be fully operational as a scraped target until the secrets retrieval path is resolved. Full analysis deferred.

---

## Scraping Model

```
dude-ops-01 (Prometheus)
  │
  ├─── scrapes ──► node_exporter on dude-mcp-01    (via Tailscale: 100.106.14.96)
  ├─── scrapes ──► postgres_exporter on dude-mcp-01 (via Tailscale: 100.106.14.96)
  └─── scrapes ──► node_exporter on dude-ops-01     (localhost)
```

Scrape intervals, retention, and exact target configuration are *to-be-confirmed* and not yet documented in this repo.

---

## Current Visibility Baseline

What is currently visible:

| Signal | Source | Status |
|---|---|---|
| Host CPU / memory / disk / network (dude-mcp-01) | node_exporter | Known — running |
| Host CPU / memory / disk / network (dude-ops-01) | node_exporter | Known — running |
| Postgres metrics | postgres_exporter | Uncertain — credential gap |
| HTTP endpoint availability | Blackbox Exporter | Known — installed; targets TBC |
| Service uptime / availability | Uptime Kuma | Known — running; monitors TBC |
| Alert routing | Alertmanager | Known — installed; rules TBC |

---

## What Is NOT Yet Visible

This is the critical gap this lab exists to address:

| What is missing | Why it matters |
|---|---|
| MCP tool call events | No audit trail of what tools Claude called, with what arguments, and what was returned |
| Agent identity | No record of which agent or session initiated a tool call |
| Tool outcome classification | No success/failure/anomaly classification at the tool level |
| Cross-tool workflow traces | No ability to correlate a sequence of tool calls into a logical workflow |
| Compliance boundary enforcement | No mechanism to detect or block tool calls that violate policy |

Infrastructure observability tells us the fleet is healthy. It does not tell us what the agents are doing. That is the gap this lab is designed to close.

---

## Uncertainty Summary

- Grafana dashboard contents — *to-be-confirmed*
- Alertmanager routing rules and notification targets — *to-be-confirmed*
- Blackbox Exporter probe targets — *to-be-confirmed*
- Uptime Kuma monitor list — *to-be-confirmed*
- postgres_exporter operational status — *uncertain pending secrets resolution*
- Prometheus scrape intervals and retention settings — *to-be-confirmed*
