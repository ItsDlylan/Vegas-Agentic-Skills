---
name: agent-canvas-agent-browser
description: Browser automation inside AgentCanvas — spawns a live browser tile on the canvas and controls it via CDP. Use when running inside an AgentCanvas terminal and the user needs to navigate, test, or research a website visually on the canvas.
allowed-tools: Bash, AskUserQuestion
disallowed-tools: Bash(npx agent-browser close --all:*), Bash(agent-browser close --all:*)
model: haiku
---

# AgentCanvas Browser Automation

This skill wraps `agent-browser` to work with AgentCanvas's browser tiles. Instead of spawning a separate browser window, commands route through a live `<webview>` tile on the infinite canvas — the user can watch and interact with the browser in real-time while you control it via CDP.

## Prerequisites

You must be running inside an AgentCanvas terminal. Verify with:

```bash
echo $AGENT_CANVAS_API
echo $AGENT_BROWSER_CDP_PORT
echo $AGENT_CANVAS_TERMINAL_ID
```

All three must be set. If not, this skill won't work — fall back to the standard `/agent-browser` skill.

## How It Works

1. You call the Canvas API to spawn a browser tile → a real `<webview>` appears on the canvas next to your terminal
2. The API response contains the `cdpPort` — capture it as `$CDP_PORT`
3. You run `npx agent-browser connect $CDP_PORT` then commands auto-target the canvas tile
4. The user sees every action live and can interact with the browser manually at the same time

## ▶️ When Invoked: Required First Steps (do these IN ORDER)

These guarantee you target **your** terminal's tile and never collide with another agent's browser on the shared daemon. Skipping them is how you end up driving — and logging out — someone else's session.

### Step 1 — Discover the tiles already attached to YOUR terminal

```bash
curl -s "$AGENT_CANVAS_API/api/tile/discover?terminalId=$AGENT_CANVAS_TERMINAL_ID&types=browsers" \
  | python3 -c "import sys,json; b=json.load(sys.stdin)['tilesByType'].get('browsers',[]); print(json.dumps(b,indent=2))"
```

Every entry is a browser tile **linked to your terminal** (`linkedTerminalId == $AGENT_CANVAS_TERMINAL_ID`), with its `sessionId` and current `url`. Use this to:
- **Reuse** an existing tile (grab its `sessionId`) instead of spawning a duplicate.
- **Know which tile is yours.** Never drive a tile whose `linkedTerminalId` is not your terminal — that's another agent's browser.

### Step 2 — Spawn the browser tile ATTACHED to your terminal (capture `cdpPort` AND `sessionId`)

Always pass `terminalId` so the tile is **bound to your terminal** and reuses your terminal's pre-allocated CDP port (`$AGENT_BROWSER_CDP_PORT`). Capture **both** `cdpPort` and `sessionId` from the response — you need the sessionId to target/close exactly your tile later.

```bash
SPAWN=$(curl -s -X POST $AGENT_CANVAS_API/api/browser/open \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"<target-url>\",\"terminalId\":\"$AGENT_CANVAS_TERMINAL_ID\"}")
CDP_PORT=$(echo "$SPAWN" | grep -o '"cdpPort":[0-9]*' | grep -o '[0-9]*')
SID=$(echo "$SPAWN" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
echo "my tile → cdpPort=$CDP_PORT sessionId=$SID"
sleep 3   # let the webview mount
```

### Step 3 — Verify the tile is yours BEFORE interacting

Connect, then confirm the host before any click/fill/navigate. Prefer `--cdp $CDP_PORT` on commands so you only ever talk to your own tile:

```bash
npx agent-browser connect $CDP_PORT
npx agent-browser --cdp $CDP_PORT get url   # MUST match your <target-url> host
```

If the URL is not your expected host, **STOP** — you're likely pointed at another agent's tile. Re-check Steps 1–2; do not navigate, fill, or log anything out.

