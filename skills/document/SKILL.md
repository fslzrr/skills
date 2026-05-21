---
name: document
description: "Drafts a Nygard-format ADR or a style guide entry from a TASK issue, presents it for human confirmation, writes it to the appropriate docs/ directory, and handles supersession. TRIGGER when: user says 'document this decision', 'write an ADR', 'draft an ADR', 'create an ADR', 'write a style guide entry', or /implement is working on an ADR-labeled or style-guide-labeled TASK."
---

Draft documentation from a TASK issue, present it for human confirmation, write it to the appropriate `docs/` directory, and update any superseded document.

## Prerequisites

This skill is typically invoked from `/implement` with the TASK already in context. If invoked standalone, you need the TASK issue number — ask for it if not provided.

## Label-type branching

Before any other step, check the TASK's labels:

- If the TASK has the **`adr`** label → follow the **ADR flow** (Steps A1–A5 below).
- If the TASK has the **`style-guide`** label → follow the **Style guide entry flow** (Steps S1–S8 below).

If neither label is present, ask the human which flow to use before continuing.

---

## ADR flow (label: `adr`)

### A1. Read the TASK issue

The TASK issue body is already in context. Extract from it:

- **Decision name**: the human-readable name of the architectural decision (derive from the issue title if not explicit in the body)
- **Rationale**: why this decision is being made — look for a "Rationale", "Why", or "Decision" section in the body
- **Alternatives pointer**: a reference to alternatives considered — look for an "Alternatives" section or a link to another issue/document
- **Supersession pointer**: whether this ADR supersedes an existing one — look for a "Supersedes" field referencing an ADR number (e.g. `Supersedes: 003`)

If the TASK body is not in context, fetch it with `gh issue view <number> --json title,body,labels`.

If any of these fields are absent or ambiguous, ask the human one targeted question before continuing. Do not guess.

### A2. Determine the next ADR number

List the files in `docs/adr/`:

```bash
ls docs/adr/ 2>/dev/null
```

- If the directory does not exist or is empty, the next number is `001`.
- Otherwise, find the highest existing three-digit prefix (e.g. `003-some-title.md` → `003`) and increment by one. The next number must always be zero-padded to three digits (e.g. `004`).

### A3. Draft the Nygard ADR and present for review

Load the skeleton from [templates/adr.md](templates/adr.md), populate each field using the values extracted in Step A1 and the number from Step A2, and use today's date for the `Date` field.

- Use today's date for the `Date` field.
- If an **Alternatives pointer** was found in Step A1, append an `## Alternatives Considered` section after `Consequences`. If the pointer is a link or issue reference, include it as-is. If the pointer is inline content in the TASK body, summarise it. Do not invent alternatives that are not present in the TASK body.
- If a **Supersession pointer** was found in Step A1, keep `Status` as `Accepted` and add `Supersedes [NNN-old-slug](NNN-old-slug.md)` on a second line under Status. The old ADR is updated in Step A5.

Present the full draft to the human. Say: "Here is the ADR draft. Confirm to write it, or request changes."

Wait for explicit confirmation. If the human requests changes, apply them and show the updated draft. Repeat until confirmed.

### A4. Write the ADR file

1. If `docs/adr/` does not exist, create it:
   ```bash
   mkdir -p docs/adr/
   ```

2. Derive the kebab-case slug from the decision name (lowercase, spaces and special characters replaced with hyphens). For example, `Use PostgreSQL for Storage` → `use-postgresql-for-storage`.

3. Write the confirmed ADR content to:
   ```
   docs/adr/NNN-kebab-slug.md
   ```

4. Confirm the file was written by showing its path to the human.

### A5. Handle supersession (if applicable)

If a **Supersession pointer** was found in Step A1:

1. Identify the old ADR file in `docs/adr/` by its number (e.g. `Supersedes: 003` → find `docs/adr/003-*.md`).
2. Open the old ADR file and locate its `## Status` section.
3. Replace the current status value with:
   ```
   Superseded by [NNN-new-slug](NNN-new-slug.md)
   ```
   where `NNN` and `new-slug` refer to the ADR just written in Step A4.
4. Write the updated file back. Do not change any other content in the old ADR.
5. Confirm the supersession update to the human by showing the old file path and the new Status line.

---

## Style guide entry flow (label: `style-guide`)

### S1. Extract from the TASK body

The TASK issue body is already in context. Extract from it:

