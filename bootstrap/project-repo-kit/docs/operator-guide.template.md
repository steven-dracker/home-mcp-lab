# Operator Guide — [PROJECT NAME]

This guide explains how to work in this repository after bootstrap has been applied. It is intended for the operator — the person running Claude Code sessions, reviewing PRs, and controlling session boundaries.

This document can also serve as the GitHub Wiki home page if the repository has a Wiki enabled.

---

## What This Repository Is

This is an MCP-governed project repository, bootstrapped from the Home MCP Compliance Lab's project repo kit.

That means it comes pre-configured with:
- a workflow model for structured Claude Code and ChatGPT collaboration
- a handoff system for session continuity across conversations
- a backlog model using GitHub issues and labels
- repo hygiene conventions (branch discipline, PR template, `.editorconfig`, `.gitignore`)
- a primer that carries durable behavioral guidance for ChatGPT sessions
- optionally, a MCP node starter configuration

---

## How This Repo Is Different From a Typical Project Repo

In a typical repo, you push commits and open PRs. Here, implementation work is driven by structured Claude Code sessions.

The workflow is:
1. ChatGPT generates a scoped prompt
2. Operator pastes the prompt into Claude Code
3. Claude Code executes, commits, and returns a structured summary
4. Operator returns the summary to ChatGPT
5. ChatGPT generates the PR title and description
6. Operator opens and merges the PR
7. If a session boundary is reached, Claude Code generates a handoff

The operator controls the pace. ChatGPT and Claude Code do not proceed to the next task without operator direction.

---

## The Four Layers — What Each One Is For

Understanding these four layers prevents the most common workflow mistakes.

### 1. Issues — Canonical Backlog

**GitHub Issues answer: What needs to be done?**

Issues are the authoritative list of planned and in-progress work. Every issue should have exactly one `status:*` label reflecting its current state.

Do not use handoffs as a substitute for issue tracking.

### 2. ChatGPT Primer — Durable Behavioral Guidance

**The primer answers: How do we work?**

The primer (`chatgpt-primer.md`) carries stable rules: role model, workflow conventions, branch/PR discipline, and the resume pattern. Paste it at the start of every new ChatGPT session.

The primer does **not** carry current execution state. Do not update it to reflect what task was done last — that belongs in the handoff.

### 3. Handoffs — Dynamic Session State

**Handoffs answer: What is happening right now?**

Handoffs (in `handoffs/`) carry: last completed task, open branch/PR, known gaps, and next recommended task. The most recent handoff is authoritative for all current state.

At the start of a new ChatGPT session: paste the primer, then paste the latest handoff.

Do not skip handoffs at session boundaries. Without a handoff, the next session starts cold.

### 4. Pull Requests — Implementation/Change Records

**PRs answer: What was done?**

Each PR documents a specific change made in a Claude Code session. PRs reference the issue they implement where possible. Merged PRs form a browsable history of changes.

---

## What the Operator Does

The operator:

- **Starts sessions** — pastes the primer and latest handoff into ChatGPT
- **Runs prompts** — pastes Claude Code prompts into the Claude Code CLI or IDE
- **Returns summaries** — pastes Claude Code execution summaries back to ChatGPT
- **Merges PRs** — reviews and merges PRs after ChatGPT reviews the summary
- **Controls pacing** — decides when to continue to the next task or end the session
- **Creates handoffs** — requests a handoff at session boundaries

The operator does not write prompts or generate PR text — those are ChatGPT's responsibilities.

---

## Canonical Workspace and State Recovery

This repo has one **canonical operational workspace** — the designated host and path where active implementation work is done. Additional clones may exist on other machines for convenience, but they are not primary working contexts.

**Canonical workspace:** `[CANONICAL_HOST]:[CANONICAL_PATH]`

Before starting or resuming work:

1. Work from the canonical workspace only
2. Run `git pull origin main` to sync before starting any session
3. Check the latest handoff in `handoffs/` — not just the boot block — for current state
4. If `git log` shows merged PRs not reflected in the latest handoff, create a fresh handoff before starting new work

**GitHub is the canonical source of truth.** If the boot block, primer, or handoff conflict with the merged PR history on GitHub, GitHub wins.

---

## Starting a New ChatGPT Session

1. Open a new ChatGPT conversation
2. Paste the full contents of `chatgpt-primer.md`
3. Paste the full contents of the most recent handoff from `handoffs/`
4. ChatGPT will acknowledge the project state and propose the next task
5. Review the proposed task and ask ChatGPT to generate a Claude Code prompt if it looks right

---

## Running a Claude Code Session

