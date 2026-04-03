# Boot Block — [PROJECT NAME]
# Last updated: [DATE] | Boot Block: [TASK-ID]

## BOOT BLOCK

### PROJECT IDENTITY

- **Project Name:** [PROJECT NAME]
- **Project ID:** [project-id] — used in prompt taxonomy and metadata
- **Project Type:** [mcp-node | agent-workflow | content-pipeline | automation | general]
- **Repo:** [repo name or URL]
- **Prompt Schema:** [CC-PROJECT-XXXXXX] — tracks all Claude Code work for traceability

---

### CURRENT STATE

- **Last Completed Task:** [TASK-ID] — [short description]
- **Current Phase:** [phase name, e.g., Phase 1 — Initial Setup]
- **Active Branch:** none / [branch name]
- **PR Status:** [None open / PR #N open / All merged, main clean]
- **Active Task / Next Prompt:** [TASK-ID] — [short description]

---

### ACTIVE TASK

[TASK-ID] — [description]

---

### KNOWN RISKS

- [Risk 1 — description, or "None identified"]

---

### KNOWN DEBT

- [Debt item 1 — description, or "None yet"]

---

### ACTIVE CONSTRAINTS

- Feature branches only — never commit directly to main
- PR process mandatory: branch → push → PR → merge → delete branch → sync main
- All Claude Code work must carry a [CC-PROJECT-XXXXXX] prompt ID
- [Add project-specific constraints here]

---

### HANDOFF PRECEDENCE RULE

The most recent handoff in `handoffs/` is the authoritative source of truth for dynamic state.

If this boot block conflicts with the latest handoff, the handoff wins.

Update this boot block after each session boundary by reflecting the handoff's current state summary.

---

### BOOT BLOCK UPDATE CHECKLIST

Apply after every task:

- [ ] Boot Block ID updated to current task ID
- [ ] CURRENT STATE — Last completed updated
- [ ] CURRENT STATE — Branch status updated
- [ ] ACTIVE TASK — Updated to next prompt
- [ ] KNOWN RISKS / DEBT — Updated if new issues identified
- [ ] Handoff created in `handoffs/` if session boundary reached
- [ ] Primer updated only if durable behavioral guidance changed
