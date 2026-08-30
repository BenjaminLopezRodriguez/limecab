"use client";

import { CarMarker } from "@/components/service-app/car-marker";
import { FixedMarker, LocationPuck } from "@/components/service-app/map-marker";
import { PickupPointMarker } from "@/components/service-app/pickup-point-marker";
import { RestStopMarker } from "@/components/service-app/rest-stop-marker";
import type { MapMode, MapPoint } from "@/lib/service-app/map-adapter";

const PUCK_MODES: ReadonlySet<MapMode> = new Set([
  "home",
  "select_location",
  "coverage",
]);

/**
 * One call site for every MapPoint kind. Pickup logic stays in the
 * candidate list — this only chooses the Uber-style glyph.
 */
export function MapPointMarker({
  point,
  mode,
  onSelect,
}: {
  point: MapPoint;
  mode: MapMode;
  onSelect?: () => void;
}) {
  const kind = point.kind ?? "marker";

  if (kind === "pickup") {
    return (
      <PickupPointMarker
        label={point.label ?? "Pickup"}
        selected={point.selected}
        onSelect={onSelect}
      />
    );
  }

  if (kind === "poi") {
    return (
      <RestStopMarker
        label={point.label ?? "Stop"}
        selected={point.selected}
        category={point.category}
        onSelect={onSelect}
      />
    );
  }

  if (kind === "provider" || kind === "marker") {
    return (
      <CarMarker
        heading={point.heading ?? 0}
        size={kind === "provider" ? "md" : "sm"}
      />
    );
  }

  if (kind === "destination") {
    return (
      <FixedMarker
        size="x-small-square"
        kind="default"
        needle="short"
      />
    );
  }

  if (kind === "origin" && PUCK_MODES.has(mode)) {
    return (
      <LocationPuck
        type="consumer"
        heading={point.heading}
        showHeading={point.heading !== undefined}
      />
    );
  }

  return (
    <FixedMarker
      size="x-small-circle"
      kind="accent"
      needle="short"
    />
  );
}
