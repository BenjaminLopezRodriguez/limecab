import type { ReactNode } from "react";

/**
 * Map seam.
 *
 * The kit ships no map vendor. `ServiceMap` renders whatever adapter it is
 * given; the built-in placeholder draws a synthetic canvas so every scene,
 * layout, and transition works before a vendor is chosen. Swap in Mapbox,
 * MapLibre, Google, or a static-tile proxy by implementing `MapAdapter`.
 */

export type MapMode =
  | "home"
  | "select_location"
  | "route_preview"
  | "provider_arrival"
  | "active_route"
  | "coverage"
  | "results";

export type MapPointKind =
  | "origin"
  | "destination"
  | "provider"
  | "selection"
  | "marker";

export type MapPoint = {
  latitude: number;
  longitude: number;
  kind?: MapPointKind;
  label?: string;
};

export type MapViewProps = {
  mode: MapMode;
  /** Where the map is centred. Null renders an un-located canvas. */
  center?: MapPoint | null;
  points?: MapPoint[];
  /** Ordered path. Adapters that cannot draw routes may ignore it. */
  route?: MapPoint[];
  /** Short physical-world marker, e.g. "7 MIN" or "HERE". */
  callout?: string | null;
  /** Corner caption, usually the current address. */
  label?: string | null;
  zoom?: number;
  className?: string;
};

export interface MapAdapter {
  /** Rendered inside the map slot. Must fill its container. */
  render(props: MapViewProps): ReactNode;
}

/** Sensible default zoom per mode, so callers rarely pass one. */
export function zoomForMode(mode: MapMode): number {
  switch (mode) {
    case "home":
      return 14;
    case "select_location":
      return 16;
    case "route_preview":
    case "active_route":
      return 13;
    case "provider_arrival":
      return 15;
    case "coverage":
      return 10;
    case "results":
      return 12;
  }
}

/**
 * Projects a point onto the placeholder's 200×200 viewBox relative to the
 * centre. Deliberately crude — enough for a truthful *relative* position
 * without pulling in a projection library.
 */
/**
 * The metres-per-unit that puts every supplied point inside the viewBox with a
 * margin, floored so a cluster of near-identical points does not zoom to
 * absurdity. Without it a long route projects both ends onto the clamp and the
 * "preview" shows a line leaving the frame.
 */
export function fitMetersPerUnit(
  center: MapPoint,
  points: readonly MapPoint[],
  // 56, not 100: the canvas renders its square viewBox with `slice`, so a
  // non-square container crops one axis. Fitting to the full half-width would
  // put the very points being framed under the crop.
  { minimum = 6, margin = 56 } = {},
): number {
  let extent = 0;
  for (const point of points) {
    const { northM, eastM } = offsetMeters(center, point);
    extent = Math.max(extent, Math.abs(northM), Math.abs(eastM));
  }
  if (extent === 0) return minimum;
  return Math.max(minimum, extent / margin);
}

function offsetMeters(center: MapPoint, point: MapPoint) {
  return {
    northM: (point.latitude - center.latitude) * 111_320,
    eastM:
      (point.longitude - center.longitude) *
      111_320 *
      Math.cos((center.latitude * Math.PI) / 180),
  };
}

export function projectPoint(
  center: MapPoint,
  point: MapPoint,
  metersPerViewBoxUnit = 6,
): { x: number; y: number } {
  const { northM, eastM } = offsetMeters(center, point);
  const scale = 1 / metersPerViewBoxUnit;
  return {
    x: Math.min(192, Math.max(8, 100 + eastM * scale)),
    y: Math.min(192, Math.max(8, 100 - northM * scale)),
  };
}
