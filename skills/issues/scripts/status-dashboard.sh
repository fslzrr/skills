#!/usr/bin/env bash
# status-dashboard.sh
# Displays the current software factory state by fetching all open issues once
# and deriving PRD/TASK/Blocked sections from label names using jq.
#
# Usage: ./status-dashboard.sh

set -euo pipefail

# Fetch all open issues in a single call
issues=$(gh issue list --state open --json number,title,labels,comments --limit 200)

# PRD state labels (ordered by typical workflow progression)
prd_states=(needs-triage in-backlog in-progress)
# TASK state labels (ordered by typical workflow progression)
task_states=(human-ready human-in-progress ai-ready ai-in-progress in-code-review)

# ---------------------------------------------------------------------------
# Section: PRDs by state
# ---------------------------------------------------------------------------
echo "=== PRDs by state ==="
echo ""

for state in "${prd_states[@]}"; do
  matches=$(echo "$issues" | jq -r --arg state "$state" '
    .[] |
    select(
      (.labels | map(.name) | contains(["prd"])) and
      (.labels | map(.name) | contains([$state]))
    ) |
    "  #\(.number) \(.title)"
  ')
  if [[ -n "$matches" ]]; then
    echo "${state}:"
    echo "$matches"
    echo ""
  fi
done

# ---------------------------------------------------------------------------
# Section: TASKs by state
# ---------------------------------------------------------------------------
echo "=== TASKs by state ==="
echo ""

for state in "${task_states[@]}"; do
  matches=$(echo "$issues" | jq -r --arg state "$state" '
    .[] |
    select(
      (.labels | map(.name) | contains(["task"])) and
      (.labels | map(.name) | contains([$state]))
    ) |
    "  #\(.number) \(.title)"
  ')
  if [[ -n "$matches" ]]; then
    echo "${state}:"
    echo "$matches"
    echo ""
  fi
done

# ---------------------------------------------------------------------------
# Section: Blocked
# ---------------------------------------------------------------------------
echo "=== Blocked ==="
echo ""

blocked=$(echo "$issues" | jq -r '
  .[] |
  select(.labels | map(.name) | contains(["blocked"])) |
  "  #\(.number) \(.title)"
')

if [[ -n "$blocked" ]]; then
  echo "$blocked"
else
  echo "(none)"
fi

echo ""

# ---------------------------------------------------------------------------
# Child-task completion check for in-progress PRDs
# ---------------------------------------------------------------------------
in_progress_prds=$(echo "$issues" | jq -r '
  .[] |
  select(
    (.labels | map(.name) | contains(["prd"])) and
    (.labels | map(.name) | contains(["in-progress"]))
  ) |
  @base64
')

if [[ -n "$in_progress_prds" ]]; then
  # Collect all open issue numbers as a JSON array for membership checks
  open_numbers=$(echo "$issues" | jq '[.[].number]')
  header_printed=false

  while IFS= read -r encoded; do
    prd=$(echo "$encoded" | base64 -d)
    prd_number=$(echo "$prd" | jq -r '.number')
    prd_title=$(echo "$prd" | jq -r '.title')

    # Find the body of the first comment that starts with "Created child TASKs:"
    # No such comment means a legacy PRD — skip silently
    task_comment=$(echo "$prd" | jq -r '
      [ .comments[]? | select(.body | startswith("Created child TASKs:")) ] |
      first // empty |
      .body
    ')

    if [[ -z "$task_comment" ]]; then
      continue
    fi

    # Extract all #N issue references from the comment body
    child_numbers=$(echo "$task_comment" | grep -oE '#[0-9]+' | tr -d '#' || true)

    if [[ -z "$child_numbers" ]]; then
      continue
    fi

    all_closed=true
    while IFS= read -r cn; do
      is_open=$(echo "$open_numbers" | jq --argjson n "$cn" 'contains([$n])')
      if [[ "$is_open" == "true" ]]; then
        all_closed=false
        break
      fi
    done <<< "$child_numbers"

    if [[ "$all_closed" == "true" ]]; then
      if [[ "$header_printed" == "false" ]]; then
        echo "=== PRDs ready to close ==="
        echo ""
        header_printed=true
      fi
      echo "  #${prd_number} ${prd_title}"
      echo "    ✓ all TASKs closed — ready to close"
      echo ""
    fi
  done <<< "$in_progress_prds"
fi

exit 0
