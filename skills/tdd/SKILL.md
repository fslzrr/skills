---
name: tdd
description: "(fslzrr) Executes a single RED/GREEN/REFACTOR cycle for a described behavior — writes failing tests first, makes them pass with minimal code, then refactors cleanly. Can be used standalone or is called by /implement for each SUBTASK. TRIGGER when: user says 'do TDD for X', 'write a test for', 'implement this with TDD', 'red green refactor', or wants to implement any behavior test-first."
---

Execute a RED → GREEN → REFACTOR cycle for a single behavior.

## ADR guard

Before exploring the codebase, read `docs/adr/` once per session:

- If the directory does not exist or is empty, proceed without constraints.
- If ADRs exist, treat every recorded decision as a hard constraint. Do not propose, implement, or accept approaches that contradict them.

## Input

You need a clear description of the behavior to implement. If it was not provided, ask for it before starting.

## The cycle

### RED
1. Write the minimum set of failing tests that specify the behavior. Tests must:
   - Be specific to the described behavior, not the implementation
   - Fail for the right reason (not due to syntax errors or missing imports)
   - Cover the happy path and the most important edge cases
2. Run the tests and confirm they fail. If any test passes without implementation, it is not testing the right thing — fix or remove it.
3. Do not write any implementation code during this phase.

### GREEN
4. Write the minimum implementation to make all tests pass. Do not over-engineer — write only what is needed to go from red to green.
5. Run the tests and confirm they all pass. If any test still fails, fix the implementation until all are green before proceeding.

### REFACTOR
6. Only when all tests are GREEN, refactor the implementation:
   - Remove duplication (DRY)
   - Improve naming for clarity
   - Apply deep module thinking: push complexity down, simplify the interface
   - Apply SOLID where naturally applicable — do not over-engineer
   - Do not change behavior, only improve structure
7. Run the tests again and confirm they are still all GREEN. If any test breaks during refactor, fix the refactor — do not change the tests.

## Hard rules

- Never write implementation code while RED.
- Never refactor while RED.
- Never proceed to the next phase if the current phase has not been verified.
- If you cannot make the tests pass after a genuine attempt, stop and explain the blocker to the user rather than skipping to the next SUBTASK.
