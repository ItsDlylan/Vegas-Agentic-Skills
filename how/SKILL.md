---
name: how
description: Explains how code works. Use for "how does X work", walkthroughs before changing something, and placement / ownership / layering questions ("where should this live", "which module owns this", "is this the right layer"). Builds a senior engineer's mental model of a subsystem's architecture and runtime flow. Use why for motivation and history.
---

# How

Explore the codebase to answer "how does X work?" questions. Produce architectural explanations at the level of a senior engineer onboarding onto a subsystem, enough to build a working mental model, not so much that it reads like annotated source code.

Every spawn is an `Agent` call and stays read-only. Explorers use `subagent_type: "Explore"` and `model: "sonnet"`. The explainer uses `subagent_type: "general-purpose"`, `model: "opus"`, and `effort: "xhigh"`, and its prompt ends with "Do not edit files." Run `git status` after each spawn returns and revert anything a spawn wrote.

## 1. Assess complexity

If the scope is ambiguous, state your interpretation and explore. The user can redirect.

- **Simple** (a single module, a small utility, a narrow question such as "how does function X work"): no explorers. Spawn one explainer that explores and explains in one pass, built from `references/explainer-prompt.md` without the explorer-findings section. Replace the paragraphs about explorers with "No explorers ran for this question. Explore the code yourself, then explain." Go to step 4.
- **Complex** (a subsystem spanning multiple files or services, a cross-cutting feature, a full architectural overview): go to step 2.

When in doubt, take the simple path.

## 2. Explore (complex only)

Decompose the question into 2 to 4 angles, each a distinct slice of the subsystem. Spawn all explorers in a single message, each with `references/explorer-prompt.md` and its angle filled in.

## 3. Synthesize (complex only)

Once all explorers have returned, spawn one explainer with `references/explainer-prompt.md` and every explorer's findings filled in.

## 4. Present

Present the explainer's output. Light edits for clarity or context from the conversation are fine. Do not substantially rewrite it.

## Output format

The explanation uses the sections defined in `references/explainer-prompt.md`, dropping any that do not apply: Overview, Key Concepts, How It Works, Where Things Live, Gotchas.
