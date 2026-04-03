# First Session Checklist — [PROJECT NAME]

Complete this checklist before or at the start of the first Claude Code session.

This ensures the repo is in a clean, operational state before any execution work begins.

---

## Before Opening Claude Code

- [ ] Repo setup checklist is complete (`docs/repo-setup-checklist.md`)
- [ ] `chatgpt-primer.md` is adapted and committed
- [ ] Boot block is initialized (in `CLAUDE.md` or referenced in the primer)
- [ ] `handoffs/HANDOFF-TEMPLATE.md` is present
- [ ] `project-metadata.yaml` is filled in and committed
- [ ] `.gitignore` is present and committed
- [ ] Default branch is `main` and branch protection is configured

---

## At Session Start (ChatGPT)

- [ ] Paste `chatgpt-primer.md` into a new ChatGPT session
- [ ] If a handoff exists, paste it after the primer
- [ ] If no handoff exists yet, inform ChatGPT this is the first session and describe the project's initial state
- [ ] Confirm ChatGPT acknowledges the project, role model, and next task

---

## First Task Definition

- [ ] Define or confirm the first active task with ChatGPT
- [ ] ChatGPT generates a scoped, copy-safe prompt with a prompt ID
- [ ] The prompt includes: branch name, commit message, and scope
- [ ] Prompt is ready to run in Claude Code

---

## After First Task Execution

- [ ] Claude Code returns a structured execution summary
- [ ] Summary is returned to ChatGPT for review
- [ ] ChatGPT generates PR title and description
- [ ] PR is opened and merged
- [ ] If this is a session boundary: Claude Code generates a handoff
- [ ] Handoff is committed and pushed

---

## Repo Is Ready When

- [ ] At least one PR has been merged to main
- [ ] At least one handoff exists in `handoffs/`
- [ ] Boot block reflects the current state
- [ ] Next task is identified and ready to execute