## 🛑 CRITICAL: NEVER run `agent-browser close --all` without explicit permission

`agent-browser` uses a **single shared daemon** across every terminal and browser tile on this machine. `npx agent-browser close --all` tears down **all** of that daemon's sessions — including tiles that **other agents on the canvas are actively driving**. Running it routinely (as a "clear stale session" step before `connect`) has logged out and hijacked another agent's live session. There is **no routine need** for it.

**Hard rule:** Do NOT run `npx agent-browser close --all` (or any `close --all`) unless you have FIRST asked the user with the **AskUserQuestion** tool and they explicitly approved it. If they don't approve, find another way. This command is also listed in this skill's `disallowed-tools` frontmatter, so the harness blocks it while the skill is active — if you genuinely need it, asking the user is the only path, and they must lift the block themselves.

**You almost never need it.** Three safe alternatives, in order of preference:

1. **Just `connect`.** `npx agent-browser connect $CDP_PORT` re-points the daemon at your tile on its own — you do NOT need to close anything first.
2. **Pass `--cdp` on every command.** `npx agent-browser --cdp $CDP_PORT snapshot -i` talks only to YOUR tile and never touches the shared default session, so it can't disturb another agent.
3. **Close one specific tile by id**, never all of them: `curl -s -X POST $AGENT_CANVAS_API/api/browser/close -d '{"sessionId":"<your-sessionId>"}'`.

This rule overrides any `close --all` shown in the examples below — those are legacy and must not be copied verbatim.

## Auto-Discovery: Worktree URL

Before spawning a browser tile, check if the terminal has worktree metadata registered (set by `/agent-canvas-tier2`):

```bash
WORKTREE_URL=$(curl -s $AGENT_CANVAS_API/api/status | \
  python3 -c "import sys,json; d=json.load(sys.stdin); \
  t=next((t for t in d.get('terminals',[]) if t['id']=='$AGENT_CANVAS_TERMINAL_ID'),None); \
  print(t.get('metadata',{}).get('worktree',{}).get('url','') if t else '')" 2>/dev/null)
```

If `WORKTREE_URL` is non-empty and the user hasn't specified a URL, use it as the default target URL when spawning the browser tile. This creates a seamless workflow: after `/agent-canvas-tier2` creates a worktree, the user can say "open the browser" and you'll automatically navigate to the worktree's site.

If the user provides an explicit URL, always use that instead.

## ⚠️ CRITICAL: Always Spawn the Tile First

Before running any `agent-browser` command, you MUST spawn the browser tile via the Canvas API. The API returns the CDP port to use. **You MUST capture this port from the response.**

```bash
# Step 1: Spawn the tile ATTACHED to your terminal; capture cdpPort AND sessionId
SPAWN_RESULT=$(curl -s -X POST $AGENT_CANVAS_API/api/browser/open \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"https://example.com\",\"terminalId\":\"${AGENT_CANVAS_TERMINAL_ID:-}\"}")
CDP_PORT=$(echo $SPAWN_RESULT | grep -o '"cdpPort":[0-9]*' | grep -o '[0-9]*')
SID=$(echo $SPAWN_RESULT | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)

# Step 2: Wait for the webview to mount
sleep 3

# Step 3: Connect the daemon to the canvas tile.
# `connect` alone re-points the daemon — do NOT run `close --all` (see the rule above).
npx agent-browser connect $CDP_PORT

# Step 4: Verify you're on YOUR tile's expected host, THEN run commands
npx agent-browser --cdp $CDP_PORT get url   # sanity-check before acting
npx agent-browser snapshot -i
```

**IMPORTANT:** agent-browser uses a persistent daemon. You MUST run `connect <port>` to point the daemon at the canvas tile's CDP port. After connecting, all subsequent commands automatically use that port — do NOT pass `--cdp` on every command.

**The CDP port from the response is authoritative.** Always parse it from the curl response.

