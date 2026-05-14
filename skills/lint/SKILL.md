---
name: lint
description: "(fslzrr) Runs three ordered quality-gate buckets — format (fix + re-stage), lint (check-only → auto-fix → hard-stop), typecheck (project-wide → hard-stop) — each discovered independently from declared project scripts; notifies and skips missing buckets; fail-fast on hard-stop. Called by /implement between /tdd and /review. TRIGGER when: called by /implement after each SUBTASK, or user says 'run lint', 'lint the code', 'check lint', 'run format', 'typecheck'."
---

Detect and run the project's quality tooling on staged changes. Never invent tooling — only run commands the project has explicitly declared. Execute three ordered buckets: **format → lint → typecheck**. If any bucket produces a hard-stop, do not run subsequent buckets.

## Step 1 — Discover tooling

Scan the project's dependency manifests, script definitions, and build files (e.g. `scripts` in a package manager file, `Makefile` targets, `Taskfile` targets) for commands in three categories:

- **Format commands**: any declared formatter or explicit format/fix-mode variant
- **Lint commands**: any declared linter, plus its auto-fix variant if declared
- **Typecheck commands**: any declared type-checker

Use judgment to identify which commands belong to which category. Do not guess tool names — only use commands the project has explicitly declared.

## Bucket 1 — Format

*Never produces a hard-stop. If no format command is declared, emit "No format tooling detected — skipping." and continue to Bucket 2.*

1. Run the declared format command in fix mode. Pass the staged file paths as arguments if the formatter supports it; otherwise run it project-wide.
2. Identify any files the formatter changed (diff the working tree against the index after the run).
3. Re-stage all changed files: `git add <files changed by formatter>`.
4. Emit a one-line summary, e.g.: "Format applied and re-staged. Continuing."

## Bucket 2 — Lint

*If no lint command is declared, emit "No lint tooling detected — skipping." and continue to Bucket 3.*

1. Run each detected linter in check-only mode (no file mutations). Capture the full output.
   - If **all pass**: done with this bucket. Emit nothing. Continue to Bucket 3.
   - If **any fail**: proceed to step 2.
2. For each failing linter: if an auto-fix command exists, run it. If no auto-fix exists, leave it as-is.
3. Re-run the check-only command for every linter that was failing.
   - If **all pass**: proceed to step 4.
   - If **any still fail**: hard-stop (step 5).
4. Re-stage fixed files: identify files the auto-fix changed, then `git add <those files>`. Emit: "Lint auto-fixed and re-staged. Continuing to /review." Continue to Bucket 3.
5. **Hard-stop**: emit the full lint output for every linter still failing. Say: "Lint failed and could not be auto-fixed. Fix the violations above, then re-run `/lint` or signal readiness to continue." Do not proceed to Bucket 3.

## Bucket 3 — Typecheck

*No auto-fix step. If no typecheck command is declared, emit "No typecheck tooling detected — skipping." and return control to the caller.*

1. Run the declared type-checker against the **entire project** (not staged files only).
2. Capture the full output.
   - If it **passes**: done. Emit nothing. Return control to the caller.
   - If it **fails**: hard-stop. Emit the full typecheck output. Say: "Typecheck failed. Fix the type errors above, then re-run `/lint` or signal readiness to continue." Do not return control to the caller.

## Hard rules

**Discovery (all buckets)**
- Never run a command that is not explicitly declared in the project's scripts, dependency config, or build files. Do not assume a tool is installed just because its binary might exist on PATH.

**Format bucket**
- Always re-stage files the formatter changed. Never skip re-staging after a format run.

**Lint bucket**
- Never mutate files during the check-only run.
- Always re-stage files the auto-fix changed. Never skip re-staging after a successful auto-fix.
- Never proceed past a hard-stop without explicit human resolution.

**Typecheck bucket**
- Always run against the entire project, not staged files only.
- Never proceed past a hard-stop without explicit human resolution.
