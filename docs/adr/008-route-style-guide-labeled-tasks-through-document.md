# 008. Route style-guide-labeled TASKs through /document

Date: 2026-05-19

## Status

Accepted

## Context

The factory already routes `adr`-labeled TASKs to `/document`, which owns the draft-confirm-write-supersede lifecycle for ADR prose. Style guide entries require the same lifecycle: draft from a template, present for human confirmation, write to `docs/style-guide/`, and handle supersession. Two parallel documentation types with the same authoring flow create a choice: implement the flow twice (once in `/implement`, once somewhere else) or centralize it.

## Decision

`/implement` routes `style-guide`-labeled TASKs to `/document`, parallel to the existing `adr` routing. `/document` branches on label type at the start: `adr` label triggers the Nygard ADR flow; `style-guide` label triggers the new style guide entry flow. All documentation authoring is centralized in `/document`.

## Consequences

The draft-confirm-write-supersede pattern is implemented once and reused for both ADRs and style guide entries. `/implement` gains a second label-based routing branch but no new authoring logic. `/document` becomes the single skill responsible for all structured documentation output. Adding a third documentation type in the future follows the same pattern without touching `/implement`'s core TDD loop.

## Alternatives Considered

Authoring style guide entries inline within `/implement` was considered. This was rejected because it duplicates the document-authoring logic already present in `/document` and violates single responsibility — `/implement` orchestrates TDD cycles and should not also own documentation prose authoring.
