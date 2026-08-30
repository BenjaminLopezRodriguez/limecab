import { randomUUID } from "node:crypto";

import type { EntityType } from "../contract.ts";
import type { Sql } from "../db.ts";
import { cellCenter, toCellHierarchy } from "../h3/cells.ts";
import { normalizePlace } from "../domain/normalize.ts";
import type { PlacesProvider, ProviderPlace } from "../providers/types.ts";
import {
  FRESH_TTL_MS,
  markHydrating,
  recordCoverage,
  type CoverageKey,
} from "./coverage.ts";

/** One nearby request with this radius genuinely covers one r8 cell. */
export const HYDRATE_RADIUS_METERS = 700;

const LOCK_WAIT_MS = 150;

export type HydrateOutcome = {
  providerCalled: boolean;
  requests: number;
  indexed: number;
  reason?: "rate_limited" | "lock_lost";
};

export type HydrateInput = {
  key: CoverageKey;
  entityTypes?: EntityType[];
  query?: string;
  radiusMeters?: number;
};

/** Refill-per-second token bucket. Over budget we serve local and say so. */
export class TokenBucket {
  #tokens: number;
  #last = Date.now();
  readonly #capacity: number;
  readonly #perSecond: number;
  constructor(capacity: number, perSecond: number) {
    this.#capacity = capacity;
    this.#perSecond = perSecond;
    this.#tokens = capacity;
  }
  take(now = Date.now()): boolean {
    this.#tokens = Math.min(
      this.#capacity,
      this.#tokens + ((now - this.#last) / 1000) * this.#perSecond,
    );
    this.#last = now;
    if (this.#tokens < 1) return false;
    this.#tokens -= 1;
    return true;
  }
}

const buckets = new Map<string, TokenBucket>();

function bucketFor(provider: string): TokenBucket {
  const existing = buckets.get(provider);
  if (existing) return existing;
  const rps = Number(process.env.SPATIAL_PROVIDER_RPS ?? 5);
  const bucket = new TokenBucket(Math.max(1, rps * 4), Math.max(1, rps));
  buckets.set(provider, bucket);
  return bucket;
}

/** 50 concurrent callers asking the same cell the same question, 1 fetch. */
const inFlight = new Map<string, Promise<HydrateOutcome>>();

export function singleFlight<T>(
  key: string,
  map: Map<string, Promise<T>>,
  run: () => Promise<T>,
): Promise<T> {
  const existing = map.get(key);
  if (existing) return existing;
  const promise = run().finally(() => map.delete(key));
  map.set(key, promise);
  return promise;
}

export function hydrateKey(input: HydrateInput): string {
  const radius = input.radiusMeters ?? HYDRATE_RADIUS_METERS;
  return `${input.key.provider}|${input.key.queryFamily}|${input.key.h3Index}|${radius}`;
}

/**
 * Lazy hydration. Everything the provider hands back is filed under its OWN
 * r9/r10 hierarchy — one cold lookup warms a small neighbourhood of places —
 * while coverage is claimed for the queried cell alone.
 */
export async function hydrateCell(
  sql: Sql,
  provider: PlacesProvider,
  input: HydrateInput,
): Promise<HydrateOutcome> {
  return singleFlight(hydrateKey(input), inFlight, () =>
    runHydration(sql, provider, input),
  );
}

async function runHydration(
  sql: Sql,
  provider: PlacesProvider,
  input: HydrateInput,
): Promise<HydrateOutcome> {
  if (!bucketFor(provider.name).take()) {
    return { providerCalled: false, requests: 0, indexed: 0, reason: "rate_limited" };
  }

  const radiusMeters = input.radiusMeters ?? HYDRATE_RADIUS_METERS;
  const centre = cellCenter(input.key.h3Index);
  const lockKey = hydrateKey(input);

  // A second replica that loses the lock waits a beat and re-reads local
  // rather than buying the same cell twice.
  const locked = await sql.begin(async (tx) => {
    const [row] = await tx`
      SELECT pg_try_advisory_xact_lock(hashtext(${lockKey})) AS ok
    `;
    if (!row?.ok) return false;
    await markHydrating(tx as unknown as Sql, input.key);
    return true;
  });
  if (!locked) {
    await new Promise((resolve) => setTimeout(resolve, LOCK_WAIT_MS));
    return { providerCalled: false, requests: 0, indexed: 0, reason: "lock_lost" };
  }

  const results = input.query
    ? await provider.searchText({
        query: input.query,
        latitude: centre.latitude,
        longitude: centre.longitude,
        radiusMeters,
      })
    : await provider.searchNearby({
        latitude: centre.latitude,
        longitude: centre.longitude,
        radiusMeters,
        entityTypes: input.entityTypes,
      });

  const indexed = await indexPlaces(sql, provider, results);
  await recordCoverage(sql, input.key, {
    resultCount: results.length,
    radiusMeters,
  });
  return { providerCalled: true, requests: 1, indexed };
}

