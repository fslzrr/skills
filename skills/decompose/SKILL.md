---
name: decompose
description: "Breaks a PRD into vertical-slice TASKs by grouping user stories that share the same end-to-end context, proposes the breakdown with rationale for human approval, then creates the approved TASKs as child GitHub issues. TRIGGER when: user says 'decompose the PRD', 'break into tasks', 'create tasks for issue #N', 'split this into tasks'."
allowed-tools:
  - Bash(gh issue create:*)
  - Bash(gh issue view:*)
  - Bash(gh issue edit:*)
  - Bash(gh issue comment:*)
  - Bash(rm /tmp/prototype-*.html)
---

Break a PRD into vertical-slice TASKs, propose the decomposition for human approval, then create the TASK issues on GitHub.

## Prerequisites

You need a PRD issue number. If not provided, ask for it.

## ADR guard

Before starting, read `docs/adr/` once per session:

- If the directory does not exist or is empty, proceed without constraints.
- If ADRs exist, treat every recorded decision as a hard constraint. Do not propose, implement, or accept approaches that contradict them.

## Style guide guard

Before starting, read `docs/style-guide/` once per session:

- If the directory does not exist or is empty, proceed without constraints.
- If entries exist, treat every documented pattern as a hard constraint for UI-related decisions — unless the current work is explicitly superseding an entry.

## Steps

### 1. Read the PRD

Use `/issues` to read the full PRD content. Pay close attention to:
- User Stories (the primary input for decomposition)
- Acceptance Criteria or Testing Decisions (these inform TASK acceptance criteria)
- Out of Scope (ensure no TASK crosses this boundary)
- Dependencies (some TASKs may be blocked by these)
- **Identified ADRs** (each entry becomes one ADR TASK — see step 6)

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

### 4. Generate prototypes for UI stories

For each proposed TASK in the approved list, determine whether it covers a UI story that introduces or modifies a visual component or pattern. A TASK qualifies if it involves any of the following:

- A new visual component (e.g., a new widget, card, modal, or page section)
- A modified visual component (e.g., a changed layout, updated states, or restyled element)
- A new design token (e.g., a new color, spacing value, or typography scale entry)
- A layout behavior change (e.g., a shift in grid structure, responsive breakpoints, or element arrangement)
- Any other visually observable UI change that the explicit criteria above do not cover — use judgment

If no TASK qualifies, skip this step and continue to step 5.

For each qualifying TASK, generate a self-contained HTML/CSS prototype that visually represents the component or pattern. The prototype must:
- Render the component in isolation with enough surrounding structure to be readable in a browser
- Use only inline `<style>` and standard HTML — no external dependencies
- Reflect the intent of the acceptance criteria (states, variants, layout) as faithfully as possible

Write each prototype to `/tmp/prototype-[component].html`, where `[component]` is a kebab-case name derived from the component being designed (e.g., `/tmp/prototype-filter-sidebar.html`).

#### Approval gate (repeat for each prototype)

After writing the prototype file, pause and tell the human:

> "Prototype written to `/tmp/prototype-[component].html`. Open that file in a browser to review the visual design, then reply **approve** or describe the changes you want."

Wait for one of two responses:

- **Approval** — the human replies with "approve" or equivalent confirmation.
  1. Store the full HTML content of the prototype to be embedded in the TASK body when the issue is created in step 5. The content will be inserted as a fenced HTML code block (` ```html … ``` `) inside the "Prototype" section of the TASK body.
  2. Delete the temp file: `rm /tmp/prototype-[component].html`.
  3. Proceed to the next prototype, or continue to step 5 when all prototypes are approved.

- **Revision request** — the human describes changes they want.
  1. Update the prototype based on the feedback.
  2. Overwrite the temp file with the revised HTML.
  3. Loop back to the top of this approval gate: re-display the file path and ask for approval again.
  4. Repeat until the human approves.

Do not move to step 5 until every prototype generated in this step has been approved and its temp file deleted.

### 5. Create the TASK issues

Once approved, for each TASK:

Use `/issues` to create a child issue with:
- **Labels**: `task` and `ai-ready` or `human-ready` (as approved)
- **Parent PRD**: reference the PRD issue number in the "Parent PRD" section

**TASK template:** Read [../issues/templates/task.md](../issues/templates/task.md) and use it as the structural template for the issue body, filling in each section with the approved content. If step 4 produced an approved prototype for this TASK, fill in the `## Prototype` section with the approved HTML.

### 6. Create ADR TASK issues

If the PRD contains an **Identified ADRs** section, create one TASK issue per entry in that section:

- **Labels**: `task,adr,ai-ready` (or `human-ready` if a human should author it)
- **Body**: copy the ADR entry verbatim from the PRD into the task body — do not expand, interpret, or rewrite it; `/document` owns all content drafting
- **Parent PRD**: reference the PRD issue number in the "Parent PRD" section

Use `/issues` to create each ADR TASK issue.

### 7. Create style guide TASK issues

Using the style guide entries read during the style guide guard, for each UI TASK in the approved list — using the same detection criteria as step 4 (new component, modified component, new design token, layout behavior change, or LLM judgment for gaps) — evaluate whether the story introduces or modifies a style guide entry. Apply the following three-case logic:

- **Introduces a new entry**: the story brings a component or pattern that has no corresponding entry in `docs/style-guide/` → create a style guide TASK.
- **Modifies an existing entry**: the story changes a component or pattern that already has a corresponding entry in `docs/style-guide/` → create a style guide TASK.
- **Consumes an existing entry only**: the story uses an already-documented component or pattern without changing it → do NOT create a style guide TASK.

For each qualifying story, use `/issues` to create a separate TASK issue with:

- **Labels**: `task,style-guide,ai-ready` (or `task,style-guide,human-ready` if a human should author it)
- **Body**: briefly state what style guide entry needs to be authored or updated, and reference the parent TASK issue number and the parent PRD issue number
- **Parent PRD**: reference the PRD issue number in the "Parent PRD" section

### 8. Post the child-registry summary comment

After all TASKs (regular, ADR, and style guide) are created, collect every TASK number and title produced in steps 5, 6, and 7. Post a single comment on the PRD issue:

```bash
gh issue comment <PRD-number> --body "Created child TASKs:
- #N title
- #M title"
```

List every created TASK — regular TASKs first, then ADR TASKs, then style guide TASKs — in the order they were created.

### 9. Update the PRD state

After all TASKs are created, use `/issues` to transition the PRD from `in-backlog` to `in-progress`.

Report the list of created TASK issue numbers and URLs to the human.