## ⚠️ CRITICAL: Three-Tier Architecture for Cost

Browser automation is expensive. Use this architecture to cut costs 15x+:

```
MAIN OPUS (orchestrator) ─── keeps context clean, spawns planner
       │
       ▼
OPUS AGENT (planner) ─────── spawns canvas tile, explores page, plans commands, spawns Haikus
       │
       ├──► HAIKU Agent 1 ─── executes exact commands (daemon already connected)
       │
       └──► HAIKU Agent 2 ─── executes exact commands (daemon already connected)
```

### How to Invoke from Main Opus

```javascript
Agent({
  model: "opus",
  prompt: `You are a browser automation planner running inside AgentCanvas.

**Your task:** [DESCRIBE THE GOAL]

**Your workflow:**

1. **Spawn the browser tile and capture the CDP port:**
   \`\`\`bash
   SPAWN_RESULT=$(curl -s -X POST $AGENT_CANVAS_API/api/browser/open \
     -H 'Content-Type: application/json' \
     -d "{\"url\":\"<target-url>\",\"terminalId\":\"${AGENT_CANVAS_TERMINAL_ID:-}\"}")
   CDP_PORT=$(echo $SPAWN_RESULT | grep -o '"cdpPort":[0-9]*' | grep -o '[0-9]*')
   sleep 3
   \`\`\`

2. **Connect the daemon to the canvas tile:**
   \`\`\`bash
   # `connect` alone re-points the daemon — never prefix with `close --all` (see the rule near the top).
   npx agent-browser connect $CDP_PORT
   \`\`\`

3. **Scout the page:**
   \`\`\`bash
   npx agent-browser snapshot -i
   \`\`\`
   Find the element refs you need.

4. **Plan the exact commands** for the task.

5. **Spawn TWO Haiku agents IN PARALLEL** with explicit commands:
   Give each Haiku the exact Bash commands to run.
   The daemon is already connected — no \`--cdp\` flag needed.

6. **Compare results** from both Haikus and report.

**Haiku prompt template:**
\`\`\`
Run these exact Bash commands in order using the Bash tool:
1. npx agent-browser snapshot -i
2. npx agent-browser fill @e7 "search term"
3. npx agent-browser press Enter
4. npx agent-browser wait 2000
5. npx agent-browser screenshot /tmp/result.png
Report what you see.
\`\`\`
`
})
```

### ⚠️ Haiku Needs EXPLICIT Commands

Haiku will hallucinate if given vague goals. Always provide exact Bash commands:

```
❌ BAD:  "Search for Pikachu on the cards page"
✅ GOOD: "Run these exact Bash commands:
         1. npx agent-browser fill @e7 'Pikachu'
         2. npx agent-browser press Enter"
```

## Quick Start

```bash
# 1. Spawn browser tile and capture CDP port
SPAWN_RESULT=$(curl -s -X POST $AGENT_CANVAS_API/api/browser/open \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"https://example.com\",\"terminalId\":\"${AGENT_CANVAS_TERMINAL_ID:-}\"}")
CDP_PORT=$(echo $SPAWN_RESULT | grep -o '"cdpPort":[0-9]*' | grep -o '[0-9]*')
sleep 3

# 2. Connect the daemon to the canvas tile
# `connect` alone re-points the daemon — do NOT run `close --all` (see the rule near the top).
npx agent-browser connect $CDP_PORT

