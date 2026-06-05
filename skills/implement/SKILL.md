---
name: implement
description: "Orchestrates the full TDD implementation loop for an ai-ready TASK — maps acceptance criteria to SUBTASKs, spawns the programmer/linter/reviewer subagents per SUBTASK, commits atomically, runs the full suite, then opens a PR after human approval. TRIGGER when: user says 'implement task #N', 'start implementing', 'work on this task' or 'implement this'."
allowed-tools:
  - Agent(fslzrr:programmer)
  - Agent(fslzrr:linter)
  - Agent(fslzrr:reviewer)
  - Bash(gh issue view:*)
  - Bash(gh issue edit:*)
  - Bash(gh issue develop:*)
  - Bash(gh repo view:*)
  - Bash(gh pr create:*)
  - Bash(gh pr view:*)
  - Bash(git add:*)
  - Bash(git commit:*)
  - Bash(git fetch:*)
  - Bash(git pull:*)
  - Bash(git push -u origin HEAD)
  - Bash(git rev-parse:*)
  - Bash(git status:*)
  - Bash(git worktree add:*)
  - Bash(git worktree list:*)
  - Bash(git worktree remove:*)
  - Bash(git branch -d:*)
---

Implement an `ai-ready` TASK using a disciplined TDD loop. You are the orchestrator — you drive each SUBTASK by spawning the `programmer`, `linter`, and `reviewer` subagents, manage the git history, and own the PR lifecycle. Subagents own their procedures (defined in their respective `agents/<name>.md` files); your job is to react to their return summaries, not to repeat their work.

## Prerequisites

You need an `ai-ready` TASK issue number. If not provided, ask for it.

- **chrome-devtools-mcp** — must be running and connected to a live Chrome instance before starting any SUBTASK that requires browser validation.
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

