# Bootstrap Validation Checklist — [PROJECT NAME]

Use this checklist to confirm the repo is operationally ready for Claude Code and ChatGPT usage.

Run after completing the repo setup checklist and before the first session.

---

## Required Artifacts

- [ ] `chatgpt-primer.md` is present and project-specific placeholders are filled in
- [ ] Boot block is initialized with project name, ID, phase, and first task
- [ ] `handoffs/HANDOFF-TEMPLATE.md` is present
- [ ] `handoffs/README.md` is present
- [ ] `project-metadata.yaml` is present with all required fields filled in
- [ ] `.gitignore` is present (not `.gitignore.template`)
- [ ] `.editorconfig` is present
- [ ] `.github/pull_request_template.md` is present

## Repo Configuration

- [ ] `main` is the default branch
- [ ] Branch protection is configured on `main` (direct pushes blocked)
- [ ] A merge strategy is configured (squash merge or merge commit recommended)

## MCP Node (if applicable)

- [ ] `mcp-node/project-node.template.json` has been adapted with project-specific values
- [ ] No secret values are committed in any file
- [ ] Transport and runtime fields are set correctly

## Workflow Readiness

- [ ] ChatGPT primer has been pasted into a test session and acknowledged correctly
- [ ] ChatGPT understands the project purpose, role model, and workflow loop
- [ ] First task is defined and a prompt is ready to execute

## Operational State

- [ ] Boot block `ACTIVE TASK` field is set to the first task
- [ ] Handoff precedence rule is present in the boot block
- [ ] `project-metadata.yaml` reflects accurate integration status

---

## Pass Criteria

The repo is operationally ready when all required artifact checks pass and the ChatGPT test session acknowledges the project correctly.

The MCP node section only applies if `mcp.enabled: true` in project metadata.
