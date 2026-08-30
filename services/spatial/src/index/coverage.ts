import type { CoverageStatus, ProviderName } from "../contract.ts";
import { R8 } from "../h3/cells.ts";
import type { Sql } from "../db.ts";

/** A hydration is worth a month; a barren cell is worth six hours of silence. */
export const FRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const EMPTY_TTL_MS = 6 * 60 * 60 * 1000;

export type CoverageKey = {
  provider: ProviderName;
  queryFamily: string;
  h3Index: string;
};

export type CoverageRow = {
  provider: ProviderName;
  query_family: string;
  h3_index: string;
  resolution: number;
  coverage_status: CoverageStatus;
  last_hydrated_at: Date | null;
  expires_at: Date | null;
  result_count: number;
  query_radius_meters: number | null;
};

/**
 * Coverage is a fact about a question, not about a place. "Google covered this
 * cell for Targets" says nothing about pharmacies, and nothing about Mapbox.
 */
export function queryFamily(input: {
  brandKey?: string | null;
  entityTypes?: readonly string[];
}): string {
  if (input.brandKey) return `brand:${input.brandKey}`;
  if (input.entityTypes?.length) {
    return `types:${[...input.entityTypes].sort().join(",")}`;
  }
  return "all";
}

export async function readCoverage(
  sql: Sql,
  keys: CoverageKey[],
): Promise<CoverageRow[]> {
  if (keys.length === 0) return [];
  const providers = [...new Set(keys.map((k) => k.provider))];
  const families = [...new Set(keys.map((k) => k.queryFamily))];
  const cells = [...new Set(keys.map((k) => k.h3Index))];
  return (await sql`
    SELECT provider, query_family, h3_index, resolution, coverage_status,
           last_hydrated_at, expires_at, result_count, query_radius_meters
    FROM cell_coverage
    WHERE provider = ANY(${providers}) AND query_family = ANY(${families})
      AND h3_index = ANY(${cells}) AND resolution = ${R8}
  `) as unknown as CoverageRow[];
}

/** Expiry is the only thing that turns a recorded status into `stale`. */
export function statusOf(
  row: CoverageRow | undefined,
  now = new Date(),
): CoverageStatus {
  if (!row) return "unknown";
  if (row.coverage_status === "hydrating") return "hydrating";
  if (row.expires_at && row.expires_at.getTime() <= now.getTime()) return "stale";
  return row.coverage_status;
}

/** A cell we need not pay a provider for right now. */
export function isUsable(status: CoverageStatus): boolean {
  return status === "fresh" || status === "empty";
}

export async function markHydrating(sql: Sql, key: CoverageKey): Promise<void> {
  await sql`
    INSERT INTO cell_coverage (provider, query_family, h3_index, resolution,
                               coverage_status)
    VALUES (${key.provider}, ${key.queryFamily}, ${key.h3Index}, ${R8}, 'hydrating')
    ON CONFLICT (provider, query_family, h3_index, resolution)
    DO UPDATE SET coverage_status = 'hydrating'
  `;
}

/**
 * Recorded for the r8 cell we actually centred on, with the radius we actually
 * used. Neighbours stay `unknown` — we index what we learned, we claim only
 * what we bought.
 */
export async function recordCoverage(
  sql: Sql,
  key: CoverageKey,
  input: { resultCount: number; radiusMeters: number; now?: Date },
): Promise<void> {
  const now = input.now ?? new Date();
  const status: CoverageStatus = input.resultCount > 0 ? "fresh" : "empty";
  const expires = new Date(
    now.getTime() + (status === "fresh" ? FRESH_TTL_MS : EMPTY_TTL_MS),
  );
  await sql`
    INSERT INTO cell_coverage (provider, query_family, h3_index, resolution,
                               coverage_status, last_hydrated_at, expires_at,
                               result_count, query_radius_meters)
    VALUES (${key.provider}, ${key.queryFamily}, ${key.h3Index}, ${R8},
            ${status}, ${now}, ${expires}, ${input.resultCount},
            ${Math.round(input.radiusMeters)})
    ON CONFLICT (provider, query_family, h3_index, resolution)
    DO UPDATE SET coverage_status = EXCLUDED.coverage_status,
                  last_hydrated_at = EXCLUDED.last_hydrated_at,
                  expires_at = EXCLUDED.expires_at,
                  result_count = EXCLUDED.result_count,
                  query_radius_meters = EXCLUDED.query_radius_meters
  `;
}