# 3. Now all commands auto-target the canvas tile (no --cdp needed):
npx agent-browser snapshot -i       # Get interactive elements
npx agent-browser click @e1         # Click element
npx agent-browser fill @e2 "text"   # Fill input
npx agent-browser screenshot r.png  # Screenshot
```

## Core Workflow

1. **Spawn tile and capture port**: `curl` the Canvas API, parse `cdpPort` from response
2. **Wait for webview**: `sleep 3`
3. **Connect daemon**: `npx agent-browser connect $CDP_PORT` (do NOT prefix with `close --all` — see the rule near the top)
4. **Snapshot**: `npx agent-browser snapshot -i` (returns refs like `@e1`, `@e2`)
5. **Interact** using refs from the snapshot
6. **Re-snapshot** after navigation or major DOM changes
7. **Navigate** to new pages: `npx agent-browser open <new-url>`

Note: You do NOT need to `close` the browser — the tile stays on the canvas for the user. Only close if explicitly asked.

## Commands

After running `connect`, all commands auto-target the canvas tile. For brevity `ab` is used below:

```bash
ab="npx agent-browser"
```

### Navigation
```bash
$ab open <url>       # Navigate to URL
$ab back             # Go back
$ab forward          # Go forward
$ab reload           # Reload page
```

### Snapshot (page analysis)
```bash
$ab snapshot            # Full accessibility tree
$ab snapshot -i         # Interactive elements only (recommended)
$ab snapshot -c         # Compact output
$ab snapshot -d 3       # Limit depth to 3
$ab snapshot -s "#main" # Scope to CSS selector
```

### Interactions (use @refs from snapshot)
```bash
$ab click @e1           # Click
$ab dblclick @e1        # Double-click
$ab focus @e1           # Focus element
$ab fill @e2 "text"     # Clear and type
$ab type @e2 "text"     # Type without clearing
$ab press Enter         # Press key
$ab press Control+a     # Key combination
$ab hover @e1           # Hover
$ab check @e1           # Check checkbox
$ab uncheck @e1         # Uncheck checkbox
$ab select @e1 "value"  # Select dropdown
$ab scroll down 500     # Scroll page
$ab scrollintoview @e1  # Scroll element into view
$ab drag @e1 @e2        # Drag and drop
$ab upload @e1 file.pdf # Upload files
```

### Get information
```bash
$ab get text @e1        # Get element text
$ab get html @e1        # Get innerHTML
$ab get value @e1       # Get input value
$ab get attr @e1 href   # Get attribute
$ab get title           # Get page title
$ab get url             # Get current URL
$ab get count ".item"   # Count matching elements
$ab get box @e1         # Get bounding box
```

### Check state
```bash
$ab is visible @e1      # Check if visible
$ab is enabled @e1      # Check if enabled
$ab is checked @e1      # Check if checked
```

### Screenshots & PDF
```bash
$ab screenshot              # Screenshot to stdout
$ab screenshot path.png     # Save to file
$ab screenshot --full       # Full page
$ab pdf output.pdf          # Save as PDF
```

### Wait
```bash
$ab wait @e1                     # Wait for element
$ab wait 2000                    # Wait milliseconds
$ab wait --text "Success"        # Wait for text
$ab wait --url "**/dashboard"    # Wait for URL pattern
$ab wait --load networkidle      # Wait for network idle
$ab wait --fn "window.ready"     # Wait for JS condition
```

### Cookies & Storage
```bash
$ab cookies                     # Get all cookies
$ab cookies set name value      # Set cookie
$ab cookies clear               # Clear cookies
$ab storage local               # Get all localStorage
$ab storage local set k v       # Set value
$ab storage local clear         # Clear all
```

### Network
```bash
$ab network route <url>              # Intercept requests
$ab network route <url> --abort      # Block requests
$ab network route <url> --body '{}'  # Mock response
$ab network requests                 # View tracked requests
$ab network requests --filter api    # Filter requests
```

### Browser settings
```bash
$ab set viewport 1920 1080      # Set viewport size
$ab set device "iPhone 14"      # Emulate device
$ab set geo 37.7749 -122.4194   # Set geolocation
$ab set offline on              # Toggle offline mode
$ab set headers '{"X-Key":"v"}' # Extra HTTP headers
$ab set credentials user pass   # HTTP basic auth
$ab set media dark              # Emulate color scheme
```

### JavaScript
```bash
$ab eval "document.title"   # Run JavaScript
```

## Example: Research a Website

```bash
# Spawn the tile and capture CDP port
SPAWN_RESULT=$(curl -s -X POST $AGENT_CANVAS_API/api/browser/open \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"https://maisonneptune.com\",\"terminalId\":\"${AGENT_CANVAS_TERMINAL_ID:-}\"}")
CDP_PORT=$(echo $SPAWN_RESULT | grep -o '"cdpPort":[0-9]*' | grep -o '[0-9]*')
sleep 3

