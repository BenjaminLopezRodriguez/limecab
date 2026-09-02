#!/usr/bin/env bash
# Write ip.txt so physical devices know which host runs Metro.
# Sourced from the Xcode "Bundle React Native code and images" phase.

if [[ "${SKIP_BUNDLING_METRO_IP:-}" == "1" ]]; then
  return 0 2>/dev/null || exit 0
fi

if [[ "$CONFIGURATION" != *Debug* || "$PLATFORM_NAME" == *simulator* ]]; then
  return 0 2>/dev/null || exit 0
fi

DEST="${CONFIGURATION_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}"
mkdir -p "$DEST"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IP="$("${SCRIPT_DIR}/get-metro-host.sh")"

if [[ -n "$IP" && "$IP" != "localhost" ]]; then
  echo "$IP" > "$DEST/ip.txt"
  echo "Wrote Metro host IP (${IP}) to ip.txt"
fi
