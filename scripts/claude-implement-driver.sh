#!/usr/bin/env bash
# Launch Claude Code with permission prompts skipped and the driver-app
# handoff as the task. From the project folder:
#   ./scripts/claude-implement-driver.sh
#
# Extra args are appended to the prompt, e.g.
#   ./scripts/claude-implement-driver.sh "start with the map shell"
set -euo pipefail
cd "$(dirname "$0")/.."

prompt='read .ux-bugs/HANDOFF-driver.md and implement it.

Read first: .claude/skills/surface-orchestration/SKILL.md, .claude/skills/adaptive-surfaces/SKILL.md, .claude/skills/scene-preparation/SKILL.md, .claude/skills/perceived-performance/SKILL.md.

Do not polish the current /driver inbox list. Rebuild driver home as the map-first duty session the handoff specifies. Keep the existing tRPC router and trip state machine. Verify in the browser at 390x844 when a section is done.'

if [ "$#" -gt 0 ]; then
  prompt="$prompt

$*"
fi

exec claude --dangerously-skip-permissions "$prompt"
