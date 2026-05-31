# 009. Agent File Owns the Canonical Procedure for Paired Skill+Agent Units

Date: 2026-05-31

## Status

Accepted

Supersedes [004-share-one-source-of-truth-via-skill-md-reference](004-share-one-source-of-truth-via-skill-md-reference.md)

## Context

The plugin now ships two first-class artifact types — skills (user-invocable slash commands loaded into main context) and agents (orchestrator-spawned subagents with tool scoping, context isolation, and a structured return contract). Three units exist in paired form, where a skill and an agent share the same procedure: `/tdd`+programmer, `/lint`+linter, `/review`+reviewer.

ADR-004 chose skill-as-canonical for these shared procedures, with the agent file referencing the skill via a `<repo-root>/skills/<name>/SKILL.md` path resolved through `git rev-parse --show-toplevel`. That choice presupposed the plugin would be checked out as the user's working git repository. Under marketplace plugin distribution, the plugin lives at `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` while the user's working git root is some other project — so the path lookup returns a file that does not exist, and the subagent has no way to read its procedure.

The underlying issue is structural: ADR-004 did not distinguish between skills with a paired agent and skills without, and it did not account for skills and agents traveling together as one plugin artifact. That distinction needs to be made explicit, and the source-of-truth direction needs to be set in a way that does not depend on runtime path resolution at all.

## Decision

For each paired skill+agent unit, the agent file is the canonical procedure. The agent file holds the full procedure body, the ADR guard, the style-guide guard (where applicable), and the procedure-specific hard rules inline. The skill file is reduced to a thin wrapper that references the sibling agent via the relative path `../../agents/<name>.md` — a path that resolves correctly inside the plugin cache because both files travel together at the same install root.

For skills with no paired agent (`/implement`, `/interview`, `/prd`, `/decompose`, `/document`, `/issues`), the skill file remains the canonical procedure.

No procedure content is duplicated. Where the procedure exists once, it exists in the file most directly responsible for executing it.

## Consequences

- Subagents (`programmer`, `linter`, `reviewer`) read their procedure inline from their own agent file — no second file read, no runtime path resolution.
- Standalone slash commands (`/tdd`, `/lint`, `/review`) still work: the main-context Claude reads the skill wrapper, follows its directive to read the sibling agent file, and executes the procedure.
- Subagent benefits — context isolation, tool scoping (the reviewer's `tools: Read, Bash` declaration still physically prevents file modification), and model selection — are preserved unchanged.
- Future paired skill+agent units follow this pattern: the agent owns the procedure, the skill is a thin wrapper.
- Plugin authors editing a paired unit edit one file (the agent), not two. Drift between agent and skill procedure content is impossible because the skill no longer contains procedure content.
- ADR-004 is superseded — its premise (runtime path resolution to `<repo-root>/skills/<name>/SKILL.md`) does not hold under plugin distribution, and its choice of skill-as-canonical is reversed for paired units.

## Alternatives Considered

- **Runtime resolution via `~/.claude/plugins/installed_plugins.json`**: each subagent would parse this JSON file (with `jq` or `python3`) to discover the plugin install path, then read the SKILL.md via that path. Rejected — adds runtime JSON parsing, couples subagent procedures to a Claude Code internal file, and preserves ADR-004's runtime-resolution model without addressing its underlying fragility.
- **Ship a `bin/plugin-root` introspection script**: the plugin would include a small bash script that prints its own install path via `${BASH_SOURCE[0]}` introspection; agents would invoke `$(plugin-root)/skills/<name>/SKILL.md`. Rejected — introduces a new artifact convention (a wrapper script), creates name-collision risk if multiple plugins ship `plugin-root`, and the benefit (preserving ADR-004 verbatim) does not justify the new convention.
- **Inline the procedure in both the skill and the agent (controlled duplication)**: each file would carry a complete copy of the procedure, kept in sync at code review. Rejected — violates the no-content-duplication principle, recreates the drift risk ADR-004 was originally written to prevent.
