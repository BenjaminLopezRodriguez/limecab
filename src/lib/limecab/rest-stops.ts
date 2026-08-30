import type { Location } from "../service-app/services.ts";

/**
 * Categories this app asks Search Box for. Rest stops were the first two;
 * Lime Shop added the shop ones. One union, one mapper — a second category
 * search would be a second source of truth about the same Mapbox response.
 */
export const MAP_CATEGORIES = [
  "coffee",
  "rest_area",
  "grocery",
  "supermarket",
  "pharmacy",
  "hardware_store",
] as const;

export type MapCategory = (typeof MAP_CATEGORIES)[number];

/** Shops a courier can buy a list at. */
export const SHOP_CATEGORIES: MapCategory[] = [
  "grocery",
  "supermarket",
  "pharmacy",
];

/** Hardware / home improvement — Home Depot, Lowe's. */
export const HARDWARE_CATEGORIES: MapCategory[] = ["hardware_store"];

export type RestStop = Location & {
  category?: MapCategory;
  distanceMeters?: number;
};

type CategorySearchFeature = {
  geometry?: { coordinates?: number[] };
  properties?: {
    name?: string;
    full_address?: string;
    address?: string;
    place_formatted?: string;
    poi_category_ids?: string[];
    mapbox_id?: string;
  };
  category?: RestStop["category"];
};

const METERS_PER_MILE = 1609.344;

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

function firstText(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function restStopCategory(
  feature: CategorySearchFeature,
): RestStop["category"] {
  const tagged = feature.category;
  if (tagged && MAP_CATEGORIES.includes(tagged)) return tagged;
  const ids = feature.properties?.poi_category_ids;
  return MAP_CATEGORIES.find((category) => ids?.includes(category));
}

/**
 * Mapbox Search Box FeatureCollection → nearest unique rest stops.
 */
export function restStopsFromFeatures(
  collection: { features?: readonly unknown[] },
  origin: { latitude: number; longitude: number },
  limit = 8,
): RestStop[] {
  const seen = new Set<string>();
  const ranked = (collection.features ?? [])
    .flatMap((raw) => {
      const feature = raw as CategorySearchFeature;
      const longitude = feature.geometry?.coordinates?.[0];
      const latitude = feature.geometry?.coordinates?.[1];
      if (
        typeof latitude !== "number" ||
        typeof longitude !== "number" ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        return [];
      }
      const props = feature.properties;
      const name = firstText(props?.name);
      const composed =
        props?.address && props.place_formatted
          ? `${props.address}, ${props.place_formatted}`
          : undefined;
      const address = firstText(
        props?.full_address,
        composed,
        props?.address,
        props?.place_formatted,
        name,
      );
      if (!address) return [];
      const miles = milesBetween(origin, { latitude, longitude });
      const stop: RestStop = {
        address,
        shortName: name ?? address.split(",")[0]?.trim() ?? address,
        latitude,
        longitude,
        category: restStopCategory(feature),
        distanceMeters: Math.round(miles * METERS_PER_MILE),
      };
      return [{ stop, mapboxId: props?.mapbox_id?.trim(), miles, latitude, longitude }];
    })
    .sort((a, b) => a.miles - b.miles)
    .flatMap(({ stop, mapboxId, latitude, longitude }) => {
      const geoKey = `geo:${latitude.toFixed(4)},${longitude.toFixed(4)}`;
      const keys = mapboxId ? [`id:${mapboxId}`, geoKey] : [geoKey];
      if (keys.some((key) => seen.has(key))) return [];
      for (const key of keys) seen.add(key);
      return [stop];
    });
  return interleaveCategories(ranked, Math.max(0, limit));
}

/** Closest of each category in turn so coffee does not drown rest areas. */
function interleaveCategories(stops: RestStop[], limit: number): RestStop[] {
  if (stops.length <= limit) return stops;
  const queues = new Map<string, RestStop[]>();
  for (const stop of stops) {
    const key = stop.category ?? "_";
    const queue = queues.get(key);
    if (queue) queue.push(stop);
    else queues.set(key, [stop]);
  }
  const buckets = [...queues.values()];
  const out: RestStop[] = [];
  while (out.length < limit) {
    let added = false;
    for (const queue of buckets) {
      const next = queue.shift();
      if (!next) continue;
      out.push(next);
      added = true;
      if (out.length >= limit) break;
    }
    if (!added) break;
  }
  return out;
}
