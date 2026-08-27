#!/usr/bin/env bash
# Launch Claude Code in this repo with all permission prompts skipped.
# From the project folder:
#   ./scripts/claude-danger.sh
#   ./scripts/claude-danger.sh "read .ux-bugs/HANDOFF-surfaces.md and fix it"
set -euo pipefail
cd "$(dirname "$0")/.."
exec claude --dangerously-skip-permissions "$@"
