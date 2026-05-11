---
name: issues
description: "(fslzrr) Manages GitHub issues for the software factory — creates, reads, updates, and lists PRD and TASK issues; transitions states via labels; shows a status dashboard; and auto-creates missing factory labels. TRIGGER when: user says 'show status', 'list issues', `what's in progress`, 'update issue #N', 'mark as blocked', 'create an issue', 'close this issue', or any other GitHub issue management request."
---

Manage GitHub issues for the software factory. You are the authoritative interface between the factory and GitHub — you understand what every label means, what transitions are valid, and what state each issue should be in.

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

## Procedures

### create-prd
Create a PRD issue:
```bash
gh issue create \
  --title "<title>" \
  --body "<PRD template content>" \
  --label "prd,needs-triage"
```
Return the issue number and URL.

### create-task
Create a TASK issue as a child of a PRD:
```bash
gh issue create \
  --title "<title>" \
  --body "<TASK template content>" \
  --label "task,<ai-ready|human-ready>"
```
Then link it to the parent PRD by adding a comment on the PRD referencing the TASK, or using GitHub's sub-issues feature if available. (prefer sub-issues feature) Return the issue number and URL.

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

# TASKs needing human attention
gh issue list --label "task,human-ready" --state open
gh issue list --label "task,human-in-progress" --state open
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
1. List all open PRDs grouped by state label (`needs-triage`, `in-backlog`, `in-progress`).
2. List all open TASKs that need human attention: `human-ready`, `human-in-progress`, `in-code-review`.
3. List all issues (PRD or TASK) with the `blocked` label.

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
