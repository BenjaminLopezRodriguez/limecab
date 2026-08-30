"use client";

import { FixedMarker } from "@/components/service-app/map-marker";

/**
 * Centered map pin while the rider is choosing a point. Needle tip sits on
 * the canvas center — the map moves under it.
 */
export function LocationPinMarker({
  name,
  locating = false,
}: {
  name: string | null;
  locating?: boolean;
}) {
  const label = name?.trim() ? name.trim() : "Set pickup";
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full">
        <FixedMarker
          label={label}
          kind="accent"
          size="medium"
          needle="medium"
          dragging={locating}
        />
      </span>
    </span>
  );
}
