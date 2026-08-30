#!/usr/bin/env bash
# Launch Claude Code with the Lime Freight / Partner doctrine handoff.
#   ./scripts/claude-implement-freight-partner.sh
#
# Extra args are appended to the prompt, e.g.
#   ./scripts/claude-implement-freight-partner.sh "freeze A and start with chrome collapse"
set -euo pipefail
cd "$(dirname "$0")/.."

prompt='read .ux-bugs/HANDOFF-freight.md and implement it.

Read first: .claude/skills/surface-orchestration/SKILL.md, .claude/skills/adaptive-surfaces/SKILL.md, .claude/skills/scene-preparation/SKILL.md, .claude/skills/perceived-performance/SKILL.md, .ux-bugs/HANDOFF-driver.md, .ux-bugs/HANDOFF-surfaces.md.

Make partner + freight paths feel as clean as rider and driver. Keep freight domain (lib/server/migrations/seed). Collapse chrome debt. Wire or delete unused surface managers. Default freeze A (unified /driver; freight unlock via fleet) if I am unreachable — write the freeze into HANDOFF-freight.md Session plan, then implement. Do not copy Uber visuals. Do not commit unless asked. Verify tsc, freight tests, and smoke partner → freight paths.'

if [ "$#" -gt 0 ]; then
  prompt="$prompt

$*"
fi

exec claude --dangerously-skip-permissions "$prompt"
