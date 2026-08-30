/**
 * The spatial index seen from this app: the wire types re-declared, the query
 * that asks it a question, and the mapper back into a `RestStop`.
 *
 * Re-declared and not imported because `services/spatial` is its own package
 * outside this tsconfig. The contract is frozen, so a copy is cheaper than a
 * build-graph edge — and this file is where it stays honest.
 */

import { z } from "zod";

import type { MapCategory, RestStop } from "./rest-stops.ts";

/** Lime's taxonomy, verbatim from the contract. Unknown values are rejected. */
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
export type Freshness = "any" | "default" | "strict";

export type FindNearbyRequest = {
  latitude: number;
  longitude: number;
  query?: string;
  brandKey?: string;
  entityTypes?: EntityType[];
  maxDistanceMeters?: number;
  limit?: number;
  freshness?: Freshness;
};

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
  attribution: ProviderName[];
};

/** Stores the Shop tab offers. */
export const SHOP_ENTITY_TYPES: EntityType[] = [
  "grocery_store",
  "retail_store",
  "convenience_store",
  "pharmacy",
];

/** Where a driver stops between rides. */
export const PIT_STOP_ENTITY_TYPES: EntityType[] = [
  "gas_station",
  "cafe",
  "parking",
];

const LIMIT_MAX = 25;
const METERS_MAX = 50_000;
/** Same patience the Mapbox/Google lookups get. A cold index is not an outage. */
const SPATIAL_MS = 2500;

const limePlaceSchema = z.object({
  id: z.string(),
  canonicalName: z.string(),
  shortName: z.string(),
  normalizedName: z.string(),
  brandKey: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  entityType: z.enum(ENTITY_TYPES),
  entitySubtype: z.string().nullable(),
  distanceMeters: z.number(),
  h3R9: z.string(),
  h3R10: z.string(),
  sources: z.array(
    z.object({
      provider: z.enum(["google", "mapbox"]),
      providerPlaceId: z.string(),
    }),
  ),
  attribution: z.array(z.enum(["google", "mapbox"])),
});

const findNearbyResultSchema = z.object({ places: z.array(limePlaceSchema) });

/**
 * `GET /api/map/nearby` query → a contract request. Unknown entity types are a
 * 400, not a silent drop: forwarding them would make the index answer a
 * question this app cannot have meant to ask.
 */
export const nearbyQuerySchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    brand: z.string().trim().min(1).optional(),
    q: z.string().trim().min(1).optional(),
    types: z.string().optional(),
    limit: z.coerce.number().int().optional(),
    maxMeters: z.coerce.number().optional(),
  })
  .transform((input, ctx) => {
    let entityTypes: EntityType[] | undefined;
    if (input.types !== undefined) {
      const parsed = z
        .array(z.enum(ENTITY_TYPES))
        .safeParse(
          input.types
            .split(",")
            .map((value) => value.trim())
            .filter((value) => value.length > 0),
        );
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Unknown entity type",
          path: ["types"],
        });
        return z.NEVER;
      }
      if (parsed.data.length > 0) entityTypes = parsed.data;
    }
    const request: FindNearbyRequest = {
      latitude: input.lat,
      longitude: input.lng,
    };
    if (input.q) request.query = input.q;
    if (input.brand) request.brandKey = input.brand;
    if (entityTypes) request.entityTypes = entityTypes;
    if (input.limit !== undefined) {
      request.limit = clamp(input.limit, 1, LIMIT_MAX);
    }
    if (input.maxMeters !== undefined) {
      request.maxDistanceMeters = clamp(
        Math.trunc(input.maxMeters),
        1,
        METERS_MAX,
      );
    }
    return request;
  });

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * One POST to `/v1/nearby`. `null` means "ask somebody else" — an unreachable,
 * slow or nonsense-talking index must never become the caller's error.
 */
export async function fetchNearby(
  request: FindNearbyRequest,
  config: { baseUrl: string; apiKey: string },
): Promise<LimePlace[] | null> {
  try {
    const res = await fetch(new URL("/v1/nearby", config.baseUrl), {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(SPATIAL_MS),
      headers: {
        "Content-Type": "application/json",
        "X-Lime-Spatial-Key": config.apiKey,
      },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      console.info(`[spatial] nearby ${res.status} — falling back`);
      return null;
    }
    const parsed = findNearbyResultSchema.safeParse(await res.json());
    if (!parsed.success) {
      console.info("[spatial] nearby body off-contract — falling back");
      return null;
    }
    return parsed.data.places;
  } catch {
    console.info("[spatial] nearby unavailable — falling back");
    return null;
  }
}

/** The taxonomies overlap, they do not match. Unmapped types stay uncategorised. */
const CATEGORY_BY_ENTITY: Partial<Record<EntityType, MapCategory>> = {
  grocery_store: "grocery",
  convenience_store: "grocery",
  pharmacy: "pharmacy",
  cafe: "coffee",
};

/** Index rows in the shape every list scene already renders. */
export function restStopsFromPlaces(places: readonly LimePlace[]): RestStop[] {
  return places.map((place) => ({
    address: place.canonicalName,
    shortName: place.shortName,
    latitude: place.latitude,
    longitude: place.longitude,
    category: CATEGORY_BY_ENTITY[place.entityType],
    distanceMeters: Math.round(place.distanceMeters),
  }));
}
