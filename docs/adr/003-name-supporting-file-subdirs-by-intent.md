# 003. Name supporting-file subdirs by intent, not by fixed enumeration

Date: 2026-05-19

## Status

Accepted

## Context

Skills and agents often need supporting files beyond the main markdown file — test fixtures, prompt templates, examples, and so on. Without a naming convention, contributors have no guidance on how to structure these files. A fixed enumeration of allowed subdirectory names (e.g. only `tests/`, `data/`, `assets/`) would impose order but would need to be amended every time a new kind of intent emerged.

## Decision

Name supporting-file subdirectories by their intent rather than selecting from a fixed, predefined list. For example, `fixtures/`, `prompts/`, `examples/` are all valid names if they accurately describe what the directory contains. No central registry of allowed names is maintained.

## Consequences

New intent categories emerge naturally as real needs arise, without requiring a convention amendment. Contributors must exercise judgment when naming new subdirectories, which trades enforcement for flexibility. Tooling that auto-discovers supporting files must not assume a fixed set of subdirectory names.

## Alternatives Considered

Fixed three-subdir convention — rejected because it locks future intents out; every genuinely new category would require amending the enumeration, creating friction and a bottleneck.
