/** Freight economics helpers. Integer minor units. Pure. */

const METERS_PER_MILE = 1609.344;

export function metersToMiles(meters: number): number {
  return meters / METERS_PER_MILE;
}

export function milesToMeters(miles: number): number {
  return miles * METERS_PER_MILE;
}

/**
 * Rate per mile in minor units (cents), truncated toward zero.
 * Returns 0 when distance is zero — avoid Infinity.
 */
export function ratePerMile(
  carrierRateMinor: number,
  distanceMeters: number,
): number {
  if (!Number.isInteger(carrierRateMinor)) {
    throw new TypeError("carrierRateMinor must be integer minor units");
  }
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
    throw new RangeError("distanceMeters must be non-negative finite");
  }
  const miles = metersToMiles(distanceMeters);
  if (miles === 0) return 0;
  return Math.trunc(carrierRateMinor / miles);
}

/**
 * Haversine deadhead in meters between two points. Pure geometry — not routing.
 */
export function deadheadMeters(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(fromLat)) *
      Math.cos(toRad(toLat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function deadheadMiles(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  return metersToMiles(deadheadMeters(fromLat, fromLng, toLat, toLng));
}
