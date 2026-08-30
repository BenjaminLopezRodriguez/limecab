import type {
  CoverageStatus,
  EntityType,
  FindNearbyRequest,
  FindNearbyResult,
  LimePlace,
  ProviderName,
} from "../contract.ts";
import type { Sql } from "../db.ts";
import { readQuery } from "../domain/normalize.ts";
import {
  R8,
  R9,
  coverageCell,
  distanceMeters,
  expandDisk,
  kForDistance,
  lookupCell,
  toParent,
} from "../h3/cells.ts";
import type { PlacesProvider } from "../providers/types.ts";
import { emit } from "../telemetry.ts";
import {
  isUsable,
  queryFamily,
  readCoverage,
  statusOf,
  type CoverageKey,
} from "./coverage.ts";
import { hydrateCell } from "./hydrate.ts";

const DEFAULT_LIMIT = 20;
const MAX_PROVIDER_REQUESTS = 3;
const CANDIDATE_CAP = 500;

/** What ranking needs beyond the wire shape: how fresh the row's fields are. */
export type Candidate = LimePlace & { freshnessMs: number };

export type Criteria = {
  brandKey: string | null;
  entityTypes: EntityType[];
  normalizedQuery: string;
};

/**
 * Local-first. The provider is reached only when local coverage genuinely
 * fails, expansion is bounded, and every returned distance is haversine —
 * cell adjacency decides what we look at, never what is nearest.
 */
export async function findNearby(
  sql: Sql,
  providers: PlacesProvider[],
  request: FindNearbyRequest,
): Promise<FindNearbyResult> {
  const startedAt = Date.now();
  const parsed = request.query ? readQuery(request.query) : null;
  const criteria: Criteria = {
    brandKey: request.brandKey ?? parsed?.brandKey ?? null,
    entityTypes: request.entityTypes ?? parsed?.entityTypes ?? [],
    normalizedQuery: parsed?.normalized ?? "",
  };
  const family = queryFamily(criteria);
  const limit = Math.min(100, Math.max(1, request.limit ?? DEFAULT_LIMIT));
  const originR9 = lookupCell(request.latitude, request.longitude);
  const originR8 = coverageCell(request.latitude, request.longitude);
  const kMax = kForDistance(request.maxDistanceMeters);

  let k = 0;
  let candidates = await readLocal(sql, expandDisk(originR9, k), criteria);
  while (candidates.length < limit && k < kMax) {
    k += 1;
    candidates = await readLocal(sql, expandDisk(originR9, k), criteria);
  }

  const cells = coverageCells(originR9, k, originR8);
  const coverage = await readCoverage(
    sql,
    cells.flatMap((h3Index) =>
      providers.map((p) => ({ provider: p.name, queryFamily: family, h3Index })),
    ),
  );
  const statusFor = (provider: ProviderName, h3Index: string): CoverageStatus =>
    statusOf(
      coverage.find(
        (row) =>
          row.provider === provider &&
          row.h3_index === h3Index &&
          row.query_family === family,
      ),
    );

  const originState = bestStatus(providers.map((p) => statusFor(p.name, originR8)));
  const enough = candidates.length >= limit;
  const acceptable = request.freshness === "strict" ? originState === "fresh" : isUsable(originState);
  const localHit = enough || acceptable;

  let providerRequests = 0;
  if (!localHit && request.freshness !== "any" && providers.length > 0) {
    // The centre cell is what "near me" means; neighbours are only bought if
    // the centre came back with nothing at all.
    for (const h3Index of cells) {
      if (providerRequests >= MAX_PROVIDER_REQUESTS) break;
      for (const provider of providers) {
        if (providerRequests >= MAX_PROVIDER_REQUESTS) break;
        if (isUsable(statusFor(provider.name, h3Index))) continue;
        const outcome = await hydrateCell(sql, provider, {
          key: { provider: provider.name, queryFamily: family, h3Index },
          entityTypes: criteria.entityTypes,
          query: criteria.brandKey ?? undefined,
        });
        if (outcome.providerCalled) providerRequests += 1;
        // Google declined or found nothing; let Mapbox warm the same cell.
        if (outcome.indexed > 0) break;
      }
      if (providerRequests > 0) {
        candidates = await readLocal(sql, expandDisk(originR9, k), criteria);
        if (candidates.length > 0) break;
      }
    }
  }

  const ranked = rankPlaces(
    candidates,
    request.latitude,
    request.longitude,
    criteria,
    request.maxDistanceMeters,
  ).slice(0, limit);

  const telemetry = {
    h3R9: originR9,
    h3R8: originR8,
    resolution: R9,
    queryType: queryTypeOf(request, criteria),
    localHit,
    coverageState: originState,
    providerCalled: providerRequests > 0,
    providerRequests,
    candidates: candidates.length,
    returned: ranked.length,
    latencyMs: Date.now() - startedAt,
  } as const;
  emit(telemetry);

  return { places: ranked.map(toLimePlace), telemetry };
}