1. Open Claude Code in the project directory
2. Paste the prompt from ChatGPT exactly as written — do not paraphrase
3. Claude Code will execute the task, commit, and return a structured summary
4. Copy the full summary and paste it into ChatGPT
5. ChatGPT will review the summary and generate a PR title and description
6. Open the PR on GitHub using the title and body provided

---

## First Things To Do After Bootstrap

**Required:**
- [ ] Replace all `[PLACEHOLDER]` values in `chatgpt-primer.md`
- [ ] Initialize the boot block (`CLAUDE.md`) with the project name, ID, phase, and first task
- [ ] Create the `status:*` labels in GitHub (see `github-backlog/label-model.md`)
- [ ] Fill in `project-metadata.yaml`
- [ ] Create the first handoff in `handoffs/` using `handoffs/HANDOFF-TEMPLATE.md`

**Recommended:**
- [ ] Create initial backlog issues and assign `status:backlog` labels
- [ ] Create `type:*` labels
- [ ] Review `github-backlog/example-bootstrap-backlog.md` for starter issue ideas
- [ ] Verify the PR template appears when opening a new PR

**Optional:**
- [ ] Adapt `mcp-node/project-node.json` if the project uses an MCP server
- [ ] Set up a GitHub Project board (see `github-backlog/optional-github-project-guidance.md`)
- [ ] Configure branch protection on `main`

---

## Branch and PR Discipline

- **Never commit directly to `main`**
- All work happens on feature branches: `feature/<short-task-name>`
- Every feature branch ends with a PR
- PR title and description are generated by ChatGPT after reviewing the execution summary
- Merge the PR, delete the branch, and sync `main` before starting the next task
- Commit messages follow: `<type>: <summary>` (feat, fix, docs, refactor, chore)

---

## When To Create a Handoff

Create a handoff when:
- A PR is merged and you are pausing work
- ChatGPT context is running low (approximately 30% remaining)
- A phase or logical unit of work is complete
- The session is ending and work may not resume immediately

Ask Claude Code to generate a handoff using the template in `handoffs/HANDOFF-TEMPLATE.md`. Commit and push the handoff file before closing the session.

---

## MCP Node Configuration

If this project uses an MCP server, adapt `mcp-node/project-node.json` before the MCP node is deployed.

Key rules:
- Do not commit secret values — use non-sensitive identifiers (env var names, record UIDs)
- Set `transport` and `runtime` to match your deployment target
- Set `observability.audit_events_enabled` to `true` when the emitter is wired

If this project does not use an MCP server, the `mcp-node/` directory is optional and can be deleted.

---

## Common Mistakes and Anti-Patterns

| Mistake | Why It's Wrong | What To Do Instead |
|---|---|---|
| Updating the primer to reflect current task state | The primer carries durable rules, not live state | Put current state in a handoff |
| Skipping handoffs at session boundaries | The next session starts cold with no context | Create a handoff before ending the session |
| Using handoffs as the issue tracker | Handoffs are transient; issues persist | Track work in GitHub Issues |
| Paraphrasing Claude Code prompts before running them | Changes prompt behavior unpredictably | Run prompts exactly as written |
| Leaving `[PLACEHOLDER]` values in the primer | Confuses ChatGPT and produces wrong context | Customize all placeholders before first session |
| Committing directly to main | Bypasses PR review and branch discipline | Always use a feature branch |
| Treating the GitHub Project board as canonical | Project boards are derived visualizations | Trust issues + labels as the source of truth |
| Assuming MCP node config is required | Many projects don't need an MCP server | Only adapt `mcp-node/` if applicable |
| Working from a secondary clone | State can diverge; secondary clones are convenience only | Work from the canonical workspace defined in the primer |
| Trusting the boot block over the latest handoff | The boot block may lag merged work | Check the latest handoff first; it is authoritative for dynamic state |
| Starting work when handoff predates significant merged PRs | New work builds on stale state | Compare `git log` to the latest handoff; create a fresh handoff if needed |

---

## Reference

| Artifact | Location | Purpose |
|---|---|---|
| Primer | `chatgpt-primer.md` | Paste into ChatGPT to restore behavioral context |
| Boot block | `CLAUDE.md` | Claude Code session boot block |
| Handoffs | `handoffs/` | Session continuity and dynamic state |
| Workflow rules | `context/workflow-rules.md` | Role model and operating conventions |
| Backlog guidance | `github-backlog/` | Issue, label, milestone, and backlog conventions |
| MCP node starter | `mcp-node/` | MCP server identity and configuration |
| Repo setup checklist | `docs/repo-setup-checklist.md` | One-time setup steps |
| First-session checklist | `docs/first-session-checklist.md` | Pre-work for first Claude Code session |
| Bootstrap validation | `docs/bootstrap-validation-checklist.md` | Confirm the repo is operationally ready |
