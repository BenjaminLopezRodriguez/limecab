import { distanceMiles } from "./domain.ts";

/** k=4 at res 8 is roughly a 3 km radius — the indexed marketplace disk. */
export const MARKETPLACE_K = 4;

/** Second-pass H3 ring before falling back to miles. */
export const MARKETPLACE_FALLBACK_K = 8;

/** How far an on-duty driver with a fresh fix still sees open trips. */
export const MARKETPLACE_MILES = 15;

type PickupCoords = {
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
};

type DriverCoords = {
  lastLatitude?: number | null;
  lastLongitude?: number | null;
};

/**
 * Trips whose pickup is within `maxMiles` of the driver's last fix.
 * Address-only rows (no coordinates) pass through — they predate H3.
 */
export function tripsWithinMarketplaceMiles<T extends PickupCoords>(
  trips: T[],
  driver: DriverCoords,
  maxMiles = MARKETPLACE_MILES,
): T[] {
  if (driver.lastLatitude == null || driver.lastLongitude == null) return trips;
  const here = {
    latitude: driver.lastLatitude,
    longitude: driver.lastLongitude,
    address: "",
  };
  return trips.filter((trip) => {
    if (trip.pickupLatitude == null || trip.pickupLongitude == null) {
      return true;
    }
    return (
      distanceMiles(here, {
        latitude: trip.pickupLatitude,
        longitude: trip.pickupLongitude,
        address: "",
      }) <= maxMiles
    );
  });
}
