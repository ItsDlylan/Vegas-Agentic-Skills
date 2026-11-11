#!/usr/bin/env bash
# Installs each section in this directory into the user's global CLAUDE.md.
# A section is one .md file that starts with a "## " heading. If CLAUDE.md
# already has that heading, the section is replaced; otherwise it is appended.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
config_dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
target="$config_dir/CLAUDE.md"

mkdir -p "$config_dir"
touch "$target"

for section in "$here"/*.md; do
  heading="$(head -n 1 "$section")"
  if [[ "$heading" != "## "* ]]; then
    echo "skip $(basename "$section"): first line is not a '## ' heading" >&2
    continue
  fi

  tmp="$(mktemp)"
  awk -v heading="$heading" -v section="$section" '
    function emit(   line) {
      while ((getline line < section) > 0) print line
      close(section)
      done = 1
    }
    $0 == heading { emit(); skipping = 1; next }
    skipping && /^## / { skipping = 0; print "" }
    skipping { next }
    { print; last = $0 }
    END {
      if (!done) {
        if (NR > 0 && last != "") print ""
        emit()
      }
    }
  ' "$target" > "$tmp"

  if cmp -s "$tmp" "$target"; then
    echo "unchanged: $heading"
    rm "$tmp"
  else
    cp "$target" "$target.bak"
    mv "$tmp" "$target"
    echo "installed: $heading (previous file saved as $target.bak)"
  fi
done

if [[ ! -f "$config_dir/skills/deslop-copy/SKILL.md" ]]; then
  echo "note: deslop-copy is not in $config_dir/skills. Link this repo there:" >&2
  echo "  ln -s \"$(dirname "$here")\" \"$config_dir/skills\"" >&2
fi
