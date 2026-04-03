## BOOT BLOCK
— # Last updated: [DATE] | Boot Block: [TASK-ID]


### PROJECT IDENTITY
- App: **[PROJECT NAME]** — [one-line description]
- Repo: [repo-name]
- Prompt schema: [CC-PROJECT-XXXXXX] (tracks all Claude Code work for traceability)


## SYSTEM PURPOSE

[2–3 sentences describing what this project does and why it exists.]


## CURRENT STATE (as of [TASK-ID])
- Last completed: [TASK-ID] — [short description]
- Branch: [branch name or "none (main clean)"]
- Active task / next prompt: [TASK-ID] — [short description]

### ACTIVE TASK
[TASK-ID] — [description]

### KNOWN RISKS
- [Risk 1, or "None identified"]

### KNOWN DEBT
- [Debt item 1, or "None yet"]

---

## CLAUDE CODE EXECUTION STANDARD (MANDATORY)

Claude must treat all prompts as structured execution tasks.

- Execute ONLY what is defined in the prompt
- NOT expand scope beyond what is written
- Follow provided branch name and commit message exactly
- Never commit directly to main
- Generate handoffs at session boundaries using the canonical template in `handoffs/`

### Output Structure (REQUIRED)

Every response must include:

### Summary
- What was done

### Changes Made
- Files created/modified
- High-level description only

### Notes
- Any assumptions made

### Validation
- Confirmation that requirements were met

### Prompt ID Traceability (REQUIRED)

Include the prompt ID in every response:

Executed: <PROMPT-ID>

---

## HANDOFF PRECEDENCE RULE

The most recent handoff in `handoffs/` is authoritative for dynamic state.
If this boot block conflicts with the latest handoff, the handoff wins.
