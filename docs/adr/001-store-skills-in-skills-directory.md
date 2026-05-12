# 001. Store Skills in skills/ Directory, Not .claude/skills/

Date: 2026-05-11

## Status

Accepted

## Context

This repository implements a software factory pipeline composed of discrete skills (e.g., `/implement`, `/review`, `/tdd`). Each skill is a self-contained markdown file that drives AI agent behavior across platforms (Claude Code, Codex, Antigravity, and others).

Skills are authored, reviewed, versioned, and evolved like source code — they are not runtime configuration. The `.claude/` directory is a runtime configuration space that holds settings, hooks, and tool configuration for Claude Code specifically. Because skills are platform-agnostic and are the primary intellectual content of this repository, storing them under a single platform's configuration subtree would be the wrong conceptual home.

## Decision

Skills are stored in the top-level `skills/` directory, one subdirectory per skill (e.g., `skills/implement/SKILL.md`), not under `.claude/skills/`. The `.claude/skills/` path is a symlink to `skills/` to satisfy Claude Code's expected location without duplicating content.

## Consequences

- Skills are clearly first-class source artifacts, discoverable alongside other repo content rather than buried in a tooling configuration subtree.
- Contributors looking for factory behavior look in `skills/`, not in `.claude/`.
- The `.claude/` directory remains a pure runtime configuration space, reducing conceptual noise for anyone reading the project structure.

## Alternatives Considered

- **`.claude/skills/`** (rejected): Placing skills inside the Claude Code configuration subtree conflates runtime configuration with source artifacts, and ties platform-agnostic content to a single platform's directory convention.
