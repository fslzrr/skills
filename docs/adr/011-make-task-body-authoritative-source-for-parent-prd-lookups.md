# 011. Make TASK Body the Authoritative Source for Parent-PRD Lookups

Date: 2026-06-02

## Status

Accepted

## Context

The `/issues` status-dashboard renders each open TASK with a `[PRD #N]` (or `[no PRD]`) annotation showing the TASK's parent PRD. Two independent records of this TASK→parent-PRD relationship exist in the data model:

- The TASK's own body has a `## Parent PRD` section, populated by `/decompose` from the TASK template (see `skills/issues/templates/task.md`).
- The parent PRD's issue comments include a `Created child TASKs: #50, #51` entry, posted by `/decompose` after creating each batch of child TASKs. This comment is already used by the dashboard's `PRDs ready to close` check to determine whether every named child is closed.

The two records are written at different times by different procedures and can disagree. The most common divergence cases are (a) a TASK added after the original `/decompose` run — its `## Parent PRD` is set, but the PRD's "Created child TASKs:" comment was not amended — and (b) a TASK whose body is hand-edited to point at a different parent. Any consumer that needs to look up a TASK's parent must choose one source as authoritative.

## Decision

For any operation that needs to look up a TASK's parent PRD (e.g. the dashboard's `[PRD #N]` annotation introduced under PRD #100), the source of truth is the TASK body's `## Parent PRD` section. Consumers fetch the body (typically via `--json body` on `gh issue list`) and parse the first `#N` reference inside that section.

The PRD-side `Created child TASKs:` comment remains in use only for the reverse direction — answering "is this PRD complete?" by checking whether every named child is closed. The two existing lookup paths are not unified; they answer different questions and do not need to share a source.

## Consequences

- Skills and scripts needing a TASK's parent fetch the body and parse `## Parent PRD`. No reverse-mapping from PRD comments is required for this direction.
- TASKs added after the initial `/decompose` run, or re-parented by hand, are handled correctly without requiring `/decompose` to amend the PRD's "Created child TASKs:" comment.
- The dashboard's existing `PRDs ready to close` logic is unchanged. It continues to parse the PRD comment, because that path answers a different question and the TASK-body path is not a substitute for it.
- A TASK whose body has no `## Parent PRD` reference (or contains no `#N` in that section) is treated as an orphan by any consumer of this lookup — it surfaces as `[no PRD]` in the dashboard. Data-quality enforcement (e.g. linting orphan TASKs) is intentionally not part of this decision and is left to a future dedicated procedure if needed.
- Future skills that need parent-PRD information follow the same rule: read the TASK body, parse `## Parent PRD`, treat absence as orphan. The PRD-comment path is reserved for the children-completion question.

## Alternatives Considered

- **Reverse-mapping from each PRD's `Created child TASKs:` comment.** Cheaper — the dashboard already fetches comments for its ready-to-close check, so no extra payload (`body`) would be required. Rejected because it misses every TASK added outside `/decompose`'s comment-writing flow (manually created TASKs, TASKs added in later decompose runs that did not amend the original comment), making the lookup inaccurate exactly where divergence is most likely.
- **Cross-checking both sources and emitting consistency warnings when they disagree.** Rejected as overkill for the dashboard's reporting role; consistency enforcement conflates "show state" with "police data quality" and belongs in a dedicated `check-consistency` procedure if and when one is added.
