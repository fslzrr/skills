---
name: issues
description: "(fslzrr) Manages GitHub issues for the software factory — creates, reads, updates, and lists PRD and TASK issues; transitions states via labels; shows a status dashboard; and recovers missing labels on demand during write operations. TRIGGER when: user says 'show status', 'list issues', `what's in progress`, 'update issue #N', 'mark as blocked', 'create an issue', 'close this issue', or any other GitHub issue management request."
---

Manage GitHub issues for the software factory. You are the authoritative interface between the factory and GitHub — you understand what every label means, what transitions are valid, and what state each issue should be in.

## Label reference

All 13 factory labels. This table is the single source of truth for label recovery — do not invent labels outside it.

| name | color | description |
|---|---|---|
| `prd` | `8B5CF6` | Product Requirements Document |
| `task` | `EC4899` | Implementation task |
| `needs-triage` | `9CA3AF` | Awaiting triage |
| `in-backlog` | `F97316` | Triaged, in backlog |
| `in-progress` | `10B981` | Actively being worked on |
| `ai-ready` | `FCD34D` | Ready for AI implementation |
| `human-ready` | `FDE68A` | Ready for human implementation |
| `ai-in-progress` | `34D399` | AI is implementing |
| `human-in-progress` | `6EE7B7` | Human is implementing |
| `in-code-review` | `60A5FA` | PR open, awaiting review |
| `blocked` | `EF4444` | Blocked by a dependency or issue |
| `cancelled` | `F87171` | Abandoned, not completed |
| `adr` | `2DD4BF` | Architecture Decision Record |

## State machines

### PRD issues (labeled `prd`)
Valid state labels and transitions:
```
needs-triage  →  in-backlog   (after /interview + /prd complete the PRD)
needs-triage  →  [closed]     (decided not viable — close with reason comment)
in-backlog    →  in-progress  (after /decompose creates child TASKs)
in-progress   →  [closed]     (auto: when all child TASKs are closed)
```

### TASK issues (labeled `task`)
Valid state labels and transitions:
```
ai-ready          →  ai-in-progress      (/implement picks it up)
human-ready       →  human-in-progress   (human picks it up)
ai-in-progress    →  in-code-review      (PR opened with "closes #N")
human-in-progress →  in-code-review      (PR opened with "closes #N")
in-code-review    →  [closed]            (GitHub auto-closes on PR merge)
```

### Cross-cutting labels
- `blocked`: add/remove without changing the state label. Always record a reason comment when adding.
- `cancelled`: add before closing to distinguish abandonment from completion.

## Label error-recovery

Apply this procedure **only** when a write operation (`create-prd`, `create-prd-stub`, `update-prd`, `create-task`, `update-state`, `add-blocked`, `remove-blocked`) fails with a label-related error (e.g. label does not exist).

1. Run `gh label list --limit 50` and collect the names of all existing labels.
2. Identify which labels the failed operation needed but are missing from the list.
3. For each missing label:
   - Look it up in the **Label reference** table above. If it is not in the table, stop and surface a clear error: "Label `<name>` is not a known factory label — cannot create it." Do not guess colors or descriptions.
   - Run `gh label create "<name>" --color "<color>" --description "<description>"` using the exact values from the table.
   - Notify the user: "Created missing label: `<name>`."
4. Retry the original operation **once**.
5. If the retry also fails, surface the error as-is and stop. Do not retry again.

## Procedures

### create-prd
Create a PRD issue when body content is available (post-`/interview` + `/prd`):
```bash
gh issue create \
  --title "<title>" \
  --body "<PRD template content>" \
  --label "prd,in-backlog"
```
Return the issue number and URL.

**Trigger heuristic:** use `create-prd` when body content is provided (after `/interview` + `/prd` have produced a full spec); use `create-prd-stub` when only a title is given.

### create-prd-stub
Create a title-only PRD stub for an idea not yet ready for a full `/interview` session:
```bash
gh issue create \
  --title "<title>" \
  --label "prd,needs-triage"
```
No `--body` is passed. The stub lands in `needs-triage` awaiting a future `/interview`. Return the issue number and URL.

