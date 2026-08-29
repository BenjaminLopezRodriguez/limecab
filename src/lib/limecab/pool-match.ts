/**
 * UberPOOL matching, as LimeCab can actually run it.
 *
 * Dispatch already lets a driver accept onto `rankLiveJobs`. This module only
 * ranks the inbox: when the current job is Pool, other Pool offers that share
 * the route sit in front. It does not replace the trip machine.
 *
 * Copied from Uber, dropped what we cannot run (LP solvers, ML rankers, live
 * ETAs):
 *
 * - Similar pickup *and* destination, destination required to match
 *   https://www.uber.com/blog/los-angeles/la-uberpool-faqs/
 * - Same direction; never more than a few minutes out of the way
 *   https://www.uber.com/blog/austin/uberpool-now-available-247-in-austin/
 * - Avoid detours; pick up along the route, not a zigzag
 *   https://www.uber.com/newsroom/manhattanpool
 * - Closest pickup is not the best match — rank the batch, not greedy-nearest
 *   https://www.uber.com/us/en/marketplace/matching/
 * - H3 cells + k-ring as the proximity bucket, including uberPOOL
 *   https://www.uber.com/blog/h3/
 * - Direction is a dispatch feature, not just deadhead
 *   https://www.uber.com/blog/machine-learning/
 */

import { distanceMiles, isWaitSaveProduct, tripMinutes } from "./domain.ts";
import { cellDisk, isCell, toDriverCell } from "./h3.ts";

export const POOL_PRODUCT_ID = "lime-pool";

/** Uber Austin: "a few minutes out of your way." */
export const POOL_DETOUR_MINUTES = 8;

/** Same k as the marketplace disk. Res 8, k=2 ≈ 1.5 km. */
export const POOL_H3_K = 2;

/** Opposite heading is not "along a similar route." */
export const POOL_HEADING_DEG = 90;

export function isPoolProduct(productId: string): boolean {
  return productId === POOL_PRODUCT_ID;
}

export type PoolLeg = {
  productId: string;
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  pickupH3?: string | null;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  tripMinutes?: number | null;
  arrivalMinutes?: number;
  status?: string;
};

type Point = { latitude: number; longitude: number; address: string };

function point(
  latitude?: number | null,
  longitude?: number | null,
): Point | null {
  if (typeof latitude !== "number" || typeof longitude !== "number")
    return null;
  return { latitude, longitude, address: "" };
}

function pickupPoint(trip: PoolLeg): Point | null {
  return point(trip.pickupLatitude, trip.pickupLongitude);
}

function destPoint(trip: PoolLeg): Point | null {
  return point(trip.destinationLatitude, trip.destinationLongitude);
}

function pickupCell(trip: PoolLeg): string | null {
  if (isCell(trip.pickupH3)) return trip.pickupH3;
  const pickup = pickupPoint(trip);
  return pickup ? toDriverCell(pickup.latitude, pickup.longitude) : null;
}

function destCell(trip: PoolLeg): string | null {
  const dest = destPoint(trip);
  return dest ? toDriverCell(dest.latitude, dest.longitude) : null;
}

function inDisk(origin: string | null, candidate: string | null): boolean {
  if (!origin || !candidate) return false;
  return cellDisk(origin, POOL_H3_K).includes(candidate);
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function bearingDeg(from: Point, to: Point): number {
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function headingDelta(a: number, b: number): number {
  const delta = Math.abs(a - b) % 360;
  return delta > 180 ? 360 - delta : delta;
}

function sameDirection(active: PoolLeg, offer: PoolLeg): boolean {
  const aPickup = pickupPoint(active);
  const aDest = destPoint(active);
  const bPickup = pickupPoint(offer);
  const bDest = destPoint(offer);
  if (!aPickup || !aDest || !bPickup || !bDest) return false;
  return (
    headingDelta(bearingDeg(aPickup, aDest), bearingDeg(bPickup, bDest)) <=
    POOL_HEADING_DEG
  );
}

function nearbyOnRoute(active: PoolLeg, offer: PoolLeg): boolean {
  const aPickup = pickupCell(active);
  const aDest = destCell(active);
  const bPickup = pickupCell(offer);
  const bDest = destCell(offer);
  // Destinations must overlap — LA FAQ: similar pickup *and* destination.
  if (!inDisk(aDest, bDest)) return false;
  // Pickup nearby, or along the remaining route (Manhattan / Austin along-the-way).
  return inDisk(aPickup, bPickup) || inDisk(aDest, bPickup);
}

function alreadyPickedUp(active: PoolLeg): boolean {
  return active.status === "in_progress";
}

function minutesUntil(stops: Point[], dest: Point): number {
  let minutes = 0;
  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1]!;
    const to = stops[i]!;
    minutes += tripMinutes(distanceMiles(from, to));
    if (to.latitude === dest.latitude && to.longitude === dest.longitude) {
      return minutes;
    }
  }
  return Number.POSITIVE_INFINITY;
}

