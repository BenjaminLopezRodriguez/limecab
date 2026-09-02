#!/usr/bin/env bash
# Print the Mac IP address physical iOS devices should use to reach Metro.
# Hotspot-aware: uses the default-route interface first (not en0).
#
# iPhone USB / Personal Hotspot: phone is often 192.0.0.1 or 172.20.10.1;
# Mac is on en7 (or similar) with e.g. 192.0.0.2 or 172.20.10.2.
# Do NOT assume en0 — discover with:
#   route get default | awk '/interface:/{print $2}'
#   ipconfig getifaddr <iface>

set -euo pipefail

if [[ -n "${REACT_NATIVE_PACKAGER_HOSTNAME:-}" ]]; then
  echo "$REACT_NATIVE_PACKAGER_HOSTNAME"
  exit 0
fi

is_usable_ip() {
  local ip="$1"
  [[ -n "$ip" && "$ip" != "127.0.0.1" && "$ip" != 169.254.* ]]
}

# 1. Default-route interface (correct for iPhone hotspot / USB tethering)
iface="$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')"
if [[ -n "${iface:-}" ]]; then
  ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
  if is_usable_ip "$ip"; then
    echo "$ip"
    exit 0
  fi
fi

# 2. Common interfaces (skip link-local)
for iface in bridge100 en0 en1 en2 en3 en4 en5 en6 en7 en8 en9; do
  ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
  if is_usable_ip "$ip"; then
    echo "$ip"
    exit 0
  fi
done

# 3. Fallback: first non-loopback, non-link-local inet
ip="$(ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" && $2 !~ /^169\.254\./ {print $2; exit}')"
if [[ -n "$ip" ]]; then
  echo "$ip"
  exit 0
fi

echo "get-metro-host: could not determine LAN IP" >&2
exit 1
