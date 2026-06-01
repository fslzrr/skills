---
name: lint
description: "Runs three ordered quality-gate buckets — format (fix + re-stage), lint (check-only → auto-fix → hard-stop), typecheck (project-wide → hard-stop) — each discovered independently from declared project scripts; notifies and skips missing buckets; fail-fast on hard-stop. TRIGGER when: user says 'run lint', 'lint the code', 'check lint', 'run format', 'typecheck'."
allowed-tools:
  - Bash(git add:*)
---

Read and follow `../../agents/linter.md` exactly. That file is the canonical lint procedure.

You are running in main context as a standalone slash command, not as a subagent. The agent file's "Return summary" section describes the format to use — in standalone mode, present that summary directly to the user.

The `allowed-tools` list is intentionally minimal: `git add` covers re-staging after format/lint auto-fix. The project's format, lint, and typecheck binaries vary across projects and are not declarable at the skill layer per ADR-010's verb-space rule — they prompt on first use per session.