function soloMinutes(trip: PoolLeg, from: Point, to: Point): number {
  if (typeof trip.tripMinutes === "number" && trip.tripMinutes > 0) {
    return trip.tripMinutes;
  }
  return tripMinutes(distanceMiles(from, to));
}

/**
 * Extra minutes vs each rider's solo, best insertion. Infinity = no legal
 * order under the budget. Extra deadhead is the legs that are not on a solo
 * path; extra on-trip is pooled time-to-drop minus solo.
 */
export function poolDetourMinutes(active: PoolLeg, offer: PoolLeg): number {
  const aPickup = pickupPoint(active);
  const aDest = destPoint(active);
  const bPickup = pickupPoint(offer);
  const bDest = destPoint(offer);
  if (!aPickup || !aDest || !bPickup || !bDest) return Number.POSITIVE_INFINITY;

  const soloA = soloMinutes(active, aPickup, aDest);
  const soloB = soloMinutes(offer, bPickup, bDest);

  const sequences: Point[][] = alreadyPickedUp(active)
    ? [
        [bPickup, aDest, bDest],
        [bPickup, bDest, aDest],
      ]
    : [
        [aPickup, bPickup, aDest, bDest],
        [aPickup, bPickup, bDest, aDest],
        [bPickup, aPickup, aDest, bDest],
        [bPickup, aPickup, bDest, aDest],
      ];

  let best = Number.POSITIVE_INFINITY;
  for (const stops of sequences) {
    const extraA = minutesUntil(stops, aDest) - soloA;
    const extraB = minutesUntil(stops, bDest) - soloB;
    if (extraA > POOL_DETOUR_MINUTES || extraB > POOL_DETOUR_MINUTES) continue;
    // Worse-off rider's extra — Uber: do not significantly increase *each* trip.
    const extra = Math.max(extraA, extraB);
    if (extra < best) best = extra;
  }
  return best;
}

export function poolFits(active: PoolLeg, offer: PoolLeg): boolean {
  if (!isPoolProduct(active.productId) || !isPoolProduct(offer.productId)) {
    return false;
  }
  if (!sameDirection(active, offer) || !nearbyOnRoute(active, offer)) {
    return false;
  }
  return poolDetourMinutes(active, offer) <= POOL_DETOUR_MINUTES;
}

/**
 * Inbox order. A live Pool job pulls compatible Pool offers to the front,
 * cheapest detour first. Empty cars keep nearest-deadhead. Non-Pool never
 * jumps a fitting Pool stack. Wait & Save sits behind every other ride —
 * the rider traded matching priority for the lower fare.
 */
export function rankOpenOffers<T extends PoolLeg>(
  open: readonly T[],
  current: PoolLeg | null | undefined,
): T[] {
  const stacking = current && isPoolProduct(current.productId);
  return [...open].sort((a, b) => {
    if (stacking && current) {
      const aFit = poolFits(current, a);
      const bFit = poolFits(current, b);
      if (aFit !== bFit) return aFit ? -1 : 1;
      if (aFit && bFit) {
        const detour =
          poolDetourMinutes(current, a) - poolDetourMinutes(current, b);
        if (detour !== 0) return detour;
      }
    }
    const aWait = isWaitSaveProduct(a.productId);
    const bWait = isWaitSaveProduct(b.productId);
    if (aWait !== bWait) return aWait ? 1 : -1;
    return (a.arrivalMinutes ?? 0) - (b.arrivalMinutes ?? 0);
  });
}
