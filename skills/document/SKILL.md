---
name: document
description: "(fslzrr) Drafts a Nygard-format ADR from a TASK issue, presents it for human confirmation, writes it to docs/adr/, and handles supersession. TRIGGER when: user says 'document this decision', 'write an ADR', 'draft an ADR', 'create an ADR', or /implement is working on an ADR-labeled TASK."
---

Draft a Nygard-format ADR from a TASK issue, present it for human confirmation, write it to `docs/adr/`, and update any superseded ADR.

## Prerequisites

You need a TASK issue number for the decision to document. If not provided, ask for it.

## Steps

### 1. Read the TASK issue

The TASK issue body is already in context. Extract from it:

- **Decision name**: the human-readable name of the architectural decision (derive from the issue title if not explicit in the body)
- **Rationale**: why this decision is being made — look for a "Rationale", "Why", or "Decision" section in the body
- **Alternatives pointer**: a reference to alternatives considered — look for an "Alternatives" section or a link to another issue/document
- **Supersession pointer**: whether this ADR supersedes an existing one — look for a "Supersedes" field referencing an ADR number (e.g. `Supersedes: 003`)

If the TASK body is not in context, fetch it with `gh issue view <number> --json title,body,labels`.

If any of these fields are absent or ambiguous, ask the human one targeted question before continuing. Do not guess.

### 2. Determine the next ADR number

List the files in `docs/adr/`:

```bash
ls docs/adr/ 2>/dev/null
```

- If the directory does not exist or is empty, the next number is `001`.
- Otherwise, find the highest existing three-digit prefix (e.g. `003-some-title.md` → `003`) and increment by one. The next number must always be zero-padded to three digits (e.g. `004`).

### 3. Draft the Nygard ADR and present for review

Using the fields extracted in Step 1 and the number from Step 2, compose the ADR in Nygard format:

```markdown
# NNN. Decision Name

Date: YYYY-MM-DD

## Status

Accepted

## Context

<Why this decision is needed. What forces are at play. Derived from the Rationale field.>

## Decision

<The decision that was made, stated clearly and directly.>

## Consequences

<What becomes easier or harder as a result. Trade-offs, follow-up work, risks.>
```

- Use today's date for the `Date` field.
- If an **Alternatives pointer** was found in Step 1, append an `## Alternatives Considered` section after `Consequences`. If the pointer is a link or issue reference, include it as-is. If the pointer is inline content in the TASK body, summarise it. Do not invent alternatives that are not present in the TASK body.
- If a **Supersession pointer** was found in Step 1, keep `Status` as `Accepted` and add a note `Supersedes NNN-old-slug` on a second line under Status. The old ADR is updated in Step 5.

Present the full draft to the human. Say: "Here is the ADR draft. Confirm to write it, or request changes."

Wait for explicit confirmation. If the human requests changes, apply them and show the updated draft. Repeat until confirmed.

### 4. Write the ADR file

### 5. Handle supersession (if applicable)

## Hard rules
