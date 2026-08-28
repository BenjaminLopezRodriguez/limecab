#!/usr/bin/env bash
# Launch Claude Code with the Lime Help + Lime Shop handoff as the task.
#   ./scripts/claude-implement-lime-help-shop.sh
#
# Extra args are appended to the prompt, e.g.
#   ./scripts/claude-implement-lime-help-shop.sh "start with slice 1: Shop list"
set -euo pipefail
cd "$(dirname "$0")/.."

prompt='read .ux-bugs/HANDOFF-lime-help-shop.md and implement it.

Read first: .claude/skills/surface-orchestration/SKILL.md, .claude/skills/adaptive-surfaces/SKILL.md, .claude/skills/scene-preparation/SKILL.md, .claude/skills/perceived-performance/SKILL.md.

Do not rebuild /driver. Do not rename Assist into Help. Shop is courier + store + list. Help is a scheduled house visit. Care requires per-rule ack. Slice 1 first (Shop list on existing courier). Verify at 390x844 after each slice. Do not commit unless asked.'

if [ "$#" -gt 0 ]; then
  prompt="$prompt

$*"
fi

exec claude --dangerously-skip-permissions "$prompt"
