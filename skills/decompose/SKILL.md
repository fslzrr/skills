---
name: decompose
description: "(fslzrr) Breaks a PRD into vertical-slice TASKs by grouping user stories that share the same end-to-end context, proposes the breakdown with rationale for human approval, then creates the approved TASKs as child GitHub issues. TRIGGER when: user says 'decompose the PRD', 'break into tasks', 'create tasks for issue #N', 'split this into tasks'."
---

Break a PRD into vertical-slice TASKs, propose the decomposition for human approval, then create the TASK issues on GitHub.

## Prerequisites

You need a PRD issue number. If not provided, ask for it.

## ADR guard

Before making decomposition decisions, read `docs/adr/` once per session:

- If the directory does not exist or is empty, proceed without constraints.
- If ADRs exist, treat every recorded decision as a hard constraint. Do not propose, implement, or accept approaches that contradict them.

## Steps

### 1. Read the PRD

Use `/issues` to read the full PRD content. Pay close attention to:
- User Stories (the primary input for decomposition)
- Acceptance Criteria or Testing Decisions (these inform TASK acceptance criteria)
- Out of Scope (ensure no TASK crosses this boundary)
- Dependencies (some TASKs may be blocked by these)
- **Identified ADRs** (each entry becomes one ADR TASK — see step 5)

### 2. Group user stories into vertical slices

Group user stories by **vertical context** — stories that, together, form a complete end-to-end slice through the system belong in the same TASK. A vertical slice must:
- Be independently deployable and testable without depending on other TASKs being done first
- Touch all necessary layers (data, logic, API, UI) to deliver observable value
- Be small enough to be implemented in one focused session

Do not create one TASK per user story. Group related stories that share the same vertical path through the system.

### 3. Propose the TASK list

Present the proposed decomposition to the human. For each TASK:
- **Title**: must follow conventional commits format — `type(scope): description` or `type: description`. Use the full vocabulary: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `build`, `ci`, `revert`. Scope is optional but encouraged when the TASK targets a single skill or module. ADR TASKs always use `docs(adr): description` — no judgment needed.
- **User stories covered**: list which user stories from the PRD are included
- **Why grouped**: explain the vertical context these stories share — what makes them one slice
- **Draft acceptance criteria**: specific, testable conditions derived from the included user stories
- **Dependencies**: other TASks that need to be completed to implement the current TASK
- **Suggested implementor**: `ai-ready` or `human-ready`, with a reason

Say: "Here is my proposed TASK breakdown. Review each grouping and let me know if you want to split, merge, reorder, or change implementor types before I create the issues."

Wait for explicit approval. Apply any requested changes and re-show the affected TASKs if modified.

### 4. Create the TASK issues

Once approved, for each TASK:

Use `/issues` to create a child issue with:
- **Labels**: `task` and `ai-ready` or `human-ready` (as approved)
- **Body**: TASK template populated with the approved content
- **Parent PRD**: reference the PRD issue number in the "Parent PRD" section

**TASK template:**
```markdown
## Context
<!-- Why this TASK exists within the parent PRD -->

## Goal
<!-- What this specific vertical slice achieves -->

## Acceptance Criteria
<!-- Specific, testable conditions — each becomes one SUBTASK in /implement -->

## Blockers / Dependencies
<!-- Other TASKs that must complete before this one -->

## Parent PRD
<!-- Link to parent PRD issue -->

## Testing Approach
<!-- How this slice is tested end-to-end -->

## Affected Areas
<!-- Files, modules, systems this TASK touches -->
```

### 5. Create ADR TASK issues

If the PRD contains an **Identified ADRs** section, create one TASK issue per entry in that section:

- **Labels**: `task,adr,ai-ready` (or `human-ready` if a human should author it)
- **Body**: copy the ADR entry verbatim from the PRD into the task body — do not expand, interpret, or rewrite it; `/document` owns all content drafting
- **Parent PRD**: reference the PRD issue number in the "Parent PRD" section

Use `/issues` to create each ADR TASK issue.

### 6. Post the child-registry summary comment

After all TASKs (regular and ADR) are created, collect every TASK number and title produced in steps 4 and 5. Post a single comment on the PRD issue:

```bash
gh issue comment <PRD-number> --body "Created child TASKs:
- #N title
- #M title"
```

List every created TASK — ARD TASKs first, then regular TASKs — in the order they were created.

### 7. Update the PRD state

After all TASKs are created, use `/issues` to transition the PRD from `in-backlog` to `in-progress`.

Report the list of created TASK issue numbers and URLs to the human.
