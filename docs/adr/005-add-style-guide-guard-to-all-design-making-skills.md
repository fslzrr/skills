# 005. Add Style Guide Guard to All Design-Making Skills

Date: 2026-05-19

## Status

Accepted

## Context

The software factory uses a style guide to enforce consistent architectural and design patterns. Without a guard in every design-making skill (`/interview`, `/prd`, `/decompose`), those upstream skills can propose patterns that contradict the established style guide. Constraining only implementation skills (`/tdd`, `/implement`) would allow contradictions to enter the design artifacts unchallenged — partial adoption defeats the purpose of having a style guide at all.

## Decision

All design-making skills (`/interview`, `/prd`, `/decompose`) will read the project's style guide before generating any proposals and treat every recorded rule as a hard constraint on their output.

## Consequences

Design artifacts produced by `/interview`, `/prd`, and `/decompose` will be consistent with the style guide from the start, reducing friction and rework in downstream implementation. The style guide becomes a single source of truth across the entire factory pipeline, not just the implementation phase. Skills must be updated to include a style-guide-read step at the top of their procedure.

## Alternatives Considered

Applying the style guide guard only in `/decompose` and `/implement` was considered. This was rejected because upstream skills (`/interview`, `/prd`) would still be free to propose patterns that contradict the style guide, requiring manual correction before or during decomposition.
