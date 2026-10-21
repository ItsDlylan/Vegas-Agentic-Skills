# Sweep mode

A sweep runs unattended on a timer. Never call `AskUserQuestion`. What this file allows is pre-approved. Everything else goes in the report as open work. The sweep branch is the approval gate: nothing reaches the base branch until a person reviews and merges it.

Read the project's `CLAUDE.md` or `AGENTS.md` first. Its rules on branches, commits, formatting, tests, and PRs override the defaults below.

## 1. Preflight

1. Run `git fetch origin`. The base branch is the first that applies: the branch the project's agent docs say PRs target; `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` on a GitHub remote; `git symbolic-ref --short refs/remotes/origin/HEAD` without its `origin/` prefix; `main`.
2. One open sweep per repo. If `git branch -r --list 'origin/chore/no-comments-*' --no-merged origin/<base>` prints a branch, stop and report it.
3. Load state with `git show origin/no-comments/state:state.json`. If that branch does not exist, this is the first sweep. Start from:

   ```json
   { "version": 1, "lastSweep": null, "backlogCursor": null, "keeps": [] }
   ```

   Each keep is `{ "file", "comment", "clause", "proof", "checked" }`, where `comment` is the exact comment text and `checked` is `YYYY-MM-DD`.
4. Record `BASE_SHA=$(git rev-parse origin/<base>)`. It becomes the next `lastSweep`.

## 2. Checkout

Create branch `chore/no-comments-<YYYY-MM-DD>` from `origin/<base>`. Use the first option that fits:

- **Local Laravel project** (`artisan` and `.env` at the root, and `~/.claude/scripts/worktree` exists): `~/.claude/scripts/worktree create <branch> --from origin/<base>`. It installs dependencies and creates the test database. `~/.claude/scripts/worktree info <branch>` prints the path. If it stops partway, for example because the database user cannot create databases, keep the worktree it made, copy `.env` and `.env.testing` from the main checkout, and install dependencies yourself.
- **Other local project:** `git worktree add -b <branch> ../<repo>-worktrees/<branch> origin/<base>`, then install dependencies from the lockfile.
- **Cloud routine** (no `~/.claude/scripts/worktree`): the checkout is already disposable. Run `git checkout -b <branch> origin/<base>`.

Every later step runs in that checkout. Give every subagent its absolute path.

## 3. Scope

Candidates are the source files in `git ls-files`: code extensions only (`.php`, `.js`, `.jsx`, `.ts`, `.tsx`, `.vue`, `.svelte`, `.swift`, `.kt`, `.py`, `.rb`, `.go`, `.rs`, and the like). Leave out vendored, generated, and build paths (`vendor/`, `node_modules/`, `dist/`, `build/`, `public/build/`, `storage/`, `bootstrap/cache/`, `*.min.*`, snapshots, fixtures, anything `.gitattributes` marks `linguist-generated` or `linguist-vendored`) and agent and doc files (`.claude/`, `.ai/`, `docs/`). Sort the list.

The scope is the union of:

- **Changed:** candidates in `git diff --numstat --diff-filter=d <lastSweep> <BASE_SHA>`, ranked by lines added, most first. Empty on the first sweep, or when `lastSweep` is no longer in history.
- **Backlog:** the next 25 candidates after `backlogCursor` in the sorted list, wrapping to the start at the end.

Cap the scope at 60 files, changed files first in rank order. Changed files past the cap wait for the backlog to reach them.

Split the scope into batches of at most 20 files, grouped by directory. Spawn one Comment Sicko per batch, all in a single message. No two batches share a file.

Hand each Comment Sicko the keeps for its files. Drop keeps whose comment text no longer exists. A keep with `checked` older than 90 days goes back to Comment Sicko as an ordinary comment.

## 4. Budget

- `how`: simple path only, at most 5 per sweep.
- `why`: at most 2 per sweep, only for constraint claims (`do not remove`, `NEVER change`, `talk to X`).
- Past the budget, the claim counts as ambiguous. The kill stands, the keep dies, and the claim is reported open.

## 5. What you may change

Without asking:

- Delete comments that Comment Sicko killed and you accepted.
- Make trivial fixes inside scope: delete a dead path, drop an unused parameter, call the real API a workaround wrapped, or rename a private symbol so its comment is no longer needed.

Never in a sweep:

- `Plan` sketches, new abstractions, or multi-file refactors.
- Encodings: new tests, lint rules, or `CLAUDE.md` lines.
- Public API, config, migration, or dependency changes.
- Anything outside scope.

Each of these becomes an open item with `file:line` and one line on the intended fix.

A comment whose claim is true today stays when its `MUST KILL` fix is not one this sweep may make. Deleting it would remove the warning and keep the trap. Restore it, report the flag open, and let the comment go when the fix lands.

## 6. Ship

Run this after steps 1 to 7 of `SKILL.md`.

1. If the checkout has changes, commit them as `chore(no-comments): sweep <YYYY-MM-DD>` and push with `git push -u origin <branch>`. On a GitHub remote, open the PR with `gh pr create --base <base> --title "chore: sweep comments (<YYYY-MM-DD>)"`. On any other forge, report the branch and the PR body so a person can open it. The body has two sections only: a summary (deletions, restores, fixes, reverts, open items) and a test plan (the checks from step 6 of `SKILL.md` and their results).
2. Save state once the branch is pushed, or when the sweep changed nothing. If the push failed, skip this step so the next sweep covers the same range. Set `lastSweep` to `BASE_SHA` and `backlogCursor` to the last backlog file swept. Add the keeps Comment Sicko proved this run, with `checked` set to today. Write `state.json` outside the checkout, then publish it:

   ```bash
   blob=$(git hash-object -w <path-to-state.json>)
   tree=$(printf '100644 blob %s\tstate.json\n' "$blob" | git mktree)
   if parent=$(git rev-parse -q --verify origin/no-comments/state); then
     commit=$(git commit-tree "$tree" -p "$parent" -m "no-comments state <YYYY-MM-DD>")
   else
     commit=$(git commit-tree "$tree" -m "no-comments state <YYYY-MM-DD>")
   fi
   git push origin "${commit}:refs/heads/no-comments/state"
   ```

   If the push is refused, say so in the report. The next sweep rescans the same range.
3. Remove a local checkout after pushing: `~/.claude/scripts/worktree remove <branch>`, or `git worktree remove <path>`.
4. Report the branch or PR URL (or "nothing to sweep"), the counts, and the open items.
