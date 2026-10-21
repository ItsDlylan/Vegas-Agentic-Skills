---
name: no-comments
description: Runs Comment Sicko, a fresh-eyes reviewer that deletes narrating, shouting ("IMPORTANT", "NEVER", "do not remove"), and workaround comments, then fixes the code those comments apologize for and offers to encode real constraints as types, tests, or lint. Use only when the user asks to run no-comments, strip or sweep comments, or schedule a comment sweep. `/no-comments sweep` is the unattended mode for /loop and /schedule.
---

# No comments

Adapted from poteto's `no-comments` skill and Comment Sicko agent in pstack (MIT, see `LICENSE`).

Spawn Comment Sicko. Act on accepted findings.

Defer to Comment Sicko's fresh perspective.

## Modes

- **Diff** (default, interactive). Use the caller's files or diff. Otherwise use the current diff against the base branch, default `main`, including the working tree. Comment Sicko runs at full appetite, because you review the diff before it lands.
- **Sweep** (`/no-comments sweep`, unattended). Read `references/sweep.md` before step 1. It sets the scope, the checkout, the budget, and what you may change without asking. The steps below run with its overrides. End each Comment Sicko prompt with `Mode: sweep.` so it hunts slop only and keeps accurate rationale.

`how` and `why` live beside this skill. Paths below are relative to this skill's directory.

## Steps

1. Spawn `Agent` with `subagent_type: "general-purpose"`, `model: "opus"`, `effort: "high"`. Its prompt is `references/comment-sicko.md` verbatim, then the absolute checkout root, the paths of the project's `CLAUDE.md` or `AGENTS.md`, and the scope (file list or diff command), and in sweep mode the proven keeps for those files. Do not restate its rules. Past 20 files, split the scope by directory and spawn one Comment Sicko per batch in a single message.
2. Inspect its report and `git diff`. Reject application-code edits, scope escapes, exception-protected deletions, misstated `MUST KILL` reasons, and flags that treat kept intentional code as guilty. Reshape flags on our-code surprises stay actionable. Do not restore those comments. A keep survives only with proof it is about something we cannot change. Audit missed scoped lint and type suppressions. Correctness or safety suppressions stay actionable `MUST KILL`s. Restore deletions only with exact exceptions and scoped proof. Before accepting a Thin kill or keep, check its symbol: read `../how/SKILL.md` and follow it when the question is whether the claim holds in the code, or `../why/SKILL.md` when the question is whether the reason is still real. If a kill is ambiguous, do not restore. If a keep is refuted or still ambiguous, delete it. Revert and rerun one rejected report with the failure named. Reject a second, report it open, and fail `/no-comments`.
3. Fix trivial accepted flags directly by deleting a dead path, dropping a parameter, or using the real API. If any fix needs a shape, spawn one `Plan` agent for the accepted set and surrounding code. Stop at its sketch. Step 4 implements.
4. Implement the smallest root-cause fix in scope. Remove every named workaround. If the root cause is out of scope, land the smallest in-scope fix and report the rest open. Never widen the scope to fix other instances. Never bolt on symptom guards.
5. Constraint comments say `do not remove`, `do not change wording`, `NEVER change`, or `talk to X before changing`. Leave keeps about things we cannot change. Offer the cheapest in-scope type, runtime check, test, or CI lint with `AskUserQuestion`. When no mechanical encoding fits and agents keep breaking the rule, the last offer is one plain sentence in the project's `CLAUDE.md`. If approved, encode then delete. Otherwise delete, report the constraint open, and sketch out-of-scope work.
6. Verify with the project's own commands, taken from its agent docs, `composer.json` or `package.json` scripts, or a `Makefile`. Run its formatter on touched paths only, then lint, type check, and static analysis, then the tests that cover touched files. Use the project's isolated test runner when its docs name one, and never run the full suite unless they allow it. If a check fails, revert fixes one at a time until it passes. If it still fails, restore the deletions in the failing files. A restored comment that a tool reads goes in the report, so Comment Sicko's tool-read list can grow.
7. Report the deletion count, restored comments, reruns, Plan sketch, fixes, reverts, encoding offers, encodings, unenforced constraints, and other open work. In an AgentCanvas terminal (`$AGENT_CANVAS_TERMINAL_ID` set), also file each open item with `task_create`.

## Scheduling

Run from the project root.

- Local: `/loop <interval> /no-comments sweep`. It runs while the session stays open.
- Cloud: `/schedule` a routine on the repo with the prompt `/no-comments sweep`. The cloud checkout only has skills committed to the project or installed as a plugin, so `no-comments`, `how`, and `why` must be available there.
