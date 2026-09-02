#!/usr/bin/env bash
# Write ios/.xcode.env.local with NODE_BINARY and REACT_NATIVE_PACKAGER_HOSTNAME.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${1:-$PWD}"
IOS_DIR="$APP_DIR/ios"
LOCAL_ENV="$IOS_DIR/.xcode.env.local"

if [[ ! -d "$IOS_DIR" ]]; then
  echo "setup-ios-device-env: ios/ not found — run 'npx expo prebuild' or 'expo run:ios' first" >&2
  exit 1
fi

PACKAGER_HOSTNAME="$("$SCRIPT_DIR/get-metro-host.sh")"
NODE_BINARY="${NODE_BINARY:-$(command -v node)}"

if [[ -z "$NODE_BINARY" ]]; then
  echo "setup-ios-device-env: node not found on PATH" >&2
  exit 1
fi

mkdir -p "$IOS_DIR"
cat >"$LOCAL_ENV" <<EOF
export NODE_BINARY=$NODE_BINARY
export REACT_NATIVE_PACKAGER_HOSTNAME=$PACKAGER_HOSTNAME
EOF

echo "Wrote $LOCAL_ENV"
echo "  REACT_NATIVE_PACKAGER_HOSTNAME=$PACKAGER_HOSTNAME"
echo "Rebuild after changing networks: npm run ios:device"
