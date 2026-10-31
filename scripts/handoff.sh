#!/usr/bin/env bash
set -euo pipefail
name="${HANDOFF_USER:?set HANDOFF_USER=yourname}"
ts=$(date +%Y%m%d-%H%M)
out="docs/handoff/$ts-$name.md"
sed "s/{{name}}/$name/; s/{{time}}/$(date +%H:%M)/" docs/handoff/TEMPLATE.md > "$out"
echo "Created $out. Fill it in, then: git add -A && git commit -m 'docs: handoff note' && git push"
