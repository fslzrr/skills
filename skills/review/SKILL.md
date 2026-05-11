---
name: review
description: "(fslzrr) Reviews staged or specified code changes against a fixed core checklist (TDD, SOLID, DRY, naming, deep modules) plus adaptive extras based on the type of change, and produces a PASS/FAIL verdict with blocking and advisory findings. Can be used standalone or is called by /implement after each SUBTASK. TRIGGER when: user says 'review my changes', 'code review', 'review this', 'check my implementation', 'review the diff', or after any implementation work."
---

Review the staged or specified code changes and produce a structured verdict.

## ADR guard

Before reviewing, read `docs/adr/` once per session:

- If the directory does not exist or is empty, proceed without constraints.
- If ADRs exist, treat every recorded decision as a hard constraint. Flag any change that contradicts an ADR as a BLOCKING finding.

## What to review

If a path or diff is specified, review those changes. Otherwise, review all staged changes (`git diff --staged`).

## Fixed core checklist (apply to every review)

- **TDD**: Tests exist for the changed behavior. They cover the behavior, not the implementation. If this is a new behavior, tests should have been written before the implementation.
- **SOLID**:
  - Single Responsibility: each class/function/module has one reason to change
  - Open/Closed: behavior is extended via abstraction, not by modifying existing code
  - Liskov Substitution: subtypes are fully substitutable for their base types
  - Interface Segregation: interfaces are narrow and specific, not broad and general
  - Dependency Inversion: high-level modules depend on abstractions, not concretions
- **DRY**: No logic is duplicated. If the same logic appears twice, it should be extracted.
- **Naming**: Identifiers are clear and descriptive. No unexplained abbreviations. A reader unfamiliar with this code should understand intent from names alone.
- **No dead code**: No unused variables, functions, imports, or commented-out code.
- **Deep modules** (A Philosophy of Software Design): Modules expose simple interfaces while hiding complex internals. Abstractions do not leak implementation details. Complexity is pushed down, not up.

## Adaptive extras (apply based on what changed)

- **Auth / security code**: Check for injection vulnerabilities, exposed secrets, broken authentication patterns, missing authorization checks.
- **Data layer**: Check for unsafe migrations, N+1 query patterns, missing indexes on queried columns.
- **Public API**: Check for breaking changes to contracts, backwards compatibility, missing or changed response shapes.
- **UI / frontend**: Check for missing loading, error, and empty states. Check for accessibility (semantic HTML, ARIA labels, keyboard navigation).

## Output format

Produce your review in exactly this format:

```
BLOCKING:
- [Clear description of the issue and which principle or checklist item it violates]

ADVISORY:
- [Clear description of the improvement and why it would make the code better]

VERDICT: PASS | FAIL
```

- **BLOCKING** items must be fixed before this code is committed or merged.
- **ADVISORY** items are genuine improvements but do not block progress.
- **VERDICT** is FAIL if any BLOCKING items exist, PASS if there are zero BLOCKING items.
- If a section has no items, write `- none` under it.
- Do not soften blocking findings. If something violates a principle, say so directly.
