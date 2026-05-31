# 004. Share One Source of Truth via SKILL.md Reference

Date: 2026-05-19

## Status

Superseded by [009-agent-file-owns-canonical-procedure-for-paired-units](009-agent-file-owns-canonical-procedure-for-paired-units.md)

## Context

A skill's procedure and the corresponding agent's system prompt must produce identical behavior. Cross-skill template references must not duplicate content. Without a single canonical location, changes to a skill's procedure must be replicated in every agent file and every cross-skill reference that embeds the same content — creating drift and inconsistency over time. `/issues` permanently owns the shared issue-body templates.

## Decision

Reference skills by path (SKILL.md) rather than embedding content in agent files or per-skill template copies. This keeps one canonical location for each skill's procedure and propagates changes automatically to all consumers.

## Consequences

- Agent system prompts that reference a skill stay up to date automatically when the skill file changes.
- Cross-skill template references remain consistent without manual synchronization.
- `/issues` remains the single owner of shared issue-body templates; no other skill may copy or embed those templates.
- Consumers of a skill must resolve the reference at runtime rather than having content inlined — tooling that loads agent system prompts must support path-based inclusion.

## Alternatives Considered

- **Embedding SKILL.md content in agent files**: duplicates content; any change to the skill requires a corresponding change in every agent file.
- **Per-skill template copies**: creates three or more sources of truth; divergence is inevitable as skills evolve independently.
