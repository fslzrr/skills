---
name: interview
description: "(fslzrr) Conducts a relentless requirements interview — one question at a time with recommended answers and pushback — until a full shared understanding is confirmed and handed off to /prd. TRIGGER when: user says 'I have an idea', 'I want to build X', `let's figure out what to build`, 'interview me about', 'help me define requirements', or wants to start any new feature, bug fix, or enhancement."
---

Conduct a relentless requirements interview until you and the human have reached a complete, shared understanding of what needs to be built. Nothing should be left ambiguous or deferred to AI judgment.

## ADR guard

Before exploring the codebase, read `docs/adr/` once per session:

- If the directory does not exist or is empty, proceed without constraints.
- If ADRs exist, treat every recorded decision as a hard constraint. Do not propose, implement, or accept approaches that contradict them.

## How to conduct the interview

- Ask **one question at a time**. Wait for the answer before asking the next.
- For every question, **provide your recommended answer** and explain why. The human should be able to agree, disagree, or refine — not start from nothing.
- **Challenge every answer**. Do not accept a response at face value. Push back, probe for edge cases, expose assumptions. If an answer contradicts something said earlier, point it out.
- **Explore the codebase** before asking about anything that could be answered by reading the code. Do not ask the human what already exists — find it yourself.
- **Walk every branch of the design tree**. For each decision made, identify what decisions that unlocks or depends on, and pursue those next. Do not leave any branch unresolved.
- Do not move on until a decision is fully resolved. Partial answers lead to partial implementations.

## What the interview should naturally surface

Do not pre-organize findings around any document structure — just discover. Good interviews will tend to uncover:

- The problem being solved and who it affects
- The proposed solution and why it was chosen over alternatives
- Constraints, dependencies, and things that are explicitly out of scope
- Risks, edge cases, and failure modes
- What "done" looks like from the user's perspective

Do not treat this as a checklist to work through in order. Follow the conversation where it leads and pursue every unresolved branch.

## Exit criteria

When all branches are resolved and no open questions remain:

1. Produce a **free-form narrative summary** of the shared understanding in plain language. Write it as a coherent description of the problem and solution — not as a list of template sections.
2. Ask the human: "Does this summary accurately and completely capture our shared understanding? Confirm or correct anything before I proceed."
3. **Do not hand off to `/prd` until the human explicitly confirms.** If they correct something, update the summary and ask again.

## Tone

Be direct and thorough. This is a design review, not a conversation. The goal is to surface every hidden assumption, unresolved dependency, and unstated constraint — so none of them become problems during implementation.
