# Repo Setup Checklist — [PROJECT NAME]

One-time setup steps for a newly created repository using this bootstrap kit.

Complete these before the first Claude Code session.

---

## 1. Repository Creation

- [ ] Create the repository on GitHub with the correct name and visibility
- [ ] **Visibility decision:** Public repos should contain no secrets, internal IPs, or infrastructure details. Private repos are appropriate for sensitive automation or internal tooling.
- [ ] Initialize with a README, or push the bootstrap kit as the first commit
- [ ] Set `main` as the default branch

---

## 2. Branch Protection

Recommended settings for `main`:

- [ ] Require pull request reviews before merging (at minimum 1 approval or self-review)
- [ ] Require branches to be up to date before merging
- [ ] Do not allow direct pushes to main
- [ ] Optionally: require signed commits if applicable to your workflow

---

## 3. Merge Strategy

- [ ] Set the preferred merge strategy (recommended: squash merge or merge commit — not rebase for traceability)
- [ ] Disable merge strategies that are not in use to reduce noise

---

## 4. PR Template

- [ ] Copy `.github/pull_request_template.md` from the bootstrap kit to `.github/pull_request_template.md` in the new repo
- [ ] Verify the template appears when opening a new PR

---

## 5. Bootstrap Kit Files

- [ ] Copy all required bootstrap kit files into the new repo (see `docs/bootstrap-usage.md`)
- [ ] Rename `.gitignore.template` to `.gitignore`
- [ ] Keep `.editorconfig` as-is
- [ ] Rename and adapt `chatgpt-primer.template.md` to `chatgpt-primer.md`
- [ ] Rename and adapt `boot-block.template.md` or incorporate it into `CLAUDE.md`
- [ ] Copy `handoffs/HANDOFF-TEMPLATE.md` and `handoffs/README.md` to `handoffs/`
- [ ] Adapt `project-metadata.template.yaml` to `project-metadata.yaml`

---

## 6. Primer Customization

- [ ] Fill in project name and purpose
- [ ] Set the platform relationship (`integrated`, `adjacent`, or `standalone`)
- [ ] Update the prompt taxonomy prefix to match the project ID
- [ ] Verify the resume pattern section is accurate for this repo

---

## 7. Boot Block Initialization

- [ ] Fill in project name, ID, type, and phase
- [ ] Set last completed task and next active task (or mark as "initial setup")
- [ ] Verify the handoff precedence rule is present

---

## 8. Metadata

- [ ] Fill in all fields in `project-metadata.yaml`
- [ ] Confirm `mcp.enabled` is set correctly
- [ ] Set `governance.prompt_id_prefix` to the project's prompt schema

---

## 9. MCP Node Starter (if applicable)

- [ ] Adapt `mcp-node/project-node.template.json` for the project's MCP server
- [ ] Do not commit secret values — use env var names or non-sensitive identifiers only
- [ ] Update `observability.audit_events_enabled` if/when the emitter is wired

---

## 10. GitHub Labels (optional but recommended)

- [ ] Add `status:backlog`, `status:ready`, `status:in-progress`, `status:done` labels for issue lifecycle tracking
- [ ] Add any project-specific labels needed

---

## 11. GitHub Milestones (optional)

- [ ] Create milestones for major project phases if applicable

---

## 12. GitHub Actions / Secrets (optional)

- [ ] Create any required repository secrets (do not commit secret values)
- [ ] Add lightweight GitHub Actions workflows if needed (e.g., issue sync)

---

## 13. Issue and Backlog Setup (recommended)

See `github-backlog/` in the bootstrap kit for full guidance.

**Required for backlog adoption:**
- [ ] Create `status:*` labels in GitHub (see `github-backlog/label-model.md` for names, colors, and a setup script)
- [ ] Read `github-backlog/backlog-operating-rules.md` and `github-backlog/session-vs-backlog-state.md`

**Recommended:**
- [ ] Create `type:*` labels
- [ ] Add initial backlog issues (use `github-backlog/example-bootstrap-backlog.md` as a starting point)
- [ ] Copy issue body templates from `github-backlog/issue-templates/` into `.github/ISSUE_TEMPLATE/` if using GitHub issue templates

**Optional:**
- [ ] Create milestones for planned phases (see `github-backlog/milestone-guidance.md`)
- [ ] Set up a GitHub Project board (see `github-backlog/optional-github-project-guidance.md`)
- [ ] Add a label sync GitHub Actions workflow if automatic project board sync is desired

---

## Done

When all required steps are complete, run the Bootstrap Validation Checklist (`docs/bootstrap-validation-checklist.md`) to confirm the repo is operationally ready.
