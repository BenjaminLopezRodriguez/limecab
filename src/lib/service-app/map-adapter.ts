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
  | "marker"
  | "poi"
  | "pickup";

export type MapPoint = {
  latitude: number;
  longitude: number;
  kind?: MapPointKind;
  label?: string;
  /** Degrees clockwise from north. Used to aim a vehicle marker. */
  heading?: number;
  /** True when this point is the chosen rest stop. */
  selected?: boolean;
  /**
   * POI stamp glyph. An open token: the app names its own categories and the
   * marker draws the ones it has a glyph for. Ignored on every other kind.
   */
  category?: string;
  /**
   * Street or place caption outside the pinhead (Uber label enhancer).
   * Compact pinheads cannot hold text; this is where the location name goes.
   */
  detail?: string;
};

export type MapViewProps = {
  mode: MapMode;
  /** Where the map is centred. Null renders an un-located canvas. */
  center?: MapPoint | null;
  points?: MapPoint[];
  /** Ordered path. Adapters that cannot draw routes may ignore it. */
  route?: MapPoint[];
  /**
   * An area overlay, painted as fill + outline under everything else. The kit
   * has no opinion about what the polygons mean — the consumer supplies
   * GeoJSON and may put an `emphasis` string property on a feature to have it
   * drawn a shade louder. Undefined or empty draws nothing.
   */
  coverage?: GeoJSON.FeatureCollection;
  /** Short physical-world marker, e.g. "12" or "HERE". */
  callout?: string | null;
  /** Corner caption, usually the current address. */
  label?: string | null;
  /** Short name drawn in the center pin when the map is locating. */
  pinLabel?: string | null;
  /** True while the pin's reverse-geocode is in flight. */
  pinLocating?: boolean;
  zoom?: number;
  className?: string;
  /** When true the canvas accepts pan and pinch. */
  interactive?: boolean;
  /**
   * A nonce. Change it to put the camera back on `center` — the only way to
   * re-frame an interactive canvas the user has panned away from, without the
   * kit growing an imperative handle.
   */
  recenterAt?: number;
  /** Fired when the user finishes a pan or pinch. */
  onCameraChange?: (center: MapPoint) => void;
  /** A labeled point on the canvas was chosen — a rest stop, a saved place. */
  onSelectPoint?: (point: MapPoint) => void;
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
      return 14;
    case "route_preview":
      return 13;
    case "provider_arrival":
    case "active_route":
      return 16;
    case "coverage":
      return 10;
    case "results":
      return 12;
  }
}

/**
 * Follow-cam: the vehicle stays put and the map (and path) slide under it.
 * Preview and receipt still fit the whole route.
 */
export function tracksProvider(mode: MapMode): boolean {
  return mode === "provider_arrival" || mode === "active_route";
}

const PUCK_MODES: ReadonlySet<MapMode> = new Set([
  "home",
  "select_location",
  "coverage",
]);

/**
 * Where a Mapbox / placeholder HTML marker attaches to the coordinate.
 * Needle pins sit on their tip (`bottom`); pucks and cars sit on their center.
 */
export function mapMarkerAnchor(
  point: MapPoint,
  mode: MapMode,
): "bottom" | "center" {
  const kind = point.kind ?? "marker";
  if (kind === "destination" || kind === "selection") return "bottom";
  if (kind === "pickup") return point.selected ? "bottom" : "center";
  if (kind === "origin") return PUCK_MODES.has(mode) ? "center" : "bottom";
  return "center";
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
export type GeoBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/** Axis-aligned box around highlighted geometry — a route, a curb set, a POI. */
export function boundsForPoints(
  points: readonly { latitude: number; longitude: number }[],
): GeoBounds | null {
  if (points.length === 0) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const point of points) {
    west = Math.min(west, point.longitude);
    south = Math.min(south, point.latitude);
    east = Math.max(east, point.longitude);
    north = Math.max(north, point.latitude);
  }
  return { west, south, east, north };
}

/**
 * Grow a pin-sized box so fitBounds can fill the padded canvas instead of
 * sitting at an arbitrary default zoom.
 */
