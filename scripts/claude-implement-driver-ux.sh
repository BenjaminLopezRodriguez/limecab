#!/usr/bin/env bash
# Launch Claude Code with the driver idle-UX handoff as the task.
#   ./scripts/claude-implement-driver-ux.sh
set -euo pipefail
cd "$(dirname "$0")/.."

prompt='read .ux-bugs/HANDOFF-driver-ux.md and implement it.

Look at every PNG in .ux-bugs/refs/uber-driver/ first. Copy Uber Driver idle postures, not the skin (no Uber blue/orange, no restaurant pins, no Waybill).

Read first: .claude/skills/surface-orchestration/SKILL.md, .claude/skills/adaptive-surfaces/SKILL.md, .claude/skills/scene-preparation/SKILL.md, .claude/skills/perceived-performance/SKILL.md.

src/app/driver/page.tsx stays the gate. UX lives in DriverApp. Do not touch offer or live-job scenes. Offline uses layout=home (map card). Online hunting uses layout=task. Verify at 390x844 after each section.'

if [ "$#" -gt 0 ]; then
  prompt="$prompt

$*"
fi

exec claude --dangerously-skip-permissions "$prompt"
