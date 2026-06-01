# 010. Skills Declare allowed-tools Frontmatter at Medium Granularity

Date: 2026-05-31

## Status

Accepted

## Context

Every skill in `skills/` (`decompose`, `document`, `implement`, `interview`, `issues`, `lint`, `prd`, `review`, `tdd`) currently declares only `name:` and `description:` in its frontmatter. Without an `allowed-tools:` list, the parent Claude Code session prompts the user for permission on every routine `Bash(...)` invocation and every `Agent` spawn the skill makes — even though those calls are exactly what the skill is supposed to perform. The friction defeats the purpose of having canonical procedures bundled as skills.

Three forces are in play:

- **Eliminate routine prompts** for in-scope skill operations so the factory's verb-space runs uninterrupted.
- **Preserve a checkpoint** for loss-of-work / irreversible-history operations (`rm -rf`, `git push --force`, `git reset --hard`, `git branch -D`, `gh issue delete`, `gh repo delete`) so the user retains tool-level oversight on commands that cannot be cheaply undone.
- **Keep the convention uniform** so the policy is teachable, drift-resistant, and enforceable by the reviewer's ADR guard as the factory grows.

## Decision

Every `SKILL.md` in `skills/` declares an `allowed-tools:` field in its frontmatter at **medium granularity** — the skill's verb space, enumerated explicitly to exclude any carved-out destructive verb. For `/issues`, that is `Bash(gh issue create:*) Bash(gh issue view:*) Bash(gh issue edit:*) Bash(gh issue close:*) Bash(gh issue comment:*) Bash(gh issue list:*)` (deliberately omitting `delete`), not tool-wide (`Bash(gh:*)`, which over-approves outside the skill's intent) and not per-flag (`Bash(gh issue edit --add-label:*)`, a maintenance treadmill).

When a tool's verb set contains a carved-out destructive verb, the safe verbs must be enumerated explicitly — a broader pattern would pre-approve the destructive one because the frontmatter allow-list does not support deny rules (deny rules live in `settings.json` only, per Claude Code's permission spec).

Loss-of-work operations are explicitly excluded from every skill's allow-list — no pattern may match `rm -rf`, `git push --force`, `git reset --hard`, `git branch -D`, `gh issue delete`, or `gh repo delete`. These commands continue to prompt because no skill-level pattern matches them — the carve-out is enforced by the *absence* of an allowing pattern, not by a separate tool-level checkpoint.

Tools auto-allowed in interactive sessions (`Read`, `Write`, `Edit`, `Grep`, `Glob`) are not declared — declaring them would be dead config. Subagent files (`agents/*.md`) are not modified — `allowed-tools` is not a supported frontmatter field on subagent definitions.

## Consequences

- Direct-executor skills (`/issues`, `/interview`, `/prd`, `/decompose`, `/document`) run their routine commands without re-approval, eliminating the bulk of factory friction.
- The user retains a per-invocation prompt for loss-of-work commands — destructive operations cannot be silently pre-approved by any skill.
- A new skill (or any modification to an existing one) must explicitly state its `allowed-tools`, making the policy the default rather than an afterthought.
- The reviewer's ADR guard automatically enforces this policy on every future skill change; no modification to `/review` is required and no CI lint script is shipped.
- Skills running as standalone slash commands (`/lint`, `/tdd`, `/review`) execute their referenced agent's procedure inline in the main session — their `Bash(...)` patterns must cover what those agent procedures actually run, even though `/implement` invokes the same agents as subagents.
- Subagent-spawned tool calls (made by `programmer`, `linter`, `reviewer` when spawned by `/implement`) are not covered by any skill's `allowed-tools` and continue to be gated by the parent session's `settings.json`. The user opts in at the session level if they want full coverage.

## Alternatives Considered

- **Loose granularity** (`Bash(gh:*)`, `Bash(bash:*)`). Rejected — over-permissive: pre-approves commands outside the skill's intent (e.g. `gh repo delete` while running `/issues`), defeating the carve-out's safety value.
- **Per-flag granularity** (one entry per flag combination, e.g. `Bash(gh issue edit --add-label "ai-ready":*)`). Rejected — high-maintenance treadmill: every new flag combination the skill picks up forces a frontmatter update, reintroducing the kind of duplicated maintenance ADR-009 removed. Per-verb enumeration (one entry per subcommand verb) is the chosen form because it stops at the verb-space level while still excluding carve-out verbs.
- **Definition-A "any mutation prompts" policy** (every state-mutating call prompts regardless of declaration). Rejected — leaves the high-volume friction intact (`/implement` per-commit, `/document` per-file-write, `/issues` per-state-change); the PRD goal is not met.
- **CI lint script** to check for frontmatter presence. Rejected — presence ≠ correctness; the check passes for skills with wrong or sloppy declarations, creating false confidence. Correctness is the judgment call the reviewer must make anyway.
- **Modifying `/review`** to enforce the policy directly. Rejected — `/review` is a generally-shipped skill, and this policy is project-specific. The existing ADR-guard mechanism picks up the new ADR automatically without any skill modification.
- **Adding `allowed-tools` to subagent files** (`agents/*.md`). Rejected — `allowed-tools` is not a supported frontmatter field on subagent definitions per official docs; declaring it would be dead config that future readers would trust.
