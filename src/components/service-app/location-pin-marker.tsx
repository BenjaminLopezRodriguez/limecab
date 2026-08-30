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
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <FixedMarker
        label={name?.trim() ? name.trim() : "…"}
        kind="accent"
        size="medium"
        needle="medium"
        dragging={locating}
      />
    </span>
  );
}