### update-prd
Update an existing PRD stub with the full title and body from a completed `/interview` + `/prd` session, then move it to `in-backlog`:
```bash
gh issue edit <number> --title "<title>" --body "<PRD template content>"
gh issue edit <number> --remove-label "needs-triage" --add-label "in-backlog"
```
The second command silently succeeds even if `needs-triage` is not present (GitHub ignores removing a label that isn't on the issue). Return the issue number and URL.

### create-task
Create a TASK issue as a child of a PRD:
```bash
gh issue create \
  --title "<title>" \
  --body "<TASK template content>" \
  --label "task,<ai-ready|human-ready>"
```
Return the issue number and URL.

### read-issue
Read an issue's full content:
```bash
gh issue view <number> --json title,body,labels,state,comments
```

### update-state
Transition an issue to a new state. Remove the current state label and add the new one:
```bash
gh issue edit <number> --remove-label "<current-state>" --add-label "<new-state>"
```
Always verify the transition is valid per the state machines above before executing.

### close-issue
Close an issue with a reason:
```bash
gh issue comment <number> --body "<reason for closing>"
gh issue close <number>
```

### add-blocked
Mark an issue as blocked:
```bash
gh issue comment <number> --body "Blocked: <reason>"
gh issue edit <number> --add-label "blocked"
```

### remove-blocked
Unblock an issue:
```bash
gh issue edit <number> --remove-label "blocked"
gh issue comment <number> --body "Unblocked: <reason>"
```

### list-issues
List and filter issues. Examples:
```bash
# All open PRDs
gh issue list --label "prd" --state open

# TASKs needing attention
gh issue list --label "task,human-ready" --state open
gh issue list --label "task,human-in-progress" --state open
gh issue list --label "task,ai-ready" --state open
gh issue list --label "task,ai-in-progress" --state open
gh issue list --label "task,in-code-review" --state open

# Blocked issues
gh issue list --label "blocked" --state open

# TASKs under a specific PRD (search by parent reference in body)
gh issue list --label "task" --search "Parent PRD #<number>"
```

### check-prd-completion
Check whether all TASKs under a PRD are closed, and close the PRD if so:
1. List all TASK issues referencing this PRD number.
2. If every TASK is in a closed state: close the PRD with the comment "All TASKs completed — closing PRD."
3. If any TASK is still open: do nothing.

### status-dashboard
Show the current factory state:

1. Fetch all open issues in one call:
   ```bash
   gh issue list --state open --json number,title,labels,comments --limit 200
   ```
   Store the response as the working dataset. Do not make any further `gh issue list` calls for the dashboard.

2. From the working dataset, derive each section in-memory by inspecting label names:

   **PRDs by state** — issues whose labels include `prd`, grouped by their state label:
   - `needs-triage`
   - `in-backlog`
   - `in-progress`

   **TASKs by state** — issues whose labels include `task`, grouped by their state label:
   - `human-ready`
   - `human-in-progress`
   - `ai-ready`
   - `ai-in-progress`
   - `in-code-review`

   **Blocked** — issues (PRD or TASK) whose labels include `blocked`.

3. Child-task completion check — for each `in-progress` PRD from step 2:
   - Scan its comments for one whose body starts with `Created child TASKs:`.
   - If found, extract every `#N` issue number from that comment.
   - For each `#N`, check whether it appears in the working dataset (i.e., it is still open). Any `#N` absent from the dataset is treated as closed.
   - If every referenced child `#N` is absent from the dataset (all closed), flag that PRD as `✓ all TASKs closed — ready to close`.
   - If no such comment exists (legacy PRD), show nothing — no error.

Format the output clearly with headers and issue numbers so the human can act on it immediately.

## PRD template

```markdown
## Context
<!-- Why does this exist? What prompted it? -->

## Problem Statement
<!-- What specific problem is being solved? -->

## Solution
<!-- Proposed approach -->

## User Stories
<!-- As a [user], I want [goal] so that [reason] -->

## Implementation Decisions
<!-- Key technical/architectural choices -->

## Testing Decisions
<!-- How we know this works at the PRD level -->

## Out of Scope
<!-- Explicit exclusions to prevent scope creep -->

## Alternatives Considered
<!-- Why this approach over others -->

## Risks & Mitigations
<!-- What could go wrong and how to handle it -->

## Dependencies
<!-- Other PRDs or external systems required before implementation -->

## Further Notes
<!-- Anything else relevant -->
```

## TASK template

```markdown
## Context
<!-- Why this TASK exists within the parent PRD -->

## Goal
<!-- What this specific vertical slice achieves -->

## Acceptance Criteria
<!-- Specific, testable conditions — each becomes one SUBTASK in /implement -->

## Blockers / Dependencies
<!-- Other TASKs that must complete before this one -->

## Parent PRD
<!-- Link to parent PRD issue -->

## Testing Approach
<!-- How this slice is tested end-to-end -->

## Affected Areas
<!-- Files, modules, systems this TASK touches -->
```
