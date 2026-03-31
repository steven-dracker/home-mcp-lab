# Infrastructure Topology

*Status: current state as of 2026-03-31*

---

## Overview

The Home MCP Compliance Lab runs on a two-node physical fleet connected via a Tailscale private mesh network. Both nodes are Ubuntu 24.04 LTS on physical hardware at a single home site (192.168.1.0/24).

The fleet is designed for AI-first development workloads: MCP server hosting, compliance tooling, observability, and controlled experimentation.

---

## Node Topology

```
┌─────────────────────────────────┐     ┌─────────────────────────────────┐
│           dude-mcp-01           │     │           dude-ops-01           │
│  192.168.1.208 / 100.106.14.96  │     │  192.168.1.210 / 100.70.156.106 │
│                                 │     │                                 │
│  MCP Hub / App Node             │     │  Observability / Ops Node       │
│  ─────────────────              │     │  ─────────────────────          │
│  Postgres 16                    │     │  Prometheus                     │
│  nginx                          │◄────│  Grafana                        │
│  GitHub MCP server              │     │  Alertmanager                   │
│  Claude Code / MCP tooling      │     │  Blackbox Exporter              │
│  Keeper Commander               │     │  Uptime Kuma                    │
│  node_exporter                  │     │  node_exporter                  │
│  postgres_exporter              │     │                                 │
└─────────────────────────────────┘     └─────────────────────────────────┘
              │                                         │
              └─────────── Tailscale mesh ──────────────┘
                          (private VPN overlay)
```

---

## Node Roles

### dude-mcp-01 — MCP Hub

**Purpose:** Primary application and MCP server host. All MCP servers and AI-facing tooling run here. Postgres provides persistent storage for application workloads.

**Key services:**
- Postgres 16 — application database (currently: ERATE Workbench eratedb, future workloads)
- nginx — reverse proxy / static serving
- GitHub MCP server — Claude Code integration
- Claude Code / MCP tooling — interactive and agent-driven development
- Keeper Commander — secrets retrieval CLI
- node_exporter — host metrics for Prometheus scraping
- postgres_exporter — Postgres metrics for Prometheus scraping

**Hardware:** Dell Latitude 7400, Intel i7-9750H (6-core, 4.5GHz boost), 16GB DDR4, 512GB NVMe SSD

---

### dude-ops-01 — Observability / Ops Node

**Purpose:** Always-on observability and operations. Prometheus, Grafana, and supporting exporters run here. This node scrapes metrics from dude-mcp-01 over Tailscale and provides the visibility layer for the fleet.

**Key services:**
- Prometheus — metrics collection and alerting rules
- Grafana — dashboards and visualization
- Alertmanager — alert routing and notification
- Blackbox Exporter — endpoint probing (HTTP, TCP)
- Uptime Kuma — uptime monitoring and status tracking
- node_exporter — host metrics (self-reporting)

**Hardware:** Dell OptiPlex 5080 Micro, Intel i5-10500T (6-core, 3.8GHz boost), 8GB DDR4, 256GB NVMe SSD

---

## Network Access Model

- **Primary connectivity:** Tailscale private mesh (100.x.x.x addresses) — preferred for all cross-node communication
- **Local subnet:** 192.168.1.0/24 (home LAN, static IPs reserved via DHCP at router)
- **Remote access:** Tailscale enables secure access from off-network without VPN configuration overhead
- **Inter-node scraping:** Prometheus on dude-ops-01 scrapes node_exporter and postgres_exporter on dude-mcp-01 via Tailscale addresses

Services are not exposed to the public internet. Access is private-network-only.

---

## Platform vs Project Workloads

The two-node fleet is **platform infrastructure**. It is not project-specific.

- **Platform layer:** observability stack, Postgres (shared), nginx, secrets tooling, MCP hosting — lives on the fleet nodes
- **Project layer:** individual MCP servers, application databases, Claude agents — deployed onto platform infrastructure as workloads

This distinction matters for compliance reasoning: platform controls apply fleet-wide; project controls are scoped to specific workloads.

**Known current project workload:** ERATE Workbench (eratedb on dude-mcp-01) — used as a reference implementation for Postgres-backed MCP tool access.

**Future project workloads:** additional MCP servers and agents — not yet defined.

---

## Fleet Naming Convention

| Name | Role | Status |
|---|---|---|
| dude-mcp-01 | MCP hub, primary app node | Running |
| dude-ops-01 | Always-on observability, ops | Running |
| dude-ci-01 | Dedicated CI (future) | Not provisioned |
| dude-mon-01 | Additional monitoring (future) | Not provisioned |

---

## Uncertainty / To-Be-Confirmed

- nginx virtual host configuration detail — *to-be-confirmed*
- Exact Prometheus scrape targets and intervals — *to-be-confirmed* (see observability-stack.md)
- postgres_exporter connection configuration — *to-be-confirmed* (known stability issue with non-interactive Keeper retrieval)