- **Entry name**: the human-readable name of the component or pattern (derive from the issue title if not explicit in the body)
- **Rationale**: why this style decision or component pattern is being established — look for a "Rationale", "Why", or "Decision" section in the body
- **Supersession pointer**: whether this entry supersedes an existing style guide entry — look for a "Supersedes" field referencing a slug (e.g. `Supersedes: button`)

If the TASK body is not in context, fetch it with `gh issue view <number> --json title,body,labels`.

If any of these fields are absent or ambiguous, ask the human one targeted question before continuing. Do not guess.

### S2. Read the approved prototype (if applicable)

Inspect the TASK body for a reference to a linked implementation TASK (e.g. "See TASK #N", "Parent implementation: #N", or a GitHub issue link). If such a reference exists:

1. Fetch the linked TASK with `gh issue view <N> --json title,body`.
2. Look for a fenced code block in that TASK's body that immediately follows a heading or label containing the word "prototype" or "approved" (typically an HTML snippet). If multiple fenced code blocks exist, prefer the one closest to such a label.
3. Extract that code block for use in the HTML example section of the draft.

If no linked implementation TASK is referenced, or if the TASK is decision-only with no prototype, **omit the HTML example section entirely** — do not invent one.

### S3. Determine the write path

Derive the kebab-case slug from the entry name (lowercase, spaces and special characters replaced with hyphens). For example, `Primary Button` → `primary-button`.

The target file is:
```
docs/style-guide/[slug]/index.md
```

### S4. Draft the style guide entry and present for review

Load the skeleton from [templates/style-guide.md](templates/style-guide.md) and populate each section using the values extracted in Steps S1–S2 and the slug from Step S3:

- Use today's date for the `Date` field.
- Populate **Overview** from the rationale and any description in the TASK body.
- Populate **Design tokens**, **States**, and **Usage rules** from the TASK body. Do not invent values not present in the TASK body or confirmed by the human.
- If a **Supersession pointer** was found in Step S1, add `Supersedes [old-slug](../old-slug/index.md)` on a second line under `## Status`. The old entry is updated in Step S8.
- If an approved prototype was found in Step S2, include the `## HTML example` section with the extracted code block. If no prototype was found, omit the `## HTML example` section entirely.

Present the full draft to the human. Say: "Here is the style guide entry draft. Confirm to write it, or request changes."

Wait for explicit confirmation. If the human requests changes, apply them and show the updated draft. Repeat until confirmed.

### S5. Create directory if needed

If `docs/style-guide/[slug]/` does not exist (whether because the top-level directory is missing or the slug subdirectory has not been created yet), run:

```bash
mkdir -p docs/style-guide/[slug]/
```

### S6. Structural validation before write

Before writing, verify that the confirmed draft contains both of the following required sections:

- `## Status`
- `## Overview`

All other sections (Design tokens, States, Usage rules, HTML example) are optional and may be omitted when they do not apply to the entry.

Also verify:

- `## HTML example` is present **only if** an approved prototype was found in Step S2. If an HTML example section appears but no prototype was found, surface the error and do not write.
- If Status or Overview is missing, state which section is missing and do not write the file. Ask the human to supply the missing content before retrying.

### S7. Write the file

Write the confirmed draft to:

```
docs/style-guide/[slug]/index.md
```

Confirm the path to the human.

### S8. Handle supersession (if applicable)

If a **Supersession pointer** was found in Step S1:

1. Derive the old slug from the supersession pointer value.
2. Identify the old entry file at `docs/style-guide/[old-slug]/index.md`.
3. Open the old entry file and locate its `## Status` section.
4. Update the status line to read:
   ```
   Superseded by [new-slug](../new-slug/index.md)
   ```
   where `new-slug` is the slug of the entry just written in Step S7.
5. Do not change any other content in the old entry.
6. Confirm the supersession update to the human by showing the old file path and the new Status line.

---

## Hard rules

- Never write the ADR file without explicit human confirmation of the draft.
- Never write a style guide entry without explicit human confirmation of the draft.
- Never modify any file other than the target ADR and the superseded ADR (if applicable) when in the ADR flow.
- Never modify any file other than the target style guide entry and the superseded entry (if applicable) when in the style guide entry flow.
- Never invent rationale, alternatives, or consequences for an ADR that are not present in the TASK body or confirmed by the human.
- Never invent rationale, design tokens, or usage rules for a style guide entry that are not present in the TASK body or confirmed by the human.
- Never include the HTML example section in a style guide entry unless a prototype was found in a linked TASK.
- If `docs/adr/` contains files that do not follow the `NNN-slug.md` naming pattern, ignore them when determining the next number.
