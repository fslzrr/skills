---
name: lint
description: "(fslzrr) Detects and runs project lint tooling on staged changes — check-only first, auto-fix on failure, re-stage fixed files, hard-stop when lint cannot be resolved. Notifies user and skips when no tooling found. Called by /implement between /tdd and /review. TRIGGER when: called by /implement after each SUBTASK, or user says 'run lint', 'lint the code', 'check lint'."
---

Detect and run the project's lint tooling on staged changes. Never invent tooling — only run commands the project has explicitly declared.

## Step 1 — Detect tooling

Look at the project's dependency manifests, script definitions, and build files for any declared lint command or target. Good places to check: the `scripts` section of a package manager file, build file targets (e.g. a `lint` target in a `Makefile` or `Taskfile`), or a lint tool section in a dependency config.

Use your judgment — if the project has wired up a lint command, find it. Also check whether an auto-fix variant of that command exists (e.g. a `lint:fix` script alongside a `lint` script, or a `fix` target alongside a `lint` target).

Collect **all** lint commands found, not just one. Steps 2–6 will run each collected command in turn.

If **no lint command is found**: inform the user ("No lint tooling detected — skipping.") and return control to the caller immediately.

## Step 2 — Check-only run

Run each detected linter in check-only mode (no file mutations). Capture the full output for each.

- If **all linters pass**: done. Emit nothing. Return control to the caller.
- If **any linter fails**: proceed to Step 3.

## Step 3 — Auto-fix attempt

For each linter that failed:

1. If an auto-fix command exists for that linter: run it now.
2. If no auto-fix command exists for that linter: leave it as-is (it will be re-checked in Step 4 and will still fail).

## Step 4 — Re-check

Re-run the check-only command for every linter that was failing in Step 2.

- If **all pass**: proceed to Step 5.
- If **any still fail**: proceed to Step 6 (hard-stop).

## Step 5 — Re-stage fixed files

Stage only the files modified by the auto-fix run. To identify them, diff the working tree against the index before and after the fix, then add only the changed paths:

```bash
git diff --name-only   # run before auto-fix to capture the delta afterward
git add <files changed by auto-fix>
```

Emit a one-line summary, e.g.:
> "Lint auto-fixed and re-staged. Continuing to /review."

Return control to the caller.

## Step 6 — Hard-stop

Emit the full lint output for every linter that is still failing after the auto-fix attempt. Then say:

> "Lint failed and could not be auto-fixed. Fix the violations above, then re-run `/lint` or signal readiness to continue."

Do not proceed to `/review`. Wait for the human to resolve the violations manually or provide explicit guidance.

## Hard rules

- Never run a lint command that is not explicitly declared in the project's scripts, dependency config, or Makefile. Do not assume a linter is installed just because its binary might exist on PATH.
- Never mutate files during the check-only run (Step 2).
- Never skip re-staging (Step 5) after a successful auto-fix.
- Never proceed past a hard-stop without explicit human resolution.
- If the project has no declared lint tooling, skip — but always tell the user.
