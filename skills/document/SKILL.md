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

### 3. Draft the Nygard ADR and present for review

### 4. Write the ADR file

### 5. Handle supersession (if applicable)

## Hard rules
