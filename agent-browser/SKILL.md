---
name: agent-browser
description: Automates browser interactions for web testing, form filling, screenshots, and data extraction. Use when the user needs to navigate websites, interact with web pages, fill forms, take screenshots, test web applications, or extract information from web pages.
allowed-tools: Bash(agent-browser:*)
model: haiku
---

# Browser Automation with agent-browser

## ⚠️ CRITICAL: Three-Tier Browser Automation Pattern

Browser automation is expensive. Use this architecture to cut costs 15x+ while keeping main context clean:

```
MAIN OPUS (orchestrator) ─── keeps context clean, spawns planner
       │
       ▼
OPUS AGENT (planner) ─────── explores page, plans commands, spawns Haikus, verifies
       │
       ├──► HAIKU Agent 1 (--session verify-1) ─── executes exact commands
       │
       └──► HAIKU Agent 2 (--session verify-2) ─── executes exact commands
```

### How Main Opus Should Invoke Browser Tasks

When you need browser automation, spawn a single Opus agent to handle it all:

```javascript
Task({
  subagent_type: "general-purpose",
  model: "opus",  // Opus for planning
  prompt: `You are a browser automation planner. Your task: [DESCRIBE THE GOAL]

**Your workflow:**

1. **Scout the page** (optional if structure is known):
   \`\`\`bash
   agent-browser --headed --session scout open <url>
   agent-browser --headed --session scout snapshot -i
   agent-browser --headed --session scout close
   \`\`\`
   Find the element refs you need (search box is usually @e7).

2. **Plan the exact Bash commands** for the task.

3. **CRITICAL - Spawn TWO Haiku agents IN PARALLEL:**

   You MUST call both Task tools in a SINGLE message to run them in parallel.
   Do NOT call one, wait for results, then call another - that's sequential!

   In ONE response, include BOTH Task tool calls like this:

   <example>
   I'll now spawn two Haiku agents in parallel to verify the results.

   [Task tool call 1: model="haiku", session="verify-1", prompt with explicit commands]
   [Task tool call 2: model="haiku", session="verify-2", prompt with explicit commands]
   </example>

4. **After BOTH complete**, compare results and report.

**Haiku prompt template** (give EXPLICIT commands, not goals):
\`\`\`
Run these exact Bash commands in order. Use the Bash tool for each one:
1. \`agent-browser --headed --session verify-1 open <url>\`
2. \`agent-browser --headed --session verify-1 snapshot -i\`
3. \`agent-browser --headed --session verify-1 fill @e7 "<search>"\`
4. \`agent-browser --headed --session verify-1 press Enter\`
5. \`agent-browser --headed --session verify-1 wait 2000\`
6. \`agent-browser --headed --session verify-1 screenshot /tmp/verify-1.png\`
7. \`agent-browser --headed --session verify-1 close\`
Execute each using the Bash tool. Report findings.
\`\`\`
`
})
```

### Why This Architecture Works

| Tier | Model | Role | Cost |
|------|-------|------|------|
| Main Opus | opus | Orchestrates, stays clean | Minimal |
| Planner Agent | opus | Explores, plans, spawns, verifies | Moderate |
| Executor Agents (x2) | haiku | Runs exact commands | Very cheap |

- **Main context stays clean** - no browser command bloat
- **Opus does the thinking** - planning, element ref discovery, verification
- **Haiku does the clicking** - mechanical execution of explicit commands
- **Dual execution** - two Haikus agreeing = high confidence result

### ⚠️ CRITICAL: Haiku Needs EXPLICIT Commands

Haiku will hallucinate if given vague goals. Always provide exact Bash commands:

```
❌ BAD:  "Search for Pikachu on the cards page"
✅ GOOD: "Run these exact Bash commands:
         1. agent-browser --headed --session verify-1 fill @e7 'Pikachu'
         2. agent-browser --headed --session verify-1 press Enter"