export function expandBoundsToSpan(
  bounds: GeoBounds,
  minSpanMeters: number,
): GeoBounds {
  const midLat = (bounds.north + bounds.south) / 2;
  const midLng = (bounds.east + bounds.west) / 2;
  const heightM = (bounds.north - bounds.south) * 111_320;
  const widthM =
    (bounds.east - bounds.west) *
    111_320 *
    Math.cos((midLat * Math.PI) / 180);
  const spanLat = Math.max(heightM, minSpanMeters) / 111_320;
  const spanLng =
    Math.max(widthM, minSpanMeters) /
    (111_320 * Math.max(0.01, Math.cos((midLat * Math.PI) / 180)));
  return {
    west: midLng - spanLng / 2,
    east: midLng + spanLng / 2,
    south: midLat - spanLat / 2,
    north: midLat + spanLat / 2,
  };
}

/** Mapbox fitBounds order: southwest, northeast as [lng, lat]. */
export function boundsToFitCorners(
  bounds: GeoBounds,
): [[number, number], [number, number]] {
  return [
    [bounds.west, bounds.south],
    [bounds.east, bounds.north],
  ];
}

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
  clamp = true,
): { x: number; y: number } {
  const { northM, eastM } = offsetMeters(center, point);
  const scale = 1 / metersPerViewBoxUnit;
  const x = 100 + eastM * scale;
  const y = 100 - northM * scale;
  if (!clamp) return { x, y };
  return {
    x: Math.min(192, Math.max(8, x)),
    y: Math.min(192, Math.max(8, y)),
  };
}

/**
 * Moves the camera so the map content follows a drag in viewBox units.
 * Positive `dx` (finger east) shifts the centre west, matching a real map.
 */
export function panCenter(
  center: MapPoint,
  dxViewBox: number,
  dyViewBox: number,
  metersPerViewBoxUnit: number,
): MapPoint {
  const cos = Math.max(
    0.01,
    Math.cos((center.latitude * Math.PI) / 180),
  );
  return {
    latitude: center.latitude + (dyViewBox * metersPerViewBoxUnit) / 111_320,
    longitude:
      center.longitude - (dxViewBox * metersPerViewBoxUnit) / (111_320 * cos),
  };
}

/** Mapbox (and GeoJSON) store vertices as [longitude, latitude]. */
export function pointsFromLineString(geometry: {
  coordinates: ReadonlyArray<readonly number[]>;
}): MapPoint[] {
  return geometry.coordinates.flatMap((pair) => {
    const longitude = pair[0];
    const latitude = pair[1];
    if (longitude === undefined || latitude === undefined) return [];
    return [{ latitude, longitude }];
  });
}

/** Compass bearing from `from` to `to`, degrees clockwise from north. */
export function bearingDegrees(from: MapPoint, to: MapPoint): number {
  const φ1 = (from.latitude * Math.PI) / 180;
  const φ2 = (to.latitude * Math.PI) / 180;
  const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

/**
 * Walk `t` along a path by distance, not vertex count, so a long straight
 * block and a wiggly interchange both animate at a steady speed.
 */
export function pointAlongPath(path: readonly MapPoint[], t: number): MapPoint {
  const first = path[0];
  if (!first) {
    throw new Error("pointAlongPath requires at least one point");
  }
  if (path.length === 1) return first;
  const clamped = Math.min(1, Math.max(0, t));
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]!;
    const next = path[i]!;
    const { northM, eastM } = offsetMeters(prev, next);
    const length = Math.hypot(northM, eastM);
    lengths.push(length);
    total += length;
  }
  if (total === 0) return first;
  let remaining = clamped * total;
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]!;
    const next = path[i]!;
    const length = lengths[i - 1]!;
    if (remaining <= length) {
      const u = length === 0 ? 1 : remaining / length;
      const kind = next.kind ?? prev.kind;
      return {
        latitude: prev.latitude + (next.latitude - prev.latitude) * u,
        longitude: prev.longitude + (next.longitude - prev.longitude) * u,
        heading: bearingDegrees(prev, next),
        ...(kind ? { kind } : {}),
      };
    }
    remaining -= length;
  }
  const last = path[path.length - 1]!;
  const before = path[path.length - 2]!;
  return { ...last, heading: last.heading ?? bearingDegrees(before, last) };
}
