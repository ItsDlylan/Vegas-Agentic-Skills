# Stop hook for lint, type checks and tests

Paste this into Claude Code from the root of the repository:

```
Set up a Claude Code Stop hook in this repository that runs lint, type checks and tests on the files changed in the working tree. On failure, exit with code 2 and put the error output on stderr so Claude retries. Cap it at 3 failed attempts per session, then exit 0. Test it by piping a fake payload into the script.
```

## Why each clause is there

- **Files changed in the working tree** keeps each run to seconds instead of the full suite on every stop.
- **Exit code 2 with stderr** is the only result that sends Claude back to work with the error. Exit 1 shows the error to you, and Claude stops anyway.
- **Cap at 3 attempts** stops an endless loop when a failure can't be fixed, such as a test that was already broken or a tool that isn't installed.
- **Pipe a fake payload** makes Claude run the script before it reports back. A Stop hook only fires when a turn ends, so Claude can't trigger it during the setup turn.

## After Claude finishes

- Open `/hooks` once or restart Claude Code so the new hook loads.
- Commit the script and `.claude/settings.json` so worktrees and other clones get the hook.
