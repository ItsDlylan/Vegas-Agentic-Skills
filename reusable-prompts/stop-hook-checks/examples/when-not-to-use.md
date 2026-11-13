# When the prompt does not fit

## The checks already fail on untouched code

If lint or tests fail before Claude changes anything, the hook blocks every stop that touches those files. Claude spends 3 attempts on a failure it did not cause, and then the cap lets it stop. Fix the baseline first, or tell Claude to leave that check out.

## The changed-file checks take minutes

Every stop waits for the hook. If the lint, type check or test run for a typical change takes more than a minute or two, run those checks in CI instead, or keep only the fast ones in the hook. A project-wide type check, such as `tsc --noEmit` on a large codebase, is the usual offender.

## You want formatting

A formatter that rewrites files belongs in a `PostToolUse` hook on `Write|Edit`, which runs after each edit. Putting it in the Stop hook means the files change after Claude has already reviewed them.

## You want a notification when Claude finishes

A sound or desktop notification never needs to block, so it doesn't need exit code 2 or a retry cap. Add it as its own Stop hook in `~/.claude/settings.json`, separate from the checks.
