#!/usr/bin/env bash
# Launch Claude Code with permission prompts skipped and the logistics
# handoff as the task. From the project folder:
#   ./scripts/claude-implement-logistics.sh
#
# Extra args are appended to the prompt, e.g.
#   ./scripts/claude-implement-logistics.sh "start with the H3 wrapper"
set -euo pipefail
cd "$(dirname "$0")/.."

prompt='read .ux-bugs/HANDOFF-logistics.md and implement it.

Read first: .claude/skills/surface-orchestration/SKILL.md, .claude/skills/adaptive-surfaces/SKILL.md, .claude/skills/scene-preparation/SKILL.md, .claude/skills/perceived-performance/SKILL.md.

Do not restyle the driver shell. Do not draw hexes on the rider map. Do not build surge. Two H3 jobs: res 8 visual lattice on the idle driver map, res 9 silent index for favorite-spot search. Clear dummy Home/Work/nearby cars. Verify in the browser at 390x844 when a section is done.'

if [ "$#" -gt 0 ]; then
  prompt="$prompt

$*"
fi

exec claude --dangerously-skip-permissions "$prompt"
