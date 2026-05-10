---
name: implement
description: "(fslzrr) Orchestrates the full TDD implementation loop for an ai-ready TASK — maps acceptance criteria to SUBTASKs, runs /tdd and /review per SUBTASK, commits atomically, runs the full suite, then opens a PR after human approval. TRIGGER when: user says 'implement task #N', 'start implementing', 'work on this task' or 'implement this'."
---

Implement an `ai-ready` TASK using a disciplined TDD loop. You are the orchestrator — you drive each SUBTASK through `/tdd` and `/review`, manage the git history, and own the PR lifecycle.

## Prerequisites

You need an `ai-ready` TASK issue number. If not provided, ask for it.

## The implementation loop

### Setup

1. Use `/issues` to transition the TASK from `ai-ready` → `ai-in-progress`.
2. Use `/issues` to read the full TASK content: goal, acceptance criteria, affected areas, testing approach, parent PRD.
3. **Check for the `adr` label.** If the TASK is labeled `adr`, follow the **ADR routing** path below instead of the TDD loop.

---

### ADR routing (only when TASK has the `adr` label)

When the TASK carries the `adr` label:

a. **Call `/document`** — pass the full TASK body as context. `/document` owns all content drafting, confirmation, and file writing.

b. **Skip `/review`** — ADR tasks are prose documents, not code; the review checklist does not apply.

c. **Commit the ADR file** atomically — one commit for the ADR file, following the same one-atomic-commit-per-SUBTASK rule as regular TASKs:
   ```bash
   git add docs/adr/<adr-file>
   git commit -m "<clear description of the decision recorded>"
   ```

d. Continue from step **Pre-PR gate** (present advisory log, ask for PR confirmation, open PR, transition to `in-code-review`).

---

### Plan (TDD path — skip if `adr` label present)

4. Map each acceptance criterion to one SUBTASK. Each SUBTASK is one RED/GREEN/REFACTOR cycle.
5. Present the SUBTASK plan to the human:
   - List each SUBTASK with its corresponding acceptance criterion
   - Proposed order of implementation (dependencies first)
   Say: "Here is my plan for implementing this TASK as SUBTASKs. Confirm or adjust the order before I begin."
6. Wait for explicit human approval. Apply any adjustments.

### Execute (repeat for each SUBTASK)

7. **Follow the `/tdd` procedure** for this SUBTASK's behavior.
   - If `/tdd` cannot make tests pass after a genuine attempt, stop. Explain the blocker to the human and wait for guidance before continuing.

8. **Follow the `/review` procedure** on the changes made during this SUBTASK.

   - If verdict is **FAIL** (blocking findings exist):
     - Record the feedback
     - Return to step 7 (`/tdd` step c — implementation) with the blocking findings as explicit constraints
     - If this is the **3rd consecutive FAIL on the same SUBTASK**: stop. Present all accumulated blocking feedback to the human and wait for guidance.

   - If verdict is **PASS** (zero blocking findings):
     - Record any advisory findings in the advisory log
     - Continue to step 9

9. **Commit the SUBTASK**:
   ```bash
   git add <affected files>
   git commit -m "<clear description of what this SUBTASK implements>"
   ```
   One atomic commit per SUBTASK. Do not batch multiple SUBTASKs into one commit.

10. **Run all new or modified tests** and confirm everything is GREEN before starting the next SUBTASK.

### Full suite check

11. After all SUBTASKs are committed, run the **full test suite**.
    - If it fails on something **within scope** of this TASK: treat it as a new SUBTASK. Return to step 7.
    - If it fails on something **out of scope**: stop. Explain what is failing, why fixing it would go out of scope, and wait for the human to decide.

### Pre-PR gate

12. Present the **advisory log** accumulated across all SUBTASKs:
    "Here are the advisory findings from the implementation. None of these are blocking, but they are genuine improvements. Do you want to address any before opening the PR?"
    Wait for the human's decision. If they want changes, implement them following the same RED/GREEN/REFACTOR discipline.

13. Ask: "Implementation is complete and all tests are GREEN. Shall I open the PR?"
    Wait for explicit confirmation.

### PR and handoff

14. Open the PR:
    - Title: derived from the TASK goal
    - Body: include a summary of what was implemented and `closes #<TASK-number>`

15. Use `/issues` to transition the TASK from `ai-in-progress` → `in-code-review`.

16. **Remain active** in this conversation. The human may give PR feedback or request changes directly here. When they do, implement the requested changes and push to the same branch. The TASK stays `in-code-review` until the human merges the PR (GitHub auto-closes the TASK on merge).

## Hard rules

- Never start the next SUBTASK until the current one is GREEN and `/review` has passed.
- Never refactor while RED (this is enforced inside `/tdd`, but also your responsibility here).
- One atomic commit per SUBTASK — this applies to ADR file commits as well as code commits.
- Do not skip the full suite check after all SUBTASKs.
- Do not open a PR without explicit human confirmation.
- When the `adr` label is present, never run the TDD loop or `/review` — always route to `/document`.
