# 005. Add Style Guide Guard to All Design-Making Skills

Date: 2026-05-19

## Status

Accepted

## Context

The software factory uses a style guide to enforce consistent architectural and design patterns. Without a guard in every design-making skill (`/interview`, `/prd`, `/decompose`), those upstream skills can propose patterns that contradict the established style guide. Constraining only implementation skills (`/tdd`, `/implement`) would allow contradictions to enter the design artifacts unchallenged — partial adoption defeats the purpose of having a style guide at all.

## Decision

All six factory skills (`/interview`, `/prd`, `/decompose`, `/tdd`, `/implement`, `/review`) will read the project's style guide before starting and treat every recorded rule as a hard constraint for UI-related decisions — unless the current work is explicitly superseding an entry.

## Consequences

Design artifacts produced by `/interview`, `/prd`, and `/decompose` will be consistent with the style guide from the start, reducing friction and rework in downstream implementation. Implementation and review skills apply the same constraints, making the style guide a single source of truth across the entire factory pipeline. Skills must be updated to include a style-guide-read step at the top of their procedure.

## Alternatives Considered

Applying the style guide guard only in `/decompose` and `/implement` was considered. This was rejected because upstream skills (`/interview`, `/prd`) would still be free to propose patterns that contradict the style guide, requiring manual correction before or during decomposition.

Applying the guard only to design-making skills (`/interview`, `/prd`, `/decompose`) was the original decision. This was superseded because `/tdd`, `/implement`, and `/review` also make UI-affecting choices and must be constrained by the same rules to prevent contradictions from entering the codebase during implementation or passing unnoticed in review.
