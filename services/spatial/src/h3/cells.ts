import {
  cellToLatLng,
  cellToParent,
  gridDisk,
  isValidCell,
  latLngToCell,
} from "h3-js";

/**
 * Six resolutions, three jobs. r8 is the coverage unit because a ~700 m
 * provider request honestly covers one r8 cell and nothing wider. r9 is the
 * lookup unit because a k=1 disk is ~500 m across, which is what "near me"
 * means to someone on a sidewalk. r5/r7/r11 are stored for later and read by
 * nothing today.
 *
 * H3 is candidate geography ONLY. Cell adjacency is never distance —
 * `distanceMeters` is the only thing allowed to answer "nearest".
 */
export const R5 = 5;
export const R7 = 7;
export const R8 = 8;
export const R9 = 9;
export const R10 = 10;
export const R11 = 11;

/** k=4 is the hard cap: past that a "nearby" query is a different question. */
export const K_MAX = 4;

/** Roughly the r9 disk radius per k, used to bound expansion by distance. */
const R9_STEP_METERS = 250;

export type CellHierarchy = {
  h3R5: string;
  h3R7: string;
  h3R8: string;
  h3R9: string;
  h3R10: string;
  h3R11: string;
};

export function toCellHierarchy(latitude: number, longitude: number): CellHierarchy {
  return {
    h3R5: latLngToCell(latitude, longitude, R5),
    h3R7: latLngToCell(latitude, longitude, R7),
    h3R8: latLngToCell(latitude, longitude, R8),
    h3R9: latLngToCell(latitude, longitude, R9),
    h3R10: latLngToCell(latitude, longitude, R10),
    h3R11: latLngToCell(latitude, longitude, R11),
  };
}

/** The cell a hydration is centred on and the only cell it may claim. */
export function coverageCell(latitude: number, longitude: number): string {
  return latLngToCell(latitude, longitude, R8);
}

/** The cell candidates are retrieved from. */
export function lookupCell(latitude: number, longitude: number): string {
  return latLngToCell(latitude, longitude, R9);
}

/** k=0 → 1 cell, k=1 → 7, k=2 → 19. Bounded, never unbounded flood fill. */
export function expandDisk(h3Index: string, k: number): string[] {
  if (!isValidCell(h3Index)) return [];
  return gridDisk(h3Index, Math.min(K_MAX, Math.max(0, Math.trunc(k))));
}

/** How far out we are willing to walk the r9 grid for a distance budget. */
export function kForDistance(maxDistanceMeters: number | undefined): number {
  if (!maxDistanceMeters || !Number.isFinite(maxDistanceMeters)) return K_MAX;
  return Math.min(K_MAX, Math.max(0, Math.ceil(maxDistanceMeters / R9_STEP_METERS)));
}

/** The r8 coverage cell an r9 lookup cell sits inside. */
export function toParent(h3Index: string, resolution: number): string {
  return cellToParent(h3Index, resolution);
}

/** Hydration is centred on the cell, not the caller, so coverage is honest. */
export function cellCenter(h3Index: string): { latitude: number; longitude: number } {
  const [latitude, longitude] = cellToLatLng(h3Index);
  return { latitude, longitude };
}

const EARTH_RADIUS_M = 6_371_000;

/** The only distance in this service. Haversine, metres, no cell arithmetic. */
export function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLng = (bLng - aLng) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