/**
 * Ranking, in order: exact brand → exact normalized name → entity-type
 * relevance → true geographic distance → source freshness.
 */
export function rankPlaces(
  candidates: Candidate[],
  latitude: number,
  longitude: number,
  criteria: Criteria,
  maxDistanceMeters?: number,
): Candidate[] {
  const types = new Set(criteria.entityTypes);
  return candidates
    .map((place) => ({
      ...place,
      distanceMeters: distanceMeters(
        latitude,
        longitude,
        place.latitude,
        place.longitude,
      ),
    }))
    .filter(
      (place) => !maxDistanceMeters || place.distanceMeters <= maxDistanceMeters,
    )
    .sort((a, b) => {
      const brand =
        score(Boolean(criteria.brandKey) && a.brandKey === criteria.brandKey) -
        score(Boolean(criteria.brandKey) && b.brandKey === criteria.brandKey);
      if (brand !== 0) return brand;
      const name =
        score(
          criteria.normalizedQuery.length > 0 &&
            a.normalizedName === criteria.normalizedQuery,
        ) -
        score(
          criteria.normalizedQuery.length > 0 &&
            b.normalizedName === criteria.normalizedQuery,
        );
      if (name !== 0) return name;
      const type =
        score(types.size > 0 && types.has(a.entityType)) -
        score(types.size > 0 && types.has(b.entityType));
      if (type !== 0) return type;
      if (a.distanceMeters !== b.distanceMeters) {
        return a.distanceMeters - b.distanceMeters;
      }
      return b.freshnessMs - a.freshnessMs;
    });
}

/** Sorts truthy first. */
function score(hit: boolean): number {
  return hit ? -1 : 0;
}

/**
 * Rows whose cached display fields have outlived `fields_expire_at` are read
 * as *absent*, not as stale-but-serveable. Google's terms let us keep a place
 * id forever and the name/coords only for a while; serving an expired row
 * would quietly turn the index into the permanent copy we promised not to
 * build. Dropping it instead makes the cell look thin, which is exactly the
 * signal hydration already knows how to answer — the refresh rewrites the row
 * on its way back.
 */
export async function readLocal(
  sql: Sql,
  cells: string[],
  criteria: Criteria,
): Promise<Candidate[]> {
  if (cells.length === 0) return [];
  const brand = criteria.brandKey
    ? sql`AND p.brand_key = ${criteria.brandKey}`
    : sql``;
  const types = criteria.entityTypes.length
    ? sql`AND p.entity_type = ANY(${criteria.entityTypes})`
    : sql``;
  const rows = await sql`
    SELECT p.id, p.canonical_name, p.short_name, p.normalized_name, p.brand_key,
           p.latitude, p.longitude, p.entity_type, p.entity_subtype,
           p.h3_r9, p.h3_r10, p.fields_expire_at,
           COALESCE(
             jsonb_agg(jsonb_build_object('provider', s.provider,
                                          'providerPlaceId', s.provider_place_id))
             FILTER (WHERE s.provider IS NOT NULL), '[]'::jsonb) AS sources
    FROM place p
    LEFT JOIN place_source s ON s.place_id = p.id
    WHERE p.status = 'active' AND p.h3_r9 = ANY(${cells})
      AND (p.fields_expire_at IS NULL OR p.fields_expire_at > now())
      ${brand} ${types}
    GROUP BY p.id
    LIMIT ${CANDIDATE_CAP}
  `;
  return rows.map(toCandidate);
}

