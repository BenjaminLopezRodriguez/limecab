#!/usr/bin/env bash
# Print the Mac IP address physical iOS devices should use to reach Metro.
# Prefers REACT_NATIVE_PACKAGER_HOSTNAME, then active interfaces (en0–en9),
# then the default-route interface, then any non-link-local inet from ifconfig.
#
# iPhone USB / Personal Hotspot: en0 and bridge100 are often empty. Find the
# active interface and IP manually:
#   route get default | awk '/interface:/{print $2}'
#   ifconfig <iface> | awk '/inet /{print $2; exit}'
# Or scan everything:
#   ifconfig | awk '/^[a-z]/ {iface=$1} /inet / && $2 != "127.0.0.1" {print iface, $2}'

set -euo pipefail

if [[ -n "${REACT_NATIVE_PACKAGER_HOSTNAME:-}" ]]; then
  echo "$REACT_NATIVE_PACKAGER_HOSTNAME"
  exit 0
fi

for num in 0 1 2 3 4 5 6 7 8 9; do
  ip="$(ipconfig getifaddr "en${num}" 2>/dev/null || true)"
  if [[ -n "$ip" && "$ip" != "127.0.0.1" ]]; then
    echo "$ip"
    exit 0
  fi
done

iface="$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')"
if [[ -n "$iface" ]]; then
  ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
  if [[ -n "$ip" && "$ip" != "127.0.0.1" ]]; then
    echo "$ip"
    exit 0
  fi
fi

ip="$(ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" && $2 !~ /^169\.254\./ {print $2; exit}')"
if [[ -n "$ip" ]]; then
  echo "$ip"
  exit 0
fi

echo "localhost"
