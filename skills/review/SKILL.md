---
name: review
description: "Reviews staged or specified code changes against a fixed core checklist (TDD, SOLID, DRY, naming, deep modules) plus adaptive extras based on the type of change, and produces a PASS/FAIL verdict with blocking and advisory findings. TRIGGER when: user says 'review my changes', 'code review', 'review this', 'check my implementation', 'review the diff', or after any implementation work."
allowed-tools:
  - Bash(gh issue view:*)
---

Read and follow `../../agents/reviewer.md` exactly. That file is the canonical review procedure.

You are running in main context as a standalone slash command, not as a subagent. The agent file's "Output format" section describes the format to use — in standalone mode, present that verdict directly to the user.

The `allowed-tools` list covers only `gh issue view` for fetching the prototype on UI-task reviews. Everything else (ADR reads, source reads, `git diff --staged`) is auto-allowed by Claude Code.
