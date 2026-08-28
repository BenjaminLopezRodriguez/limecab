/**
 * LimeCab's H3 wrapper — the only file in the app that imports `h3-js`.
 *
 * Two resolutions, two jobs, and they do not collapse into one:
 *
 * - **res 8** (~0.74 km², ~460 m edge) is *seen*. It is the lattice a driver
 *   reads off a dash mount at zoom 14, and the cell that `drivers.lastH3`,
 *   `trips.pickupH3`, the inbox disk, and nearby-car search all agree on.
 * - **res 9** (~0.10 km², ~174 m edge) is *never drawn*. It indexes saved
 *   places so "near me" means a few blocks and not a neighbourhood.
 *
 * There is no third job. Emphasis on a cell is occupancy — I am here, a
 * request is here — never price. This module knows nothing about surge.
 */

import {
  cellToBoundary,
  cellToLatLng,
  gridDisk,
  isValidCell,
  latLngToCell,
  polygonToCells,
} from "h3-js";

export const DRIVER_H3_RES = 8;
export const SEARCH_H3_RES = 9;

/** The cell a driver, a pickup, and the visual lattice all share. */
export function toDriverCell(latitude: number, longitude: number): string {
  return latLngToCell(latitude, longitude, DRIVER_H3_RES);
}

/** The cell a saved place is filed under. Query-side only. */
export function toSearchCell(latitude: number, longitude: number): string {
  return latLngToCell(latitude, longitude, SEARCH_H3_RES);
}

/** `k=1` → 7 cells (centre + ring), `k=2` → 19. */
export function cellDisk(h3Index: string, k: number): string[] {
  if (!isValidCell(h3Index)) return [];
  return gridDisk(h3Index, Math.max(0, Math.trunc(k)));
}

/**
 * The cells covering a camera's bounds. `polygonToCells` on the bbox, not a
 * fat `gridDisk` around the last ping: a driver who pans to another
 * neighbourhood should see *that* lattice.
 */
export function viewportCells(
  west: number,
  south: number,
  east: number,
  north: number,
  res: number = DRIVER_H3_RES,
): string[] {
  // h3-js takes [lat, lng] rings by default, closed or not.
  return polygonToCells(
    [
      [south, west],
      [south, east],
      [north, east],
      [north, west],
    ],
    res,
  );
}

/**
 * GeoJSON `[lng, lat]`, ring closed. H3 hands back `[lat, lng]` — swapping
 * the pair draws the whole grid in the Atlantic.
 */
export function cellPolygon(h3Index: string): GeoJSON.Polygon {
  const ring = cellToBoundary(h3Index).map(
    ([lat, lng]) => [lng, lat] as GeoJSON.Position,
  );
  const first = ring[0];
  if (first) ring.push(first);
  return { type: "Polygon", coordinates: [ring] };
}

/** The centre of a cell, for a position that must not be a driver's exact fix. */
export function cellCenter(h3Index: string): {
  latitude: number;
  longitude: number;
} {
  const [latitude, longitude] = cellToLatLng(h3Index);
  return { latitude, longitude };
}

export function isCell(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0 && isValidCell(value);
}

/** Cells as map data. The kit is handed GeoJSON and never hears the word hex. */
export function cellsToFeatureCollection(
  cells: string[],
  properties?: (h3Index: string) => Record<string, unknown>,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: cells.map((cell) => ({
      type: "Feature",
      id: cell,
      properties: { ...(properties?.(cell) ?? {}) },
      geometry: cellPolygon(cell),
    })),
  };
}
