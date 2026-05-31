---
name: lint
description: "Runs three ordered quality-gate buckets — format (fix + re-stage), lint (check-only → auto-fix → hard-stop), typecheck (project-wide → hard-stop) — each discovered independently from declared project scripts; notifies and skips missing buckets; fail-fast on hard-stop. TRIGGER when: user says 'run lint', 'lint the code', 'check lint', 'run format', 'typecheck'."
---

Read and follow `../../agents/linter.md` exactly. That file is the canonical lint procedure.

You are running in main context as a standalone slash command, not as a subagent. The agent file's "Return summary" section describes the format to use when reporting your result — in standalone mode, present that summary directly to the user.
