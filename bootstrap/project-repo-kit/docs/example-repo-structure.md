# Example Repo Structure

Recommended directory layout for a new MCP-governed project repository.

---

## Required Structure

```
[repo-root]/
├── README.md                          # Project overview
├── chatgpt-primer.md                  # Session primer (adapted from template)
├── CLAUDE.md                          # Claude Code boot block and project instructions
├── .gitignore                         # Adapted from .gitignore.template
├── .editorconfig                      # Cross-editor consistency
├── project-metadata.yaml              # Machine-readable project identity
│
├── handoffs/
│   ├── README.md                      # Handoff system guidance
│   ├── HANDOFF-TEMPLATE.md            # Template for new handoffs
│   └── handoff-[TASK-ID].md          # Session handoffs (created over time)
│
├── context/
│   └── workflow-rules.md              # Role model and operating conventions
│
└── .github/
    └── pull_request_template.md       # PR template
```

---

## Optional: MCP Node

```
[repo-root]/
└── mcp-node/
    ├── README.md                      # MCP node guidance
    ├── project-node.json              # Adapted from project-node.template.json
    └── src/                           # MCP server implementation
        └── server.js                  # (or server.py, etc.)
```

Include when: the project has an MCP server.

---

## Optional: Docs

```
[repo-root]/
└── docs/
    ├── adr/                           # Architecture Decision Records (ADR-[PROJECT]-*)
    ├── visibility-gaps/               # Visibility gap register (VG-[PROJECT]-*)
    ├── controls/                      # Control pattern definitions (CTRL-[PROJECT]-*)
    └── runbooks/                      # Operational runbooks and procedures
```

Include when: the project accumulates architectural decisions, visibility gaps, or control patterns.

---

## Optional: Schemas

```
[repo-root]/
└── schemas/
    └── [schema-name].schema.json      # Data or event schemas
```

Include when: the project defines or owns event schemas or data contracts.

---

## Optional: Source

```
[repo-root]/
└── src/
    └── [module-name]/                 # Project implementation code
```

Include when: the project has implementation code beyond the MCP server.

---

## Optional: Outputs / Assets

```
[repo-root]/
└── outputs/                           # Generated artifacts, processed content
```

Include when: the project produces files or content as its primary output.

---

## Notes

- `handoffs/` and `context/` are required — they are the structural backbone of the workflow model
- `docs/` is optional but strongly recommended once the project has more than one architectural decision
- `schemas/`, `src/`, and `outputs/` are project-type dependent
- `mcp-node/` is only needed if the project runs an MCP server
- Do not create directories until they are needed — start lean and grow as the project requires
