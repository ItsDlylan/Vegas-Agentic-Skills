---
name: agent-canvas-tier2
description: Create a Tier 2 worktree environment inside AgentCanvas with automatic metadata registration. The worktree URL, path, and database are linked to the terminal tile so the agent-canvas-agent-browser skill can auto-discover it. Use when running inside an AgentCanvas terminal and starting work that involves database migrations, data modifications, or any code changes that should be isolated from the main branch.
---

# AgentCanvas Tier 2 Worktree Setup

Create an isolated development environment with its own git worktree, database, and Herd site — with full canvas integration. The worktree metadata is registered on the terminal tile so `/agent-canvas-agent-browser` can auto-discover the site URL.

## Prerequisites

You must be running inside an AgentCanvas terminal. Verify:

```bash
echo $AGENT_CANVAS_API
echo $AGENT_CANVAS_TERMINAL_ID
```

Both must be set. If not, fall back to the standard `/tier2` skill.

## When This Skill Is Invoked

1. **Ask for the feature/branch name** if not provided as an argument
2. **Create the worktree** using the project's `bin/worktree` script
3. **Register worktree metadata** on the terminal tile via the Canvas API
4. **Confirm the environment is ready** and offer to open the browser tile
5. **Change working context** to the new worktree directory

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

### Step 3: Get Worktree Info

After creation, run:

```bash
bin/worktree info <branch-name>
```

Parse the output for:
- **Worktree path** (e.g., `../PokemonTCG-worktrees/feature/card-search`)
- **Site URL** (e.g., `https://pokemontcg-feature_card_search.test`)
- **Database name** (e.g., `pokemon_tcg_feature_card_search`)

### Step 4: Register Metadata on the Terminal Tile

This is the key canvas integration step. Store the worktree info on the terminal tile so other skills can discover it:

```bash
curl -s -X POST $AGENT_CANVAS_API/api/terminal/metadata \
  -H 'Content-Type: application/json' \
  -d "{
    \"terminalId\": \"$AGENT_CANVAS_TERMINAL_ID\",
    \"key\": \"worktree\",
    \"value\": {
      \"branch\": \"<branch-name>\",
      \"path\": \"<worktree-path>\",
      \"url\": \"<site-url>\",
      \"database\": \"<database-name>\"
    }
  }"
```

Verify the response contains `{"ok":true}`.

### Step 5: Rename Terminal Tab

Automatically rename the terminal tab to reflect the new work context:

1. Extract the task name from the branch (e.g., `feature/card-search` → `card-search`)
2. Get the project name from the worktree directory
3. Call the title script:

```bash
~/.claude/scripts/set-title.sh "#PROJECT #BRANCH #TASK"
```

### Step 6: Report and Offer Browser

Report to the user:

```
✅ Tier 2 Environment Ready (Canvas-linked)

📁 Worktree: ../Project-worktrees/feature/card-search
🌐 Site URL: https://project-feature_card_search.test
🗄️ Database: project_feature_card_search
🏷️ Tab renamed: #Project #feature/card-search #card-search
🔗 Metadata registered on terminal tile

Would you like me to open the site in a browser tile on the canvas?
```

If the user says yes, spawn the browser tile:

```bash
SPAWN_RESULT=$(curl -s -X POST $AGENT_CANVAS_API/api/browser/open \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"<site-url>\",\"terminalId\":\"$AGENT_CANVAS_TERMINAL_ID\"}")
echo $SPAWN_RESULT
```

### Step 7: Update Working Directory

```bash
cd <worktree-path>
```

Inform the user of the new working directory path and that subsequent commands should be run from there.

## How This Integrates with `/agent-canvas-agent-browser`

Once metadata is registered, `/agent-canvas-agent-browser` can auto-discover the worktree URL:
- It queries `GET $AGENT_CANVAS_API/api/status`
- Finds the terminal matching `$AGENT_CANVAS_TERMINAL_ID`
- Reads `metadata.worktree.url`
- Uses it as the default browser URL when no URL is explicitly provided

This means after running this skill, the user can simply say "open the browser" and the agent-canvas-agent-browser skill will automatically navigate to the worktree's site.

## Important Notes

- The metadata persists on the terminal session for its lifetime
- The original `/tier2` skill remains unchanged for non-canvas terminals
- The database is seeded from `storage/app/database-dumps/copy-of-database.sql`
- Test account: `dfieldmark69@gmail.com` / `password`
- To remove later: `bin/worktree remove <branch-name>`
- Worktrees auto-cleanup when branches are merged (if git hooks are installed)
