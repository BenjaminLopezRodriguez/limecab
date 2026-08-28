import type { Location } from "../service-app/services.ts";

function milesBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Rest stops nearest a point. The live lookup uses this when Mapbox is down.
 */
export function nearbyRestStops(
  origin: Location,
  stops: readonly Location[],
  { limit = 8, maxMiles = 40 } = {},
): Location[] {
  if (origin.latitude === undefined || origin.longitude === undefined) return [];
  const from = { latitude: origin.latitude, longitude: origin.longitude };
  return stops
    .flatMap((stop) => {
      if (stop.latitude === undefined || stop.longitude === undefined) return [];
      const miles = milesBetween(from, {
        latitude: stop.latitude,
        longitude: stop.longitude,
      });
      if (miles > maxMiles) return [];
      return [{ stop, miles }];
    })
    .sort((a, b) => a.miles - b.miles)
    .slice(0, limit)
    .map((entry) => entry.stop);
}
