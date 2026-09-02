#!/usr/bin/env bash
# Start Expo Metro for a physical iOS device on the current LAN / hotspot subnet.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${1:-$PWD}"
PORT="${EXPO_METRO_PORT:-8081}"

if [[ ! -f "$APP_DIR/package.json" ]]; then
  echo "start-expo-device: expected package.json in $APP_DIR" >&2
  exit 1
fi

PACKAGER_HOSTNAME="$("$SCRIPT_DIR/get-metro-host.sh")"
DEFAULT_ROUTE_IFACE="$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')"

echo "Packager hostname: $PACKAGER_HOSTNAME (interface: ${DEFAULT_ROUTE_IFACE:-unknown})"
echo "Metro URL: http://${PACKAGER_HOSTNAME}:${PORT}"
echo "WebView base: EXPO_PUBLIC_LIME_WEB_BASE_URL=http://${PACKAGER_HOSTNAME}:3100"

export REACT_NATIVE_PACKAGER_HOSTNAME="$PACKAGER_HOSTNAME"
export RCT_METRO_PORT="$PORT"

cd "$APP_DIR"
exec npx expo start --lan --port "$PORT"