# Connect the daemon to the canvas tile
# `connect` alone re-points the daemon — do NOT run `close --all` (see the rule near the top).
npx agent-browser connect $CDP_PORT

# Scout the page
npx agent-browser snapshot -i
# Look at the page structure, find nav links

# Navigate to key pages
npx agent-browser click @e5  # e.g. "About" link
npx agent-browser wait --load networkidle
npx agent-browser snapshot -c  # Compact text snapshot

# Take screenshots for reference
npx agent-browser screenshot /tmp/about.png
```

## Example: Form Testing

```bash
# Spawn tile on the form page and capture CDP port
SPAWN_RESULT=$(curl -s -X POST $AGENT_CANVAS_API/api/browser/open \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"https://example.com/contact\",\"terminalId\":\"${AGENT_CANVAS_TERMINAL_ID:-}\"}")
CDP_PORT=$(echo $SPAWN_RESULT | grep -o '"cdpPort":[0-9]*' | grep -o '[0-9]*')
sleep 3

# Connect the daemon to the canvas tile
# `connect` alone re-points the daemon — do NOT run `close --all` (see the rule near the top).
npx agent-browser connect $CDP_PORT

# Get form elements
npx agent-browser snapshot -i
# Output: textbox "Name" [ref=e1], textbox "Email" [ref=e2], button "Send" [ref=e3]

# Fill and submit
npx agent-browser fill @e1 "Jane Doe"
npx agent-browser fill @e2 "jane@example.com"
npx agent-browser click @e3
npx agent-browser wait --load networkidle
npx agent-browser snapshot -i  # Check result
```

## Example: Authentication with Saved State

```bash
# Spawn and login — capture CDP port
SPAWN_RESULT=$(curl -s -X POST $AGENT_CANVAS_API/api/browser/open \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"https://app.example.com/login\",\"terminalId\":\"${AGENT_CANVAS_TERMINAL_ID:-}\"}")
CDP_PORT=$(echo $SPAWN_RESULT | grep -o '"cdpPort":[0-9]*' | grep -o '[0-9]*')
sleep 3

# Connect the daemon to the canvas tile
# `connect` alone re-points the daemon — do NOT run `close --all` (see the rule near the top).
npx agent-browser connect $CDP_PORT

npx agent-browser snapshot -i
npx agent-browser fill @e1 "username"
npx agent-browser fill @e2 "password"
npx agent-browser click @e3
npx agent-browser wait --url "**/dashboard"
npx agent-browser state save auth.json

# Later — load saved state
npx agent-browser state load auth.json
npx agent-browser open https://app.example.com/dashboard
```

## Example: Parallel Testing with Incognito Tiles

For testing features that require two simultaneous users in the same app (chat
messaging, real-time collaboration, multiplayer flows), spawn one normal tile
and one incognito tile pointing at the same URL. They will not share cookies,
so each can log in as a different user.

```bash
URL="https://chat.example.com"

# Tile A — normal session (logs in as user A, persists across restarts)
A=$(curl -s -X POST $AGENT_CANVAS_API/api/browser/open \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"$URL\",\"terminalId\":\"${AGENT_CANVAS_TERMINAL_ID:-}\"}")
A_PORT=$(echo $A | grep -o '"cdpPort":[0-9]*' | grep -o '[0-9]*')
A_SID=$(echo $A | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)

