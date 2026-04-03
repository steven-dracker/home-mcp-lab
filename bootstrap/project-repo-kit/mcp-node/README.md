# MCP Node Starter — [PROJECT NAME]

This directory contains the identity definition and configuration starter for the MCP node associated with this project.

---

## What Is an MCP Node

An MCP node is an MCP server instance that exposes tools to Claude or another agent. It defines:
- what tools are available
- what transport the server uses
- how authentication is handled
- what the server's runtime requirements are
- how it integrates with the platform (if applicable)

---

## Files

| File | Purpose |
|---|---|
| `project-node.template.json` | Machine-readable MCP node identity and config starter |

---

## Usage

1. Copy `project-node.template.json` to your MCP server project or keep it here as the project's node declaration
2. Fill in all placeholder values
3. Add runtime-specific configuration as needed
4. Reference this file when registering the node with the platform (if platform-integrated)

---

## Transport Options

Common MCP transports:
- `stdio` — subprocess via stdin/stdout; suitable for local and CLI contexts
- `http` — HTTP/SSE; suitable for service and remote contexts

Choose the transport that matches your deployment target.

---

## Secret Handling

Do not store secrets in this file or in any committed file.

Retrieve secrets at runtime using:
- environment variable pass-through
- a non-interactive secret manager (e.g., Keeper Commander)
- a CI/CD secret injection mechanism

Reference `CTRL-HMCP-000001` in the platform for the approved runtime secret retrieval control pattern.

---

## Audit and Observability

If this project is platform-integrated, the MCP node should:
- emit `tool.invocation` audit events for each tool call
- emit `session.start` and `session.end` events for each agent session
- emit `secret.retrieval` events when secrets are retrieved at runtime
- conform to `schemas/audit-event.schema.json` v0.2.0 in the platform repo

If this project is not yet platform-integrated, document observability gaps using the `VG-[PROJECT]-*` visibility gap register.