```

## Always use --headed and --session

**ALWAYS** include these flags so the user can watch and multiple agents don't conflict:

```bash
agent-browser --headed --session <unique-name> <command>
```

- `--headed` - Shows the browser window so the user can watch
- `--session <name>` - Isolates this browser from other agents (use a unique name like your task)

## Quick start

```bash
agent-browser --headed --session mytask open <url>        # Navigate to page
agent-browser --headed --session mytask snapshot -i       # Get interactive elements with refs
agent-browser --headed --session mytask click @e1         # Click element by ref
agent-browser --headed --session mytask fill @e2 "text"   # Fill input by ref
agent-browser --headed --session mytask close             # Close browser
```

## Core workflow

1. Navigate: `agent-browser --headed --session mytask open <url>`
2. Snapshot: `agent-browser --headed --session mytask snapshot -i` (returns elements with refs like `@e1`, `@e2`)
3. Interact using refs from the snapshot
4. Re-snapshot after navigation or significant DOM changes
5. **Always close when done**: `agent-browser --headed --session mytask close`

## Commands

### Navigation
```bash
agent-browser --headed --session mytask open <url>      # Navigate to URL
agent-browser --headed --session mytask back            # Go back
agent-browser --headed --session mytask forward         # Go forward
agent-browser --headed --session mytask reload          # Reload page
agent-browser --headed --session mytask close           # Close browser
```

### Snapshot (page analysis)
```bash
agent-browser snapshot            # Full accessibility tree
agent-browser snapshot -i         # Interactive elements only (recommended)
agent-browser snapshot -c         # Compact output
agent-browser snapshot -d 3       # Limit depth to 3
agent-browser snapshot -s "#main" # Scope to CSS selector
```

### Interactions (use @refs from snapshot)
```bash
agent-browser click @e1           # Click
agent-browser dblclick @e1        # Double-click
agent-browser focus @e1           # Focus element
agent-browser fill @e2 "text"     # Clear and type
agent-browser type @e2 "text"     # Type without clearing
agent-browser press Enter         # Press key
agent-browser press Control+a     # Key combination
agent-browser keydown Shift       # Hold key down
agent-browser keyup Shift         # Release key
agent-browser hover @e1           # Hover
agent-browser check @e1           # Check checkbox
agent-browser uncheck @e1         # Uncheck checkbox
agent-browser select @e1 "value"  # Select dropdown
agent-browser scroll down 500     # Scroll page
agent-browser scrollintoview @e1  # Scroll element into view
agent-browser drag @e1 @e2        # Drag and drop
agent-browser upload @e1 file.pdf # Upload files
```

### Get information
```bash
agent-browser get text @e1        # Get element text
agent-browser get html @e1        # Get innerHTML
agent-browser get value @e1       # Get input value
agent-browser get attr @e1 href   # Get attribute
agent-browser get title           # Get page title
agent-browser get url             # Get current URL
agent-browser get count ".item"   # Count matching elements
agent-browser get box @e1         # Get bounding box
```

### Check state
```bash
agent-browser is visible @e1      # Check if visible
agent-browser is enabled @e1      # Check if enabled
agent-browser is checked @e1      # Check if checked
```

### Screenshots & PDF
```bash
agent-browser screenshot          # Screenshot to stdout
agent-browser screenshot path.png # Save to file
agent-browser screenshot --full   # Full page
agent-browser pdf output.pdf      # Save as PDF
```

### Video recording
```bash
agent-browser record start ./demo.webm    # Start recording (uses current URL + state)
agent-browser click @e1                   # Perform actions
agent-browser record stop                 # Stop and save video
agent-browser record restart ./take2.webm # Stop current + start new recording
```
Recording creates a fresh context but preserves cookies/storage from your session. If no URL is provided, it automatically returns to your current page. For smooth demos, explore first, then start recording.

### Wait
```bash
agent-browser wait @e1                     # Wait for element
agent-browser wait 2000                    # Wait milliseconds
agent-browser wait --text "Success"        # Wait for text
agent-browser wait --url "**/dashboard"    # Wait for URL pattern
agent-browser wait --load networkidle      # Wait for network idle
agent-browser wait --fn "window.ready"     # Wait for JS condition
```

### Mouse control
```bash
agent-browser mouse move 100 200      # Move mouse
agent-browser mouse down left         # Press button
agent-browser mouse up left           # Release button
agent-browser mouse wheel 100         # Scroll wheel
```

### Semantic locators (alternative to refs)
```bash
agent-browser find role button click --name "Submit"
agent-browser find text "Sign In" click
agent-browser find label "Email" fill "user@test.com"
agent-browser find first ".item" click
agent-browser find nth 2 "a" text
```

### Browser settings
```bash
agent-browser set viewport 1920 1080      # Set viewport size
agent-browser set device "iPhone 14"      # Emulate device
agent-browser set geo 37.7749 -122.4194   # Set geolocation
agent-browser set offline on              # Toggle offline mode
agent-browser set headers '{"X-Key":"v"}' # Extra HTTP headers
agent-browser set credentials user pass   # HTTP basic auth
agent-browser set media dark              # Emulate color scheme
```

### Cookies & Storage
```bash
agent-browser cookies                     # Get all cookies
agent-browser cookies set name value      # Set cookie
agent-browser cookies clear               # Clear cookies
agent-browser storage local               # Get all localStorage
agent-browser storage local key           # Get specific key
agent-browser storage local set k v       # Set value
agent-browser storage local clear         # Clear all
```

### Network
```bash
agent-browser network route <url>              # Intercept requests
agent-browser network route <url> --abort      # Block requests
agent-browser network route <url> --body '{}'  # Mock response
agent-browser network unroute [url]            # Remove routes
agent-browser network requests                 # View tracked requests
agent-browser network requests --filter api    # Filter requests
```

### Tabs & Windows
```bash
agent-browser tab                 # List tabs
agent-browser tab new [url]       # New tab
agent-browser tab 2               # Switch to tab
agent-browser tab close           # Close tab
agent-browser window new          # New window
```

### Frames
```bash
agent-browser frame "#iframe"     # Switch to iframe
agent-browser frame main          # Back to main frame
```

### Dialogs
```bash
agent-browser dialog accept [text]  # Accept dialog
agent-browser dialog dismiss        # Dismiss dialog
```

### JavaScript
```bash
agent-browser eval "document.title"   # Run JavaScript
```

## Example: Form submission

```bash
# Use a descriptive session name for your task
agent-browser --headed --session form-test open https://example.com/form
agent-browser --headed --session form-test snapshot -i
# Output shows: textbox "Email" [ref=e1], textbox "Password" [ref=e2], button "Submit" [ref=e3]