# Tile B — incognito twin of A (isolated cookies, dashed amber edge on canvas)
B=$(curl -s -X POST $AGENT_CANVAS_API/api/browser/open \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"$URL\",\"incognito\":true,\"linkedBrowserId\":\"$A_SID\"}")
B_PORT=$(echo $B | grep -o '"cdpPort":[0-9]*' | grep -o '[0-9]*')

sleep 3

# The agent-browser daemon can only point at one port at a time. To drive both
# tiles from one terminal, pass --cdp explicitly on every command:
npx agent-browser --cdp $A_PORT snapshot -i
npx agent-browser --cdp $A_PORT fill @e1 "user-a@example.com"

npx agent-browser --cdp $B_PORT snapshot -i
npx agent-browser --cdp $B_PORT fill @e1 "user-b@example.com"
```

If your workflow is dominated by one of the tiles, you can `connect` the
daemon to that port and only pass `--cdp` for the other:

```bash
# `connect` alone re-points the daemon — never prefix with `close --all` (see the rule near the top).
npx agent-browser connect $A_PORT       # default
npx agent-browser snapshot -i           # targets tile A
npx agent-browser --cdp $B_PORT click @e3   # one-off command on tile B
```

Notes:
- Two incognito tiles also do NOT share cookies with each other — each gets
  its own unique partition (`incognito:<sessionId>`). You can spawn as many
  parallel sessions as you need.
- The incognito twin button on the browser tile's header (in the canvas UI)
  does the same thing manually — useful for the user to spawn a twin when
  they discover the need mid-test.
- Restart behavior: only the linked-twin incognito tile in the example above
  is restored on app restart (with empty cookies); a standalone incognito
  tile spawned without `linkedBrowserId` is treated as a one-off test and
  is not persisted.

## Canvas API Reference

### Check canvas status
```bash
curl -s $AGENT_CANVAS_API/api/status | jq
```

### Spawn browser tile (returns cdpPort + sessionId)
```bash
SPAWN_RESULT=$(curl -s -X POST $AGENT_CANVAS_API/api/browser/open \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"https://example.com\",\"terminalId\":\"${AGENT_CANVAS_TERMINAL_ID:-}\"}")
CDP_PORT=$(echo $SPAWN_RESULT | grep -o '"cdpPort":[0-9]*' | grep -o '[0-9]*')
SID=$(echo $SPAWN_RESULT | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
```

Request body fields:
- `url` (required) — initial URL
- `terminalId` (optional) — link the tile to a terminal (reuses the terminal's pre-allocated CDP port)
- `width`, `height` (optional) — tile dimensions
- `incognito` (optional, boolean) — spawn the tile with an isolated, in-memory partition. Cookies/localStorage are NOT shared with normal tiles or with other incognito tiles. Standalone incognito tiles do not persist across app restarts; incognito tiles spawned with `linkedBrowserId` DO persist.
- `linkedBrowserId` (optional) — attach this tile to an existing browser tile (draws a dashed amber edge between them on the canvas). Use this to mark an incognito tile as a "twin" of a primary tile in a parallel-testing setup.

Response fields:
- `ok` — boolean
- `cdpPort` — connect `agent-browser` to this port
- `sessionId` — the canvas tile id (use this as `linkedBrowserId` in follow-up calls)
- `message` — human-readable status

### Close browser tile
```bash
curl -s -X POST $AGENT_CANVAS_API/api/browser/close \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"<id-from-status>"}'
```

## Key Differences from /agent-browser

| Standard `/agent-browser` | This skill (`/agent-canvas-agent-browser`) |
|---|---|
| `--headed --session <name>` | `connect $CDP_PORT` then plain commands |
| Spawns separate browser window | Browser tile on the canvas |
| User watches a detached window | User sees tile alongside terminal |
| Must `close` when done | Tile stays on canvas for the user |
| No canvas integration | Connected via React Flow edge to terminal |
