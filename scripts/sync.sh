#!/usr/bin/env bash
set -euo pipefail
me="${1:-${HANDOFF_USER:-}}"
marker="$(git rev-parse --git-dir)/handoff-last-sync"
old=$(cat "$marker" 2>/dev/null || git rev-list --max-parents=0 HEAD | tail -1)
git pull --rebase --autostash
new=$(git rev-parse HEAD)
echo "$new" > "$marker"
files=$(git diff --name-only --diff-filter=A "$old" "$new" -- docs/handoff | grep -v -e README -e TEMPLATE || true)
if [ -z "$files" ]; then echo "No new handoff notes."; exit 0; fi
for f in $files; do echo "=== $f"; cat "$f"; echo; done
if [ -n "$me" ]; then
  echo "--- Notes tagging @$me:"
  grep -l "@$me" $files || echo "none"
fi
