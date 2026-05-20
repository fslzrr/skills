# Label catalog

This file is the single source of truth for the 13 factory labels used by the `issues` skill. Consult it for label recovery — do not invent labels outside this catalog.

| name | color | description | purpose |
|---|---|---|---|
| `prd` | `8B5CF6` | Product Requirements Document | Marks an issue as a factory PRD deliverable |
| `task` | `EC4899` | Implementation task | Marks an issue as an implementation task derived from a PRD |
| `needs-triage` | `9CA3AF` | Awaiting triage | Initial state; signals the issue needs owner attention |
| `in-backlog` | `F97316` | Triaged, in backlog | Triaged and prioritized, waiting for a work slot |
| `in-progress` | `10B981` | Actively being worked on | Generic work-in-progress when assignee type is unspecified |
| `ai-ready` | `FCD34D` | Ready for AI implementation | Ready to hand off to an AI agent |
| `human-ready` | `FDE68A` | Ready for human implementation | Ready to hand off to a human developer |
| `ai-in-progress` | `34D399` | AI is implementing | An AI agent has picked up the work |
| `human-in-progress` | `6EE7B7` | Human is implementing | A human developer has picked up the work |
| `in-code-review` | `60A5FA` | PR open, awaiting review | Implementation done; PR is open and awaiting review |
| `blocked` | `EF4444` | Blocked by a dependency or issue | Work cannot proceed until an external dependency resolves |
| `cancelled` | `F87171` | Abandoned, not completed | Issue closed without being completed |
| `adr` | `2DD4BF` | Architecture Decision Record | Marks an Architecture Decision Record issue |
