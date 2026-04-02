---
name: name-tab
description: Rename the terminal tab with #project #branch #task pattern. Works anytime during a session.
---

# Name Terminal Tab

Rename the current terminal tab/window with a clear, identifiable pattern.

**Format:** `#project #branch #task`

**Arguments:** `$ARGUMENTS` (optional: task description)

---

## Steps to Execute

### Step 1: Detect Project Name

Get the project name from the current working directory:

```bash
basename "$(pwd)"
```

If in a worktree, extract the main project name.

### Step 2: Detect Current Branch

```bash
git branch --show-current 2>/dev/null || echo "no-git"
```

Simplify long branch names:
- `feature/card-search` → `card-search`
- `fix/bug-123` → `bug-123`

### Step 3: Determine Task Description

If `$ARGUMENTS` was provided, use it as the task.

Otherwise, ask the user:
> "What task are you working on? (1-3 words, use hyphens)"

### Step 4: Update Terminal Title

Write the title to the watcher file:

```bash
~/.claude/scripts/set-title.sh "#PROJECT #BRANCH #TASK"
```

Replace PROJECT, BRANCH, and TASK with actual values.

### Step 5: Confirm to User

Display:

```
✅ Tab renamed: #PokemonTCG #develop #fixing-tests

The title watcher has updated your terminal tab.
```

---

## Important Notes

**This skill requires the title watcher to be running.** Start Claude with the `cn` command (defined in ~/.zshrc) which automatically starts the watcher.

If the title doesn't update, make sure you started Claude using:
```bash
cn            # starts Claude with title watcher
cn my-task    # starts with initial task name
```

---

## Examples

| Command | Result |
|---------|--------|
| `/name-tab` | Asks for task, then sets title |
| `/name-tab debugging` | Sets to `#project #branch #debugging` |
| `/name-tab price-scraper` | Sets to `#project #branch #price-scraper` |
