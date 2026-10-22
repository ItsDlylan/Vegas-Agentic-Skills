---
name: changelog
description: Update the README changelog with recent git commits. Groups by date, summarizes features/fixes, and maintains the existing format.
---

# Update Changelog

Reads recent git history and updates the `## Changelog` section in `README.md`.

**Arguments:** `$ARGUMENTS` (optional: date range like `04-15`, `04-13..04-15`, or `last 3 days`)

---

## Steps

### 1. Determine date range

- If `$ARGUMENTS` contains a date range (e.g. `04-13..04-15`), use those dates
- If `$ARGUMENTS` contains a single date (e.g. `04-15`), use that single day
- If `$ARGUMENTS` is `last N days`, compute the date range
- If `$ARGUMENTS` is empty, find the most recent changelog date in README.md and gather all commits since then

### 2. Gather commits

Run `git log` for the determined date range:
```bash
git log --oneline --format="%ai %s" --since="YYYY-MM-DD" --until="YYYY-MM-DD" --reverse
```

Filter out:
- `debug:` commits (temporary debugging)
- `chore:` commits unless they are significant
- Duplicate or superseded fixes (e.g. if a fix was iterated on, only mention the final state)

### 3. Read current changelog

Read `README.md` and find the `## Changelog` section. Note the existing date headers to avoid duplicates.

### 4. Group and summarize

Group commits by date. For each date, produce a bullet list:
- Use the commit's conventional prefix: `**feat:**`, `**fix:**`, `**refactor:**`, `**perf:**`, etc.
- Write a human-readable summary — don't just copy the commit message. Expand abbreviations, explain the user-facing impact
- Combine related commits into a single bullet (e.g. multiple VAD tuning fixes become one line)
- Order: features first, then fixes, then refactors/chores
- Keep descriptions concise but informative — one to two lines per bullet

### 5. Update README.md

- If the date already has an entry in the changelog, **replace it** with the updated version
- If it's a new date, insert it **below the `## Changelog` header** and **above existing entries** (newest first)
- Preserve all content below the changelog section (e.g. `## License`)

### 6. Verify

- Read back the updated section to confirm formatting is correct
- Ensure no existing entries for other dates were accidentally removed or modified

---

## Format Reference

```markdown
## Changelog

### YYYY-MM-DD

- **feat:** Short description of the feature — additional context about what it does and why it matters
- **feat:** Another feature with supporting detail
- **fix:** What was broken and how it was fixed
- **refactor:** What was restructured and why
- **perf:** What performance improvement was made

### YYYY-MM-DD (previous)

- ...
```

---

## Rules

- Never remove existing changelog entries for dates you are not updating
- If a date section already exists and you are updating it, replace the entire section for that date
- Do not include raw commit hashes in the changelog
- Do not include debug/temporary commits
- Combine iterative fix commits into one bullet describing the final outcome
- Always run `git log` — never guess or fabricate commit history
