# Bootstrap Usage — Creating a New MCP-Governed Repository

Repeatable procedure for bootstrapping a new project repository from this kit.

---

## Prerequisites

- Access to the `home-mcp-lab` repository (to copy kit files from)
- A new empty repository created on GitHub
- Claude Code installed on the target machine
- ChatGPT access for the architect session

---

## Step 1 — Copy Required Files

From `bootstrap/project-repo-kit/` in this repo, copy the following into the new repo root:

**Required:**
```
chatgpt-primer.template.md       →  chatgpt-primer.md
boot-block.template.md           →  CLAUDE.md  (or incorporate into existing CLAUDE.md)
docs/operator-guide.template.md  →  docs/operator-guide.md  (or Wiki home page)
.gitignore.template              →  .gitignore
.editorconfig                    →  .editorconfig
project-metadata.template.yaml   →  project-metadata.yaml
```

**Required directories:**
```
handoffs/HANDOFF-TEMPLATE.md  →  handoffs/HANDOFF-TEMPLATE.md
handoffs/README.md             →  handoffs/README.md
context/workflow-rules.template.md → context/workflow-rules.md
.github/pull_request_template.md → .github/pull_request_template.md
```

**Optional (if using MCP):**
```
mcp-node/README.md                     →  mcp-node/README.md
mcp-node/project-node.template.json    →  mcp-node/project-node.json
```

**Optional:**
```
CLAUDE.template.md  →  CLAUDE.md  (if not using boot-block.template.md directly)
```

---

## Step 2 — Customize Placeholders

In each copied file, replace all `[PLACEHOLDER]` values:

| Placeholder | Replace With |
|---|---|
| `[PROJECT NAME]` | Full project name |
| `[project-id]` | Short slug used in prompt taxonomy |
| `[TASK-ID]` | Initial task ID (e.g., `CC-MYPROJECT-000001`) |
| `[DATE]` | Today's date |
| `[CC-PROJECT-*]` | Project-specific prompt schema prefix |
| `[phase name]` | Current phase (e.g., `Phase 1 — Initial Setup`) |

---

## Step 3 — Define the Canonical Operational Workspace

Before customizing templates, decide which machine and path will be the **canonical operational workspace** for this repo.

- This is the single designated location where active implementation work happens
- Additional clones on other machines are convenience/backup only
- Record this in `chatgpt-primer.md` (in the `CANONICAL WORKSPACE AND STATE RECOVERY` section) and in `CLAUDE.md` (in the `CANONICAL STATE RULES` section) before the first session

Format: `hostname:/path/to/repo` (e.g., `dude-ops-01:/home/drake/projects/my-project`)

---

## Step 4 — Initialize the Boot Block

In `CLAUDE.md` (or `boot-block.template.md`):

1. Set `PROJECT NAME`, `PROJECT ID`, and `PROJECT TYPE`
2. Set `CURRENT STATE` to reflect the initial setup state
3. Set `ACTIVE TASK` to the first planned task
4. Confirm the handoff precedence rule is present

---

## Step 5 — Fill in Project Metadata

In `project-metadata.yaml`:

1. Set `project.name`, `project.id`, `project.type`, and `project.description`
2. Set `platform.relationship` (`integrated`, `adjacent`, or `standalone`)
3. Set `mcp.enabled` and related fields if applicable
4. Set `governance.prompt_id_prefix` to the project's prompt schema

---

## Step 6 — Adapt the Primer

In `chatgpt-primer.md`:

1. Fill in `PROJECT PURPOSE` and `SYSTEM GOALS`
2. Set `PLATFORM RELATIONSHIP` accurately
3. Update `PROMPT TAXONOMY` with the project-specific prefix
4. Set `CURRENT STATE` to reflect initial phase and first task

---

## Step 7 — Adapt the Workflow Rules

In `context/workflow-rules.md`:

1. Confirm role model is accurate for this project
2. Adjust prompt taxonomy section if needed
3. Remove or add project-specific constraints

---

## Step 8 — Adapt the MCP Node Starter (if applicable)

In `mcp-node/project-node.json`:

1. Fill in `node.id`, `node.display_name`, and `node.description`
2. Set `server.transport` and `server.runtime`
3. Set `server.entry_point` to the server's entrypoint file
4. Set `authentication.method` and `authentication.secret_identifier`
5. Do not commit secret values

---

## Step 9 — Initial Commit

Commit the configured bootstrap files to the new repo:

```bash
git add .
git commit -m "chore: initialize project from bootstrap kit"
git push origin main
```

---

## Step 10 — Create the First Handoff

After the first task is defined, create the first handoff using `handoffs/HANDOFF-TEMPLATE.md`.

Fill in:
- Current state (initial setup complete)
- Next recommended task (first implementation task)
- No completed work yet (or list the bootstrap as completed)

---

## Step 11 — Run the Validation Checklist

Run `docs/bootstrap-validation-checklist.md` to confirm the repo is operationally ready before the first session.

When all checks pass, the repo is ready for Claude Code and ChatGPT usage.

---

## Notes

- Lock files (`package-lock.json`, `yarn.lock`, etc.) should generally be committed — only exclude intentionally
- Do not commit secrets, credentials, or environment values under any circumstances
- The bootstrap kit itself evolves — check `home-mcp-lab` for the latest version before bootstrapping a new repo
