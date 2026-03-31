# GitHub MCP Server — Platform Integration Assessment

**Status:** Draft  
**Date:** 2026-03-31  

---

## Summary

This document registers the GitHub MCP server as the first project integrated with the Home MCP Compliance Lab platform. It declares the server's known tools, classifies their risk, and evaluates alignment with the integration contract, audit event schema, and applicable control patterns. This is an observational integration — no code changes are made to the GitHub MCP server.

---

## Project Overview

The GitHub MCP server exposes GitHub repository operations as callable tools for Claude and other MCP-compatible agents. It enables agents to read repositories, manage issues, create and review pull requests, access file contents, and perform other repository-level operations against the GitHub API.

In the context of this platform, the GitHub MCP server is the primary mechanism through which Claude Code sessions perform repository operations — including all work tracked under the CC-HMCP-* prompt series.

---

## MCP Server Details

| Field | Value |
|---|---|
| Host | dude-mcp-01 (192.168.1.208) |
| Server type | GitHub MCP server (official, Anthropic-maintained) |
| Authentication | GitHub personal access token (PAT) or app credential |
| Connection status | Connected (as of CC-HMCP-000001B) |
| Runtime context | Interactive Claude Code sessions on dude-mcp-01 |
| Execution model | Invoked per agent session; not a persistent long-running service |

---

## Declared Tools

The following tools are known or strongly inferred based on the GitHub MCP server's documented capabilities. This list is high-level and may not be exhaustive.

| Tool | Category | Description |
|---|---|---|
| `get_repository` | Repository Read | Retrieve metadata for a repository |
| `list_repositories` | Repository Read | List repositories for a user or organization |
| `get_file_contents` | File Read | Read file contents from a repository at a ref |
| `list_directory` | File Read | List directory contents in a repository |
| `create_or_update_file` | File Write | Create or update a file via the GitHub API |
| `delete_file` | File Write | Delete a file from a repository |
| `create_branch` | Branch Management | Create a new branch from a ref |
| `list_branches` | Branch Management | List branches in a repository |
| `get_commit` | Commit Read | Retrieve commit details |
| `list_commits` | Commit Read | List commits on a branch |
| `create_pull_request` | PR Management | Open a new pull request |
| `get_pull_request` | PR Management | Read PR metadata and status |
| `merge_pull_request` | PR Management | Merge a pull request |
| `list_pull_requests` | PR Management | List open or closed PRs |
| `create_issue` | Issue Management | Create a new issue |
| `get_issue` | Issue Management | Read issue metadata and comments |
| `update_issue` | Issue Management | Modify issue state, labels, or body |
| `list_issues` | Issue Management | List issues for a repository |
| `add_issue_comment` | Issue Management | Post a comment on an issue |
| `search_code` | Search | Search repository code via GitHub API |
| `search_repositories` | Search | Search for repositories |

---

## Tool Classification

Risk classification is conceptual and based on data access scope, write capability, and potential for external impact.

| Tool | Risk | Basis |
|---|---|---|
| `get_repository` | Low | Read-only; repository metadata only |
| `list_repositories` | Low | Read-only; no sensitive data |
| `get_file_contents` | Medium | Read-only, but may access sensitive files if present in repo |
| `list_directory` | Low | Read-only; structural data only |
| `create_or_update_file` | High | Writes to repository; directly modifies codebase |
| `delete_file` | High | Destructive write; permanent without recovery |
| `create_branch` | Medium | Structural change to repository; low blast radius but persistent |
| `list_branches` | Low | Read-only |
| `get_commit` | Low | Read-only |
| `list_commits` | Low | Read-only |
| `create_pull_request` | Medium | Creates external artifact visible to collaborators; triggers review workflows |
| `get_pull_request` | Low | Read-only |
| `merge_pull_request` | High | Irreversible merge; modifies main branch history |
| `list_pull_requests` | Low | Read-only |
| `create_issue` | Medium | Creates external artifact; visible to all repo collaborators |
| `get_issue` | Low | Read-only |
| `update_issue` | Medium | Modifies external artifact; state changes visible to collaborators |
| `list_issues` | Low | Read-only |
| `add_issue_comment` | Medium | Creates visible, attributed external communication |
| `search_code` | Medium | Read across repository contents; may surface sensitive patterns |
| `search_repositories` | Low | Read-only; public metadata |

---

## Integration Contract Alignment

Evaluation against `docs/architecture/project-integration-contract.md`:

| Requirement | Status | Notes |
|---|---|---|
| Tools declared | Partial | High-level declaration present in this document; no machine-readable format yet |
| Risk classification provided | Partial | Conceptual classification provided; formal taxonomy not yet defined |
| Audit events emitted | No | GitHub MCP server does not currently emit platform audit events |
| Control patterns applied | Partial | Secret handling via PAT is present; alignment with CTRL-HMCP-000001 is unvalidated |
| Visibility gaps reported | Partial | Candidates identified below; formal VG entries pending |
| Platform compliance logic not embedded | Yes | GitHub MCP server is external; no platform logic embedded |
| Platform schema not duplicated in project | Yes | No duplication |

