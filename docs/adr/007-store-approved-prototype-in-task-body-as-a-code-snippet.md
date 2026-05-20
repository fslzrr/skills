# 007. Store Approved Prototype in TASK Body as a Code Snippet

Date: 2026-05-19

## Status

Accepted

## Context

`/decompose` adds a visual approval gate for UI stories: it generates an HTML/CSS prototype, writes it to a temp file for human review, and deletes the temp file after confirmation. The confirmed prototype becomes the visual specification that `/implement` and `/review` rely on. The factory needs a location for this approved artifact that is accessible to both downstream skills without external file lookup.

## Decision

After the human confirms the prototype, `/decompose` embeds it as a code snippet directly in the TASK body. The temp file is then deleted. `/implement` and `/review` read the approved prototype from the TASK body via a standard `gh issue view` call.

## Consequences

The approved visual spec is co-located with the implementation TASK, making it accessible to any skill that already reads the TASK body — no extra lookup, no file path management. The artifact is version-controlled as part of the GitHub issue history. The temp file lifecycle (write → confirm → embed → delete) ensures no unapproved artifact ever persists in the repository.

## Alternatives Considered

Storing the prototype as a file in the repository before TASK creation was considered. This was rejected because it would persist an unapproved artifact in the repo before human confirmation — conflating the draft and approval steps.