agent-browser --headed --session form-test fill @e1 "user@example.com"
agent-browser --headed --session form-test fill @e2 "password123"
agent-browser --headed --session form-test click @e3
agent-browser --headed --session form-test wait --load networkidle
agent-browser --headed --session form-test snapshot -i  # Check result
agent-browser --headed --session form-test close        # Always close when done!
```

## Example: Authentication with saved state

```bash
# Login once
agent-browser --headed --session login-flow open https://app.example.com/login
agent-browser --headed --session login-flow snapshot -i
agent-browser --headed --session login-flow fill @e1 "username"
agent-browser --headed --session login-flow fill @e2 "password"
agent-browser --headed --session login-flow click @e3
agent-browser --headed --session login-flow wait --url "**/dashboard"
agent-browser --headed --session login-flow state save auth.json
agent-browser --headed --session login-flow close

# Later sessions: load saved state
agent-browser --headed --session dashboard-test state load auth.json
agent-browser --headed --session dashboard-test open https://app.example.com/dashboard
```

## Sessions (parallel browsers)

Multiple agents can run simultaneously with different session names:

```bash
# Agent 1 uses session "agent1"
agent-browser --headed --session agent1 open site-a.com

# Agent 2 uses session "agent2" (runs at the same time!)
agent-browser --headed --session agent2 open site-b.com

# List all active sessions
agent-browser session list
```

## JSON output (for parsing)

Add `--json` for machine-readable output:
```bash
agent-browser snapshot -i --json
agent-browser get text @e1 --json
```

## Debugging

```bash
agent-browser open example.com --headed              # Show browser window
agent-browser console                                # View console messages
agent-browser errors                                 # View page errors
agent-browser record start ./debug.webm   # Record from current page
agent-browser record stop                            # Save recording
agent-browser open example.com --headed  # Show browser window
agent-browser --cdp 9222 snapshot        # Connect via CDP
agent-browser console                    # View console messages
agent-browser console --clear            # Clear console
agent-browser errors                     # View page errors
agent-browser errors --clear             # Clear errors
agent-browser highlight @e1              # Highlight element
agent-browser trace start                # Start recording trace
agent-browser trace stop trace.zip       # Stop and save trace
```
