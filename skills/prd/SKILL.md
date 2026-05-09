---
name: prd
description: "(fslzrr) Explores the codebase deeply, then structures confirmed /interview findings into a PRD GitHub issue — mapping interview narrative to template sections, identifying modules to build or modify, and surfacing deepening opportunities. TRIGGER when: user says 'create a PRD', 'write the PRD', 'turn this into a PRD', 'publish the spec', or when /interview has just produced a confirmed summary."
---

Structure the confirmed findings from a `/interview` session into a PRD and publish it as a GitHub issue. You own the structuring responsibility — `/interview` discovers, you impose the template. Before structuring anything, you explore the codebase deeply so the PRD is grounded in what actually exists.

## Prerequisites

This skill requires a confirmed `/interview` narrative summary. If you do not have one in the current conversation, tell the human to run `/interview` first.

## Steps

### 1. Explore the codebase

Before writing a single line of the PRD, explore the codebase extensively:

- **Map the architecture**: identify the major modules, what each one is responsible for, and what its interface looks like from the outside.
- **Find every module relevant to the solution**: what can be used as-is, what needs to be extended, what needs to be replaced or built from scratch.
- **Sketch the module changes**: for each affected module, note whether it needs to be created, modified, or left alone.
- **Hunt for deepening opportunities** (A Philosophy of Software Design): actively look for modules where the interface is wider than it needs to be, where implementation details are leaking upward, or where complexity is sitting at the wrong layer. Note specifically where the solution could simplify these — delivering the feature while leaving the codebase better than you found it.

This exploration directly feeds the `Implementation Decisions` section of the PRD.

### 2. Draft the PRD

Map the interview narrative and codebase findings to each section of the PRD template.

- If the interview clearly covers a section, populate it from the findings.
- If the interview only partially covers it, fill what you can and ask the human one targeted follow-up question.
- If the interview does not cover it at all, mark it as `TBD — not discussed`.
- The `Implementation Decisions` section must name specific modules to touch, call out deepening opportunities found, and justify architectural choices against what already exists in the codebase.

Do not ask multiple follow-up questions at once. Resolve gaps one at a time.

**PRD template:**

```markdown
## Context
<!-- Why does this exist? What prompted it? -->

## Problem Statement
<!-- What specific problem is being solved? -->

## Solution
<!-- Proposed approach -->

## User Stories
<!-- As a [user], I want [goal] so that [reason] -->

## Implementation Decisions
<!-- Key technical/architectural choices -->

## Testing Decisions
<!-- How we know this works at the PRD level -->

## Out of Scope
<!-- Explicit exclusions to prevent scope creep -->

## Alternatives Considered
<!-- Why this approach over others -->

## Risks & Mitigations
<!-- What could go wrong and how to handle it -->

## Dependencies
<!-- Other PRDs or external systems required before implementation -->

## Further Notes
<!-- Anything else relevant -->
```

### 2. Show the draft to the human

Present the fully populated PRD draft. Say: "Here is the PRD draft based on our interview. Review it and confirm it is correct before I publish it to GitHub. You can request edits to any section."

Wait for explicit confirmation. If the human requests changes, apply them and show the updated draft. Repeat until confirmed.

### 3. Publish to GitHub

Once confirmed, use `/issues` to create the GitHub issue:
- **Title**: a concise, descriptive title derived from the Problem Statement (not the Solution)
- **Body**: the confirmed PRD content
- **Labels**: `prd` and `needs-triage`

Report the created issue number and URL to the human.
