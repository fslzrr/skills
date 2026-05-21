---
name: implement
description: "(fslzrr) Orchestrates the full TDD implementation loop for an ai-ready TASK — maps acceptance criteria to SUBTASKs, spawns the programmer/linter/reviewer subagents per SUBTASK, commits atomically, runs the full suite, then opens a PR after human approval. TRIGGER when: user says 'implement task #N', 'start implementing', 'work on this task' or 'implement this'."
---

Implement an `ai-ready` TASK using a disciplined TDD loop. You are the orchestrator — you drive each SUBTASK by spawning the `programmer`, `linter`, and `reviewer` subagents, manage the git history, and own the PR lifecycle. Subagents own their procedures (defined in their respective SKILL.md files); your job is to react to their return summaries, not to repeat their work.

## Prerequisites

You need an `ai-ready` TASK issue number. If not provided, ask for it.

### MCP prerequisites

- **chrome-devtools-mcp** — required for browser validation of UI tasks. Must be running and connected to a live Chrome instance before starting any UI SUBTASK.
  > **Warning:** Do not manually open Chrome DevTools while chrome-devtools-mcp is active — opening DevTools manually crashes the MCP-controlled browser session.

## ADR guard

Before starting, read `docs/adr/` once per session:

- If the directory does not exist or is empty, proceed without constraints.
- If ADRs exist, treat every recorded decision as a hard constraint. Do not propose, implement, or accept approaches that contradict them.

## Style guide guard

Before starting, read `docs/style-guide/` once per session:

- If the directory does not exist or is empty, proceed without constraints.
- If entries exist, treat every documented pattern as a hard constraint for UI-related decisions — unless the current work is explicitly superseding an entry.

## The implementation loop

### Setup

1. Use `/issues` to transition the TASK from `ai-ready` → `ai-in-progress`.
2. Use `/issues` to read the full TASK content: goal, acceptance criteria, affected areas, testing approach, parent PRD.
3. **Check for the `adr` or `style-guide` label.** If the TASK is labeled `adr`, follow the **ADR routing** path below. If labeled `style-guide`, follow the **Style guide routing** path below. Both skip the TDD loop entirely.

---

### ADR routing (only when TASK has the `adr` label)

When the TASK carries the `adr` label:

a. **Call `/document`** — pass the full TASK body as context. `/document` owns all content drafting, confirmation, and file writing.

b. **Do not spawn `linter` or `reviewer`** — ADR tasks are prose documents, not code; neither the lint buckets nor the review checklist applies.

c. **Commit the ADR file** atomically — one commit for the ADR file, following the same one-atomic-commit-per-SUBTASK rule as regular TASKs:
   ```bash
   git add docs/adr/<adr-file>
   git commit -m "docs(adr): <description of the decision recorded>"
   ```

d. Continue from step **Pre-PR gate** (present advisory log, ask for PR confirmation, open PR, transition to `in-code-review`).

---

### Style guide routing (only when TASK has the `style-guide` label)

When the TASK carries the `style-guide` label:

a. **Call `/document`** — pass the full TASK body as context. `/document` owns all content drafting, confirmation, and file writing.

b. **Do not spawn `linter` or `reviewer`** — style guide tasks are prose documents, not code; neither the lint buckets nor the review checklist applies.

c. **Commit the style guide file** atomically — one commit for the style guide file, following the same one-atomic-commit-per-SUBTASK rule as regular TASKs:
   ```bash
   git add docs/style-guide/<entry-file>
   git commit -m "docs(style-guide): <description of the pattern documented>"
   ```

d. Continue from step **Pre-PR gate** (present advisory log, ask for PR confirmation, open PR, transition to `in-code-review`).

---

### Plan (TDD path — skip if `adr` or `style-guide` label present)

4. Map each acceptance criterion to one SUBTASK. Each SUBTASK is one RED/GREEN/REFACTOR cycle.
5. Present the SUBTASK plan to the human:
   - List each SUBTASK with its corresponding acceptance criterion
   - Proposed order of implementation (dependencies first)
   Say: "Here is my plan for implementing this TASK as SUBTASKs. Confirm or adjust the order before I begin."
6. Wait for explicit human approval. Apply any adjustments.

### Execute (repeat for each SUBTASK)

