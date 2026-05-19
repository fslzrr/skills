# 002. Store Custom Agents in agents/ Directory, Not .claude/agents/

Date: 2026-05-19

## Status

Accepted

## Context

This repository defines custom agent specifications that drive AI agent behavior (e.g., subagents spawned by factory skills). Like skills, these agent definitions are authored, reviewed, versioned, and evolved as source code — they are the primary intellectual content of the repository, not runtime configuration.

The `.claude/` directory is a runtime configuration space for Claude Code specifically. Placing agent definitions there would conflate source artifacts with runtime configuration, tie platform-agnostic content to a single platform's directory convention, and create the same conceptual mismatch that ADR-001 resolved for skills.

## Decision

Custom agent definitions are stored in the top-level `agents/` directory, not under `.claude/agents/`. A symlink from `.claude/agents/` to `agents/` satisfies Claude Code's expected location without duplicating content.

## Consequences

- Agent definitions are clearly first-class source artifacts, discoverable alongside skills and other repo content rather than buried in a tooling configuration subtree.
- The `.claude/` directory remains a pure runtime configuration space.
- The same structural pattern established for skills in ADR-001 is applied consistently to agents.

## Alternatives Considered

- **`.claude/agents/` directly** (rejected): Treats source artifacts as runtime configuration and ties platform-agnostic content to Claude Code's directory convention — the same problem ADR-001 solved for skills.
