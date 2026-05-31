# @fslzrr skills

A Claude Code plugin that turns AI-assisted development into a repeatable software factory, taking you from a vague idea to a merged PR through interview → PRD → decomposition → TDD implementation → review.

I started this collection while figuring out how to leverage AI to *actually ship* software. I was hesitant for a long time, but once I started using it the workflow turned out to be pretty neat — these skills are what I ended up with.

## Prerequisites

- [Claude Code](https://claude.com/claude-code)
- [`gh` CLI](https://cli.github.com/), authenticated
- A git repository

## Installation

### From the CLI

```sh
claude plugin marketplace add fslzrr/skills
claude plugin install fslzrr@fslzrr-marketplace
```

### From inside Claude Code

```
/plugin marketplace add fslzrr/skills
/plugin install fslzrr@fslzrr-marketplace
```

## What's inside

### Skills

| Stage | Skill | Description |
| --- | --- | --- |
| Define | `/interview` | Conducts a relentless requirements interview — one question at a time with recommended answers and pushback — until a full shared understanding is confirmed and handed off to `/prd`. |
| Define | `/prd` | Explores the codebase deeply, then structures confirmed `/interview` findings into a PRD GitHub issue — mapping interview narrative to template sections, identifying modules to build or modify, and surfacing deepening opportunities. |
| Plan | `/decompose` | Breaks a PRD into vertical-slice TASKs by grouping user stories that share the same end-to-end context, proposes the breakdown with rationale for human approval, then creates the approved TASKs as child GitHub issues. |
| Build | `/implement` | Orchestrates the full TDD implementation loop for an `ai-ready` TASK — maps acceptance criteria to SUBTASKs, spawns the programmer/linter/reviewer subagents per SUBTASK, commits atomically, runs the full suite, then opens a PR after human approval. |
| Build | `/tdd` | Executes a single RED/GREEN/REFACTOR cycle for a described behavior — writes failing tests first, makes them pass with minimal code, then refactors cleanly. |
| Build | `/lint` | Runs three ordered quality-gate buckets — format (fix + re-stage), lint (check-only → auto-fix → hard-stop), typecheck (project-wide → hard-stop) — each discovered independently from declared project scripts; notifies and skips missing buckets; fail-fast on hard-stop. |
| Build | `/review` | Reviews staged or specified code changes against a fixed core checklist (TDD, SOLID, DRY, naming, deep modules) plus adaptive extras based on the type of change, and produces a PASS/FAIL verdict with blocking and advisory findings. |
| Document | `/document` | Drafts a Nygard-format ADR or a style guide entry from a TASK issue, presents it for human confirmation, writes it to the appropriate `docs/` directory, and handles supersession. |
| Ops | `/issues` | Manages GitHub issues for the software factory — creates, reads, updates, and lists PRD and TASK issues; transitions states via labels; shows a status dashboard; and recovers missing labels on demand during write operations. |

### Agents

The `programmer`, `linter`, and `reviewer` agents are subagents spawned by `/implement` during the TDD loop. They are not invoked directly — listing them here is so you know what's running inside `/implement`, not as commands to type yourself.

- **`programmer`** — Executes a single RED → GREEN → REFACTOR cycle for a described behavior — writes failing tests, makes them pass with the minimum implementation, then refactors cleanly.
- **`linter`** — Runs the project's declared quality tooling in three ordered buckets — format, lint, typecheck — re-staging files where appropriate and fail-fast on any hard-stop.
- **`reviewer`** — Reviews staged or specified code changes against a fixed core checklist (TDD, SOLID, DRY, naming, deep modules) plus adaptive extras based on the type of change.

## Getting started

The factory runs as a loop. Each step hands its output to the next.

1. **Have an idea.** Run `/interview` and answer questions until the spec is locked.
2. **Create the PRD.** The interview hands off to `/prd`, which opens a GitHub issue.
3. **Break it down.** Run `/decompose <PRD#>` to split the PRD into `ai-ready` TASK issues.
4. **Implement.** Run `/implement <TASK#>` to run the TDD loop and open a PR.
5. **Merge.** GitHub auto-closes the TASK on merge; when all TASKs close, the PRD auto-closes.

Use `/issues` at any point to see the factory's current state.