/** Upsert by (provider, provider_place_id) — the id is theirs, the row is ours. */
export async function indexPlaces(
  sql: Sql,
  provider: PlacesProvider,
  places: ProviderPlace[],
): Promise<number> {
  let indexed = 0;
  const seen = new Set<string>();
  for (const place of places) {
    if (seen.has(place.providerPlaceId)) continue;
    seen.add(place.providerPlaceId);
    // Its own lat/lng, never the query cell: that is what makes one request
    // warm a neighbourhood instead of a pile.
    const cells = toCellHierarchy(place.latitude, place.longitude);
    const normalized = normalizePlace(place);
    const sourceUpdatedAt = place.sourceUpdatedAt ?? null;
    // Place ids persist indefinitely; the display fields they name do not.
    const fieldsExpireAt = new Date(Date.now() + FRESH_TTL_MS);

    const [existing] = await sql`
      SELECT place_id FROM place_source
      WHERE provider = ${provider.name} AND provider_place_id = ${place.providerPlaceId}
    `;
    const placeId = (existing?.place_id as string | undefined) ?? randomUUID();

    if (existing) {
      await sql`
        UPDATE place SET
          canonical_name = ${normalized.canonicalName},
          short_name = ${normalized.shortName},
          normalized_name = ${normalized.normalizedName},
          brand_key = ${normalized.brandKey},
          latitude = ${place.latitude}, longitude = ${place.longitude},
          entity_type = ${normalized.entityType},
          entity_subtype = ${normalized.entitySubtype},
          provider_types = ${sql.json(place.rawTypes)},
          h3_r5 = ${cells.h3R5}, h3_r7 = ${cells.h3R7}, h3_r8 = ${cells.h3R8},
          h3_r9 = ${cells.h3R9}, h3_r10 = ${cells.h3R10}, h3_r11 = ${cells.h3R11},
          last_seen_at = now(), source_updated_at = ${sourceUpdatedAt},
          fields_expire_at = ${fieldsExpireAt}, status = 'active'
        WHERE id = ${placeId}
      `;
    } else {
      await sql`
        INSERT INTO place (id, canonical_name, short_name, normalized_name,
          brand_key, latitude, longitude, entity_type, entity_subtype,
          provider_types, h3_r5, h3_r7, h3_r8, h3_r9, h3_r10, h3_r11,
          source_updated_at, fields_expire_at)
        VALUES (${placeId}, ${normalized.canonicalName}, ${normalized.shortName},
          ${normalized.normalizedName}, ${normalized.brandKey},
          ${place.latitude}, ${place.longitude}, ${normalized.entityType},
          ${normalized.entitySubtype}, ${sql.json(place.rawTypes)},
          ${cells.h3R5}, ${cells.h3R7}, ${cells.h3R8}, ${cells.h3R9},
          ${cells.h3R10}, ${cells.h3R11}, ${sourceUpdatedAt}, ${fieldsExpireAt})
      `;
    }

    const [linked] = await sql`
      INSERT INTO place_source (place_id, provider, provider_place_id, source_updated_at)
      VALUES (${placeId}, ${provider.name}, ${place.providerPlaceId}, ${sourceUpdatedAt})
      ON CONFLICT (provider, provider_place_id)
      DO UPDATE SET last_seen_at = now(), source_updated_at = EXCLUDED.source_updated_at
      RETURNING place_id
    `;
    // Another writer won the race for this provider id; drop our spare row.
    if (!existing && linked && linked.place_id !== placeId) {
      await sql`DELETE FROM place WHERE id = ${placeId}`;
    }
    indexed += 1;
  }
  return indexed;
}
