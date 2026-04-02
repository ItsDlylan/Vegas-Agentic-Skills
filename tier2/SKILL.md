---
name: tier2
description: Create a Tier 2 worktree environment with isolated database for feature development. Use when starting work that involves database migrations, data modifications, or any code changes that should be isolated from the main branch.
---

# Tier 2 Worktree Setup

Create an isolated development environment with its own git worktree, PostgreSQL database, and Herd site.

## When This Skill Is Invoked

1. **Ask for the feature/branch name** if not provided as an argument
2. **Create the worktree** using the project's worktree script
3. **Confirm the environment is ready** with database and site URL
4. **Change working context** to the new worktree directory

## Steps to Execute

### Step 1: Determine Branch Name

If the user provided a branch name as an argument, use it. Otherwise, ask:
- What feature are you working on? (This will become the branch name, e.g., `feature/card-search`)

### Step 2: Create the Worktree

Run the worktree creation command:

```bash
bin/worktree create <branch-name>
```

If the user wants to branch from a specific base branch (not main), use:

```bash
bin/worktree create <branch-name> --from <base-branch>
```

### Step 3: Verify and Report

After creation, run:

```bash
bin/worktree info <branch-name>
```

Report to the user:
- Worktree path (they should `cd` into this)
- Site URL (for browser testing)
- Database name (for reference)
- Remind them to run `npm run dev` if doing frontend work

### Step 4: Update Working Directory

Inform the user of the new working directory path and that subsequent commands should be run from there.

### Step 5: Rename Terminal Tab

Automatically rename the terminal tab to reflect the new work context:

1. Extract the task name from the branch (e.g., `feature/card-search` → `card-search`, `fix/bug-123` → `bug-123`)
2. Get the project name from the worktree directory
3. Call the title script:

```bash
~/.claude/scripts/set-title.sh "#PROJECT #BRANCH #TASK"
```

This happens automatically - no user input needed. The tab will reflect what you're working on.

## Example Output

After successful creation, provide a summary like:

```
✅ Tier 2 Environment Ready

📁 Worktree: ../PokemonTCG-worktrees/feature/card-search
🌐 Site URL: https://pokemontcg-feature_card_search.test
🗄️ Database: pokemon_tcg_feature_card_search
🏷️ Tab renamed: #PokemonTCG #feature/card-search #card-search

Next steps:
1. cd ../PokemonTCG-worktrees/feature/card-search
2. Run `npm run dev` for frontend changes
3. Start coding!
```

## Important Notes

- The database is seeded from `storage/app/database-dumps/copy-of-database.sql`
- Test account: `dfieldmark69@gmail.com` / `password`
- To remove later: `bin/worktree remove <branch-name>`
- Worktrees auto-cleanup when branches are merged (if git hooks are installed)