7. **Spawn the `programmer` subagent** for this SUBTASK's behavior. Pass the SUBTASK description and any constraints (e.g. BLOCKING findings from a prior `reviewer` verdict) in the prompt. The subagent follows `skills/tdd/SKILL.md` — you do not repeat its procedure.

   Wait for the subagent's return summary (files changed, test names added, RED→GREEN evidence).

   - If the subagent reports a blocker per `skills/tdd/SKILL.md`'s hard rules, stop. Surface the blocker to the human and wait for guidance before continuing.

8. **Spawn the `linter` subagent** on the staged changes. The subagent follows `skills/lint/SKILL.md` — you do not repeat its procedure.

   Wait for the subagent's return summary (per-bucket status, files re-staged, hard-stop details if any).

   - If every bucket **passes or was silently skipped** (no tooling detected): continue to step 9.

   - If a bucket **hard-stops**:
     - Fix the violations directly in the code — do **not** re-spawn `programmer`. Lint hard-stops are style/format issues, not behavioral regressions.
     - Re-spawn the `linter` subagent.
     - If this is the **3rd consecutive lint hard-stop on the same SUBTASK**: stop. Show the subagent's last hard-stop output to the human and wait for guidance before continuing.

9. **Spawn the `reviewer` subagent** on the staged changes. The subagent follows `skills/review/SKILL.md` — you do not repeat its procedure.

    Wait for the subagent's return summary (BLOCKING findings, ADVISORY findings, verdict).

    - If verdict is **FAIL** (BLOCKING findings exist):
      - Record the feedback
      - Return to step 7 — re-spawn `programmer` with the BLOCKING findings as explicit constraints
      - If this is the **3rd consecutive FAIL on the same SUBTASK**: stop. Present all accumulated BLOCKING feedback to the human and wait for guidance.

    - If verdict is **PASS** (zero BLOCKING findings):
      - Record any ADVISORY findings in the advisory log
      - Continue to step 10

10. **Commit the SUBTASK**:
    ```bash
    git add <affected files>
    git commit -m "<type>(<scope>): <description>"
    ```
    Type and scope are determined independently per commit based on the nature of the change — left to AI judgment. One atomic commit per SUBTASK. Do not batch multiple SUBTASKs into one commit.

11. **Run all new or modified tests** and confirm everything is GREEN before starting the next SUBTASK.

### Full suite check

12. After all SUBTASKs are committed, run the **full test suite**.
    - If it fails on something **within scope** of this TASK: treat it as a new SUBTASK. Return to step 7.
    - If it fails on something **out of scope**: stop. Explain what is failing, why fixing it would go out of scope, and wait for the human to decide.

### Pre-PR gate

13. Present the **advisory log** accumulated across all SUBTASKs:
    "Here are the advisory findings from the implementation. None of these are blocking, but they are genuine improvements. Do you want to address any before opening the PR?"
    Wait for the human's decision. If they want changes, implement them following the same RED/GREEN/REFACTOR discipline.

14. Ask: "Implementation is complete and all tests are GREEN. Shall I open the PR?"
    Wait for explicit confirmation.

### PR and handoff

15. Open the PR:
    - Title: mirror the TASK title exactly
    - Body: include a summary of what was implemented and `closes #<TASK-number>`

16. Use `/issues` to transition the TASK from `ai-in-progress` → `in-code-review`.

17. **Remain active** in this conversation. The human may give PR feedback or request changes directly here. When they do, implement the requested changes and push to the same branch. The TASK stays `in-code-review` until the human merges the PR (GitHub auto-closes the TASK on merge).

## Hard rules

- Never start the next SUBTASK until the current one is GREEN, lint is clean, and the `reviewer` subagent has returned PASS.
- Never refactor while RED (this is enforced inside `skills/tdd/SKILL.md` via the `programmer` subagent, but also your responsibility as orchestrator).
- Never re-spawn `programmer` to resolve lint hard-stops — fix them directly in the code.
- Never repeat or paraphrase a subagent's internal procedure in your own messages — trust the return summary; the raw work stays inside the subagent's context by design.
- One atomic commit per SUBTASK — this applies to ADR file commits as well as code commits.
- Do not skip the full suite check after all SUBTASKs.
- Do not open a PR without explicit human confirmation.
- When the `adr` or `style-guide` label is present, never spawn `programmer`, `linter`, or `reviewer` — always route to `/document`.
