#!/bin/zsh
# Hook: close the agent-browser sessions an agent opened once that agent is done.
#
# SubagentStop: sessions named in the subagent's transcript, except names the main conversation also used.
# SessionEnd:   sessions named in the main transcript and in every subagent and workflow agent transcript.
#
# Names come from Bash commands that run agent-browser with `--session <name>` or `AGENT_BROWSER_SESSION=<name>`.
# Only sessions that are still live get closed. The shared default session and names built from shell
# variables (`mytile-$$`, `"$SESSION"`) are skipped; the idle timeout in ~/.agent-browser/config.json covers those.
# The hook returns at once and does the closing in a detached process, so it never delays an agent or Claude's exit.

setopt extended_glob null_glob

log_file="$HOME/.claude/logs/agent-browser-cleanup.log"
socket_dir="$HOME/.agent-browser"

log() {
  mkdir -p "${log_file:h}"
  print -r -- "$(date '+%F %T') $*" >> "$log_file"
}

find_agent_browser() {
  local found
  found=$(command -v agent-browser)
  if [[ -z "$found" ]]; then
    local candidates=("$HOME/Library/Application Support/Herd/config/nvm/versions/node/"*/bin/agent-browser)
    found="${candidates[-1]}"
  fi
  print -r -- "$found"
}

session_names_in() {
  grep -h 'agent-browser' "$@" 2>/dev/null \
    | jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "tool_use" and .name == "Bash") | .input.command' 2>/dev/null \
    | grep 'agent-browser' \
    | grep -oE -- "(--session[= ]+|AGENT_BROWSER_SESSION=)[\"']?[A-Za-z0-9_\$-]+" \
    | sed -E "s/^(--session[= ]+|AGENT_BROWSER_SESSION=)[\"']?//" \
    | grep -E '^[A-Za-z0-9_-]+$' \
    | grep -vx 'default' \
    | sort -u
}

close_one() {
  local agent_browser="$1" name="$2" event="$3"
  local daemon_pid="" result
  [[ -f "$socket_dir/$name.pid" ]] && daemon_pid=$(<"$socket_dir/$name.pid")
  result=$("$agent_browser" --session "$name" close 2>&1 | tail -1)
  if [[ "$daemon_pid" == <-> ]]; then
    sleep 2
    if kill -0 "$daemon_pid" 2>/dev/null && [[ "$(ps -o command= -p "$daemon_pid")" == *agent-browser* ]]; then
      kill -TERM "$daemon_pid"
      result+=" (daemon $daemon_pid survived close, sent SIGTERM)"
    fi
  fi
  log "$event closed $name: $result"
}

close_sessions() {
  local event="$1" shared_transcript="$2"
  shift 2
  local transcripts=("$@")

  sleep 2

  local wanted=(${(f)"$(session_names_in "${transcripts[@]}")"})
  if [[ -n "$shared_transcript" && -f "$shared_transcript" ]]; then
    local shared=(${(f)"$(session_names_in "$shared_transcript")"})
    wanted=(${wanted:|shared})
  fi
  (( ${#wanted} )) || return 0

  local agent_browser
  agent_browser=$(find_agent_browser)
  if [[ ! -x "$agent_browser" ]]; then
    log "$event agent-browser not found, could not close: ${wanted[*]}"
    return 0
  fi

  local live=(${(f)"$("$agent_browser" session list --json 2>/dev/null | jq -r '.data.sessions[]?' 2>/dev/null)"})
  local targets=(${wanted:*live})
  (( ${#targets} )) || return 0

  local name
  for name in $targets; do
    close_one "$agent_browser" "$name" "$event" &
  done
  wait
}

if [[ "$1" == "--close" ]]; then
  shift
  close_sessions "$@"
  exit 0
fi

input=$(cat)
event=$(jq -r '.hook_event_name // empty' <<<"$input" 2>/dev/null)
main_transcript=$(jq -r '.transcript_path // empty' <<<"$input" 2>/dev/null)

case "$event" in
  SubagentStop)
    agent_transcript=$(jq -r '.agent_transcript_path // empty' <<<"$input" 2>/dev/null)
    [[ -f "$agent_transcript" ]] || exit 0
    nohup "${0:A}" --close "$event" "$main_transcript" "$agent_transcript" >/dev/null 2>&1 &!
    ;;
  SessionEnd)
    [[ -f "$main_transcript" ]] || exit 0
    nohup "${0:A}" --close "$event" "" "$main_transcript" "${main_transcript:r}"/subagents/**/agent-*.jsonl >/dev/null 2>&1 &!
    ;;
esac
exit 0
