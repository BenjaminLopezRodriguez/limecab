/**
 * The wire contract between the spatial index and everything that asks it
 * questions. Frozen first, on purpose: the service and its callers are built
 * against this file, not against each other.
 *
 * This service does not know what Ride, Shop, Courier, Help or Driver mean.
 * They ask spatial questions; they get places.
 */

/** Lime's own taxonomy. Provider types are preserved separately, never here. */
export const ENTITY_TYPES = [
  "retail_store",
  "grocery_store",
  "convenience_store",
  "pharmacy",
  "restaurant",
  "cafe",
  "gas_station",
  "parking",
  "school",
  "university",
  "hospital",
  "hotel",
  "airport",
  "transit_station",
  "government",
  "entertainment",
  "park",
  "address",
  "generic_place",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export type ProviderName = "google" | "mapbox";

export type CoverageStatus =
  | "unknown"
  | "hydrating"
  | "fresh"
  | "stale"
  | "empty";

/** How stale a caller is willing to tolerate before we pay a provider. */
export type Freshness = "any" | "default" | "strict";

export type FindNearbyRequest = {
  latitude: number;
  longitude: number;
  /** Free text, e.g. "nearest Target". Normalized deterministically. */
  query?: string;
  brandKey?: string;
  entityTypes?: EntityType[];
  maxDistanceMeters?: number;
  limit?: number;
  freshness?: Freshness;
};

/**
 * A Lime place. `id` is ours. `sources` is how the outside world names it —
 * plural because a place may be known to Google, Mapbox and an operator at
 * once. Callers key on `id`, never on a provider id.
 */
export type LimePlace = {
  id: string;
  canonicalName: string;
  shortName: string;
  normalizedName: string;
  brandKey: string | null;
  latitude: number;
  longitude: number;
  entityType: EntityType;
  entitySubtype: string | null;
  distanceMeters: number;
  h3R9: string;
  h3R10: string;
  sources: { provider: ProviderName; providerPlaceId: string }[];
  /** Providers whose terms require visible credit for this row. */
  attribution: ProviderName[];
};

/** Everything needed to answer "were we served without a provider request?" */
export type FindNearbyTelemetry = {
  h3R9: string;
  h3R8: string;
  resolution: number;
  queryType: "brand" | "entity_types" | "text" | "any";
  localHit: boolean;
  coverageState: CoverageStatus;
  providerCalled: boolean;
  providerRequests: number;
  candidates: number;
  returned: number;
  latencyMs: number;
};

export type FindNearbyResult = {
  places: LimePlace[];
  telemetry: FindNearbyTelemetry;
};

/**
 * HTTP surface. Every route requires `X-Lime-Spatial-Key`.
 *
 *   GET  /health                  -> { ok: true }
 *   POST /v1/nearby   FindNearbyRequest -> FindNearbyResult
 *   GET  /v1/places/:id           -> { place: LimePlace } | 404
 *   GET  /v1/coverage?lat=&lng=   -> { cells: CoverageSummary[] }
 *
 * Errors are { error: string } with a 4xx/5xx status. Callers fail soft.
 */
export type CoverageSummary = {
  h3Index: string;
  resolution: number;
  provider: ProviderName;
  queryFamily: string;
  status: CoverageStatus;
  lastHydratedAt: string | null;
  expiresAt: string | null;
  resultCount: number;
};