/** Google's terms want visible credit; the caller owns showing it. */
export function attributionFor(
  sources: { provider: ProviderName }[],
): ProviderName[] {
  return [...new Set(sources.map((s) => s.provider))].filter(
    (provider) => provider === "google",
  );
}

/** The r8 cells the r9 disk touches, origin first — we buy the centre first. */
export function coverageCells(
  originR9: string,
  k: number,
  originR8: string,
): string[] {
  const parents = expandDisk(originR9, k).map((cell) => toParent(cell, R8));
  return [originR8, ...parents.filter((cell) => cell !== originR8)].filter(
    (cell, i, all) => all.indexOf(cell) === i,
  );
}

/**
 * Coverage rows are per-provider, but the question "must we pay someone?" is
 * answered by the best row: if Mapbox already covered this cell for this
 * question, Google's `unknown` is not a reason to buy it again.
 */
function bestStatus(states: CoverageStatus[]): CoverageStatus {
  if (states.length === 0) return "unknown";
  const order: CoverageStatus[] = ["unknown", "stale", "hydrating", "empty", "fresh"];
  return states.reduce((best, state) =>
    order.indexOf(state) > order.indexOf(best) ? state : best,
  );
}

function queryTypeOf(
  request: FindNearbyRequest,
  criteria: Criteria,
): "brand" | "entity_types" | "text" | "any" {
  if (criteria.brandKey) return "brand";
  if (criteria.entityTypes.length > 0) return "entity_types";
  if (request.query) return "text";
  return "any";
}

/** Strip the ranking-only field before the wire sees it. */
function toLimePlace(candidate: Candidate): LimePlace {
  const { freshnessMs: _freshnessMs, ...place } = candidate;
  return place;
}

export function placeById(sql: Sql, id: string): Promise<Candidate[]> {
  return sql`
    SELECT p.id, p.canonical_name, p.short_name, p.normalized_name, p.brand_key,
           p.latitude, p.longitude, p.entity_type, p.entity_subtype,
           p.h3_r9, p.h3_r10, p.fields_expire_at,
           COALESCE(
             jsonb_agg(jsonb_build_object('provider', s.provider,
                                          'providerPlaceId', s.provider_place_id))
             FILTER (WHERE s.provider IS NOT NULL), '[]'::jsonb) AS sources
    FROM place p
    LEFT JOIN place_source s ON s.place_id = p.id
    WHERE p.id = ${id}
      AND (p.fields_expire_at IS NULL OR p.fields_expire_at > now())
    GROUP BY p.id
  `.then((rows) => rows.map(toCandidate));
}

type PlaceRow = Record<string, unknown>;

function toCandidate(row: PlaceRow): Candidate {
  const sources = row.sources as Candidate["sources"];
  return {
    id: row.id as string,
    canonicalName: row.canonical_name as string,
    shortName: row.short_name as string,
    normalizedName: row.normalized_name as string,
    brandKey: (row.brand_key as string | null) ?? null,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    entityType: row.entity_type as EntityType,
    entitySubtype: (row.entity_subtype as string | null) ?? null,
    distanceMeters: 0,
    h3R9: row.h3_r9 as string,
    h3R10: row.h3_r10 as string,
    sources,
    attribution: attributionFor(sources),
    freshnessMs: (row.fields_expire_at as Date | null)?.getTime() ?? 0,
  };
}

/** The wire shape, minus the ranking-only freshness field. */
export function toWirePlace(candidate: Candidate): LimePlace {
  return toLimePlace(candidate);
}