2. **Create (or resume) the task's isolated worktree, then `cd` into it.** Do this *before* reading the body or routing on labels, so every downstream read, write, and command — including `/document`'s relative `docs/` writes — lands inside the worktree.

   a. Detect the default branch at runtime (never hardcode `main`) and refresh refs:
      ```bash
      DEFAULT=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)
      git fetch
      ```
   b. Resolve the sibling worktree location from the current repo root (pure shell parameter expansion, no external helpers):
      ```bash
      ROOT=$(git rev-parse --show-toplevel)
      PARENT="${ROOT%/*}"; NAME="${ROOT##*/}"
      ```
      Worktrees live under `$PARENT/$NAME-worktrees/`, one per TASK. Each is named for the TASK's GitHub-linked branch, so `$BRANCH` below is the `<TASK#>-<slug>` name `gh issue develop` assigns and the worktree path is always `$PARENT/$NAME-worktrees/$BRANCH`.
   c. Capture the linked branch name for this TASK (empty if none exists yet):
      ```bash
      BRANCH=$(gh issue develop <TASK#> --list | awk 'NR==1{print $1}')
      ```
      (`awk` is a POSIX helper outside the skill's `gh`/`git` verb space; it is gated at the session level per ADR-010 — like subagent tool calls — rather than declared in `allowed-tools`.)
   d. **Resume guard** — never auto-discard existing work. Take the first case that matches:
      - **`$BRANCH` is set and its worktree already exists** (`$PARENT/$NAME-worktrees/$BRANCH` appears in `git worktree list`): `cd` into it, then check `git status --porcelain` — if it reports nothing the worktree is **clean**, so resume silently; if it reports changes the worktree is **dirty**, so **stop and ask the human** before building on it (never reset, stash, or discard).
      - **`$BRANCH` is set but no worktree exists for it**: re-materialize and enter —
        ```bash
        git worktree add "$PARENT/$NAME-worktrees/$BRANCH" "$BRANCH"
        cd "$PARENT/$NAME-worktrees/$BRANCH"
        ```
      - **`$BRANCH` is empty** (fresh start): create the GitHub-linked branch off the default, re-run the step 2c capture (now non-empty), then add the worktree and enter —
        ```bash
        gh issue develop <TASK#> --base "$DEFAULT"
        git fetch
        BRANCH=$(gh issue develop <TASK#> --list | awk 'NR==1{print $1}')
        git worktree add "$PARENT/$NAME-worktrees/$BRANCH" "$BRANCH"
        cd "$PARENT/$NAME-worktrees/$BRANCH"
        ```
   e. The worktree at `$PARENT/$NAME-worktrees/$BRANCH` is now the root for everything that follows — all reads, writes, commits, and subagent spawns.

   **Worktree handoff** — every subagent you spawn (`programmer`, `linter`, `reviewer`) and every `/document` hand-off must begin its prompt with this absolute worktree path plus the instruction to `cd` into it first and treat it as the root for all reads, writes, and commands. Step 2 already `cd`'d here before any label routing, so this applies uniformly across the TDD, ADR, and style-guide routes — including `/document`'s relative `docs/` writes. Do **not** use Claude Code's `Agent(isolation: "worktree")`; the task's worktree is created and managed explicitly here.

3. Use `/issues` to read the full TASK content (goal, acceptance criteria, affected areas, testing approach, parent PRD) and **check for the `adr` or `style-guide` label.** If the TASK is labeled `adr`, follow the **ADR routing** path below; if labeled `style-guide`, follow the **Style guide routing** path below. Both skip the TDD loop entirely.

---

### ADR routing (only when TASK has the `adr` label)

When the TASK carries the `adr` label:

a. **Call `/document`** — begin the hand-off with the worktree handoff (step 2) so its relative `docs/` writes land in the worktree, then pass the full TASK body as context. `/document` owns all content drafting, confirmation, and file writing.

b. **Do not spawn `programmer`, `linter`, or `reviewer`** — ADR tasks are prose documents, not code; neither the lint buckets nor the review checklist applies.

c. **Commit the ADR file** atomically — one commit for the ADR file, following the same one-atomic-commit-per-SUBTASK rule as regular TASKs:
   ```bash
   git add docs/adr/<adr-file>
   git commit -m "docs(adr): <description of the decision recorded>"
   ```

d. Continue from step **Pre-PR gate** (present advisory log, ask for PR confirmation, open PR, transition to `in-code-review`).

---

### Style guide routing (only when TASK has the `style-guide` label)

When the TASK carries the `style-guide` label:

a. **Call `/document`** — begin the hand-off with the worktree handoff (step 2) so its relative `docs/` writes land in the worktree, then pass the full TASK body as context. `/document` owns all content drafting, confirmation, and file writing.

b. **Do not spawn `programmer`, `linter`, or `reviewer`** — style guide tasks are prose documents, not code; neither the lint buckets nor the review checklist applies.

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

7. **Spawn the `programmer` subagent** for this SUBTASK's behavior. Begin the prompt with the worktree handoff (step 2), then pass the SUBTASK description and any constraints (e.g. BLOCKING findings from a prior `reviewer` verdict). The subagent follows `agents/programmer.md` — you do not repeat its procedure.

   Wait for the subagent's return summary (files changed, test names added, RED→GREEN evidence).

   - If the subagent reports a blocker per `agents/programmer.md`'s hard rules, stop. Surface the blocker to the human and wait for guidance before continuing.

8. **Spawn the `linter` subagent** on the staged changes, beginning the prompt with the worktree handoff (step 2). The subagent follows `agents/linter.md` — you do not repeat its procedure.

   Wait for the subagent's return summary (per-bucket status, files re-staged, hard-stop details if any).

   - If every bucket **passes or was silently skipped** (no tooling detected): continue to step 9.

   - If a bucket **hard-stops**:
     - Fix the violations directly in the code — do **not** re-spawn `programmer`. Lint hard-stops are style/format issues, not behavioral regressions.
     - Re-spawn the `linter` subagent.
     - If this is the **3rd consecutive lint hard-stop on the same SUBTASK**: stop. Show the subagent's last hard-stop output to the human and wait for guidance before continuing.

9. **Spawn the `reviewer` subagent** on the staged changes, beginning the prompt with the worktree handoff (step 2). The subagent follows `agents/reviewer.md` — you do not repeat its procedure.

    Wait for the subagent's return summary (BLOCKING findings, ADVISORY findings, verdict).

    - If verdict is **FAIL** (BLOCKING findings exist):
      - Record the feedback
      - Return to step 7 — re-spawn `programmer` with the BLOCKING findings as explicit constraints
      - If this is the **3rd consecutive FAIL on the same SUBTASK**: stop. Present all accumulated BLOCKING feedback to the human and wait for guidance.

    - If verdict is **PASS** (zero BLOCKING findings):
      - Record any ADVISORY findings in the advisory log
      - Continue to step 9a

9a. **Browser validation (UI tasks only)** — Fetch the TASK body with `gh issue view <TASK-number> --json body` (where `<TASK-number>` is the issue number passed to `/implement` at step 1) and check for a `## Prototype` section containing a fenced `html` code block. If no such section is present, skip this step entirely.

    If a `## Prototype` section is present, verify that chrome-devtools-mcp is reachable before proceeding. If it is not reachable, stop and ask the human to start it before continuing.

    Run the chrome-devtools-mcp validation loop before committing:

    1. **Visual match** — take a screenshot via chrome-devtools-mcp and compare the rendered output against the HTML prototype from the TASK body. Confirm layout, colors, and component structure match.
    2. **Functional interaction** — exercise the interactive elements described in the prototype (clicks, inputs, navigation) and confirm they behave as specified.
    3. **Console/network health** — inspect the DevTools console and network panel for errors, unhandled rejections, or failed requests.

    If validation **passes** all three checks: continue to step 10.

    If validation **fails** any check:
    - Identify the specific mismatch or error
    - Self-correct: fix the implementation to address the failure, then return to step 8 (linter) and step 9 (reviewer) before retrying the validation loop
    - If this is the **3rd consecutive validation failure on the same SUBTASK**: stop. Present a detailed failure report (which check failed, what was observed vs. expected, what fixes were attempted) and wait for the human to decide.

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

15. **Push the branch, then open the PR.** Push the worktree's commits before `gh pr create` (use the exact non-force form declared in `allowed-tools`):
    ```bash
    git push -u origin HEAD
    ```
    Then open the PR with `gh pr create`:
    - Title: mirror the TASK title exactly
    - Body: include a summary of what was implemented and `closes #<TASK-number>`

16. Use `/issues` to transition the TASK from `ai-in-progress` → `in-code-review`.

17. **Remain active** in this conversation. The human may give PR feedback or request changes directly here. When they do, implement the requested changes and push to the same branch with `git push -u origin HEAD`. The TASK stays `in-code-review` until the human merges the PR (GitHub auto-closes the TASK on merge).

## Hard rules

- Never start the next SUBTASK until the current one is GREEN, lint is clean, and the `reviewer` subagent has returned PASS.
- Never refactor while RED (this is enforced inside `agents/programmer.md` via the `programmer` subagent, but also your responsibility as orchestrator).
- Never re-spawn `programmer` to resolve lint hard-stops — fix them directly in the code.
- Never repeat or paraphrase a subagent's internal procedure in your own messages — trust the return summary; the raw work stays inside the subagent's context by design.
- One atomic commit per SUBTASK — this applies to ADR file commits as well as code commits.
- Do not skip the full suite check after all SUBTASKs.
- Do not open a PR without explicit human confirmation.
- Run every task inside its own worktree (Setup step 2): begin every subagent spawn and every `/document` hand-off with the worktree handoff, uniformly across the TDD, ADR, and style-guide routes — and never use Claude Code's `Agent(isolation: "worktree")`, since the worktree is created and managed explicitly here.
- When the `adr` or `style-guide` label is present, never spawn `programmer`, `linter`, or `reviewer` — always route to `/document`.
