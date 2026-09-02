#!/usr/bin/env bash
# Launch Claude Code to implement @lime/ui portable SDK.
#   ./scripts/claude-implement-lime-ui.sh
#
# Extra args are appended to the prompt, e.g.
#   ./scripts/claude-implement-lime-ui.sh "start with platform adapters + tokens"
set -euo pipefail
cd "$(dirname "$0")/.."

prompt='read .ux-bugs/HANDOFF-lime-ui.md and implement it.

Also read and obey docs/superpowers/specs/2026-08-31-lime-ui-rn-primitives-design.md as the approved spec.

Important: @lime/ui is a React Native–first portable Lime-branded UI SDK for ANY Expo project — not a Storybook extraction. Storybook and @lime/interaction-system are first consumers only. Zero deps on Next/tRPC/Drizzle/Mapbox/Storybook/interaction-system/app src/domain types. Native-first platform + web adapter. Keep Lime identity. Do not copy Uber visuals. Do not commit unless asked. Verify typecheck for @lime/ui and @lime/interaction-system; smoke Storybook primitives as a consumer only.'

if [ "$#" -gt 0 ]; then
  prompt="$prompt

$*"
fi

exec claude --dangerously-skip-permissions "$prompt"