**Overall integration maturity:** Pre-compliance. The server is operationally connected but not yet platform-compliant under the integration contract.

---

## Audit Event Emission Assessment

**Current state:** No audit events are emitted by the GitHub MCP server conforming to `schemas/audit-event.schema.json`.

The GitHub MCP server is a third-party tool. It does not have built-in support for emitting platform-specific audit events. As a result:

- Tool invocations are not observable through the platform audit log
- No `tool.invocation` events are generated
- No `secret.retrieval` events are generated for PAT access
- The platform has no record of which tools were called, by which agent, with what arguments, or with what outcome

**What would be required for compliance:**
- A platform-side instrumentation layer (proxy, wrapper, or middleware) that intercepts tool calls and emits conforming audit events
- OR: an agent-side convention where Claude Code sessions emit synthetic audit events at tool call boundaries
- OR: a future platform capability that logs tool invocations from MCP session transcripts

Until one of these mechanisms exists, the GitHub MCP server cannot meet audit emission requirements. This is a platform-level gap, not a project defect.

---

## Control Alignment Assessment

**CTRL-HMCP-000001 — Runtime Secret Retrieval**

The GitHub MCP server authenticates to the GitHub API using a personal access token (PAT) or equivalent credential. Assessment:

| Control Requirement | Current Status | Notes |
|---|---|---|
| Secret not stored in repository | Unknown | PAT storage location is not confirmed; assumed to be in Claude Code MCP config or environment — not in this repo |
| Secret retrieved at runtime via approved mechanism | Unknown | How the PAT is injected into the MCP server process is not confirmed; Keeper Commander is not known to be involved |
| Retrieval is non-interactive | Likely yes | MCP server connects at session start without user prompt |
| Retrieval is service-safe | Unknown | Only used in interactive Claude Code sessions currently; not validated in unattended service context |
| Retrieval failure handled explicitly | Unknown | Failure behavior if PAT is absent or expired is not documented |
| No silent fallback to weaker patterns | Unknown | Cannot confirm without observing the server's authentication path |

**Assessment:** CTRL-HMCP-000001 alignment is **unvalidated**. The PAT-based authentication likely satisfies some requirements in practice, but the platform has no visibility into the retrieval path and cannot attest compliance.

---

## Identified Visibility Gap Candidates

The following candidates should be formalized as VG-HMCP entries:

**VG candidate 1 — GitHub MCP tool invocation opacity**
- Gap: The platform cannot observe which GitHub MCP tools are called, by whom, with what arguments, or with what outcome
- Root cause: No audit event emission; no platform-side instrumentation
- Impact: All tool invocations (including high-risk write operations) are invisible to the platform
- Type: Platform-level gap (instrumentation not yet built)

**VG candidate 2 — GitHub PAT storage and retrieval path**
- Gap: The platform cannot confirm where the GitHub PAT is stored or how it is injected into the MCP server process
- Root cause: No documentation of the MCP server's authentication configuration; Keeper integration not confirmed
- Impact: CTRL-HMCP-000001 compliance cannot be attested
- Type: Project-level gap (configuration not documented)

**VG candidate 3 — MCP session boundary events**
- Gap: The platform has no record of when an MCP server session starts or ends, which agent initiated it, or what was accomplished
- Root cause: No session lifecycle event emission
- Impact: Correlation of tool call events is impossible without session boundary anchors
- Type: Platform-level gap (session event type not yet defined in schema)

---

## Known Limitations

- Tool list is inferred from known GitHub MCP server capabilities; the complete tool list was not directly inspected on dude-mcp-01
- PAT storage and retrieval path are assumed — direct inspection was not performed in this assessment
- Runtime behavior (error handling, fallback, token expiry) is not observed; all assessments in the control alignment section are inferences
- The GitHub MCP server is a third-party binary; its internal behavior cannot be modified to emit platform events without a wrapper or proxy layer

---

## Recommendations

1. **Document PAT configuration** — explicitly record where the GitHub PAT is stored and how it enters the MCP server process; verify against CTRL-HMCP-000001
2. **Formalize visibility gap candidates** — open VG-HMCP entries for tool invocation opacity and PAT retrieval path
3. **Define session lifecycle event types** — extend the audit schema with `session.start` and `session.end` event types to enable correlation
4. **Evaluate instrumentation options** — assess whether a platform-side proxy, wrapper, or agent-side convention is the right mechanism for audit emission

---

## Next Steps

| Action | Type | Priority |
|---|---|---|
| Formalize VG-HMCP-000002 (tool invocation opacity) | VG entry | High |
| Formalize VG-HMCP-000003 (PAT retrieval path) | VG entry | High |
| Validate PAT storage against CTRL-HMCP-000001 | Control alignment | High |
| Define session lifecycle event types in audit schema | Schema evolution | Medium |
| Evaluate audit instrumentation approach | ADR candidate | Medium |

---
