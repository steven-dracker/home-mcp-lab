# Issue Taxonomy Guidance

How to categorize and name issues in a new MCP-governed repository.

---

## Issue Types

### Feature / Implementation Work

Work that adds new capability, functionality, or structure to the repo.

Use when:
- implementing a new system component
- adding a new integration
- building a new workflow or pipeline
- creating a reusable artifact or template

Suggested prefix (if using prompt-style IDs): `CC-[PROJECT]-*`

---

### Technical Debt

Work that reduces existing quality, maintainability, or consistency issues without adding new capability.

Use when:
- refactoring messy code or structure
- removing duplication
- resolving a known compromise that was deferred
- upgrading a dependency for non-security reasons

Suggested prefix: `TD-[PROJECT]-*`

---

### Risk / Gap / Limitation

A documented gap in observability, capability, or operational safety that is known and accepted but not yet resolved.

Use when:
- a tool or process cannot currently be observed (visibility gap)
- a known limitation in the system could cause issues
- a control or safeguard is missing and the risk is acknowledged

Suggested prefix: `VG-[PROJECT]-*` (visibility gap) or `RK-[PROJECT]-*` (general risk)

---

### Control / Policy Definition

Work that defines, documents, or enforces a control pattern or operational policy.

Use when:
- establishing an approved pattern for handling secrets
- defining rate limiting or resource usage policies
- creating an audit or compliance control
- documenting operational boundaries

Suggested prefix: `CTRL-[PROJECT]-*`

---

### Architecture Decision Support

Work that documents an architectural decision or explores an architectural question before a decision is made.

Use when:
- formalizing an architectural choice that was made implicitly
- documenting the rationale for a structural decision
- evaluating architectural options before committing

Suggested prefix: `ADR-[PROJECT]-*`

---

### Documentation / Workflow Refinement

Work that improves documentation, checklists, runbooks, or operating conventions without changing system behavior.

Use when:
- updating a runbook or checklist
- improving a template or guide
- clarifying an ambiguous convention
- adding missing documentation for an existing feature

Suggested prefix: `DOC-[PROJECT]-*` or no prefix

---

## When To Reuse Platform Taxonomy

If this project is **platform-integrated**, use the same prefix scheme as `home-mcp-lab`:

| Prefix | Scope |
|---|---|
| `CC-[PROJECT]-*` | Claude Code implementation prompts / features |
| `VG-[PROJECT]-*` | Visibility gaps |
| `CTRL-[PROJECT]-*` | Control pattern definitions |
| `ADR-[PROJECT]-*` | Architecture Decision Records |
| `TD-[PROJECT]-*` | Technical debt |

This preserves cross-project traceability within the MCP ecosystem.

---

## When To Define a Local Namespace

If this project is **adjacent** or **standalone**, it may define a simpler or different local issue namespace.

Rules for local namespaces:
- Must include a project-specific prefix to avoid collision (e.g., `CC-MYPROJ-*` not just `CC-*`)
- Must be documented in the primer and boot block
- Should follow the same structural conventions (numeric sequence, type prefix) even if names differ
- Should not silently diverge from platform taxonomy if the project may later integrate with the platform

---

## Issue Naming Conventions

Recommended title pattern:

```
[TYPE-ID] Short descriptive title
```

Examples:
- `CC-MYPROJ-000001 Initialize project structure and primer`
- `VG-MYPROJ-000001 MCP tool call visibility gap`
- `TD-MYPROJ-000003 Remove duplicate config loading logic`

For repos that do not use prompt-ID taxonomy, plain descriptive titles are acceptable:

```
Add MCP node transport configuration
Fix: session handoff template missing correlation ID field
Docs: update repo setup checklist for label creation step
```

---

## Issue Body Conventions

Each issue should include enough context for someone to pick it up and execute it without needing to ask. Aim for:

- **Summary** — one sentence describing the work
- **Objective** — what will be true when this is done
- **Rationale** — why this matters now
- **Scope** — what is in and out of scope
- **Acceptance criteria** — how to know it is done
- **Dependencies** — any prerequisites or blocking issues

See `issue-templates/` for starter templates.
