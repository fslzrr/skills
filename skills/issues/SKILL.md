---
name: issues
description: "Manages GitHub issues for the software factory — creates, reads, updates, and lists PRD and TASK issues; transitions states via labels; shows a status dashboard; and recovers missing labels on demand during write operations. TRIGGER when: user says 'show status', 'list issues', `what's in progress`, 'what TASKs are under PRD #N', 'update issue #N', 'mark as blocked', 'create an issue', 'close this issue', or any other GitHub issue management request."
allowed-tools:
  - Bash(gh issue create:*)
  - Bash(gh issue view:*)
  - Bash(gh issue edit:*)
  - Bash(gh issue close:*)
  - Bash(gh issue comment:*)
  - Bash(gh issue list:*)
  - Bash(gh label list:*)
  - Bash(gh label create:*)
  - Bash(node *skills/issues/scripts/status-dashboard.js:*)
---

Manage GitHub issues for the software factory. You are the authoritative interface between the factory and GitHub — you understand what every label means, what transitions are valid, and what state each issue should be in.

## Label reference

See [reference/labels.md](reference/labels.md) for the full catalog.

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
   - Look it up in [reference/labels.md](reference/labels.md). If it is not in the file, stop and surface a clear error: "Label `<name>` is not a known factory label — cannot create it." Do not guess colors or descriptions.
   - Run `gh label create "<name>" --color "<color>" --description "<description>"` using the `name`, `color`, and `description` values from the file.
   - Notify the user: "Created missing label: `<name>`."
4. Retry the original operation **once**.
5. If the retry also fails, surface the error as-is and stop. Do not retry again.

## Default action

When invoked with no arguments, or with arguments that do not clearly map to a specific procedure, run `status-dashboard` without an explanatory preamble.

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

### check-prd-completion
Check whether all TASKs under a PRD are closed, and close the PRD if so:
1. List all TASK issues referencing this PRD number.
2. If every TASK is in a closed state: close the PRD with the comment "All TASKs completed — closing PRD."
3. If any TASK is still open: do nothing.

### status-dashboard
Show the current factory state by running [scripts/status-dashboard.js](scripts/status-dashboard.js).

Present the script's stdout to the user verbatim inside a fenced code block. Do not summarize, omit issue titles, drop sections, or reformat per-issue lines.

## Shared templates

This skill owns the canonical issue body templates. To apply them:

- **PRD**: read [templates/prd.md](templates/prd.md) and use it as the structural template for the issue body, filling in each section from the interview findings.
- **TASK**: read [templates/task.md](templates/task.md) and use it as the structural template for the issue body, filling in each section with the approved content.
