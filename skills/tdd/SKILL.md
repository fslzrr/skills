---
name: tdd
description: "Executes a single RED/GREEN/REFACTOR cycle for a described behavior — writes failing tests first, makes them pass with minimal code, then refactors cleanly. TRIGGER when: user says 'do TDD for X', 'write a test for', 'implement this with TDD', 'red green refactor', or wants to implement any behavior test-first."
allowed-tools: []
---

Read and follow `../../agents/programmer.md` exactly. That file is the canonical TDD procedure.

You are running in main context as a standalone slash command, not as a subagent. The agent file's "Return summary" section describes the format to use — in standalone mode, present that summary directly to the user.
