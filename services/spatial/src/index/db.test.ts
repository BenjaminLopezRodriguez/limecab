import test, { after } from "node:test";
import assert from "node:assert/strict";

import type { ProviderName } from "../contract.ts";
import { createDb, migrate, type Sql } from "../db.ts";
import { coverageCell, lookupCell, toCellHierarchy } from "../h3/cells.ts";
import type {
  NearbyRequest,
  PlacesProvider,
  ProviderPlace,
  TextRequest,
} from "../providers/types.ts";
import { findNearby } from "./find-nearby.ts";
import { indexPlaces } from "./hydrate.ts";

/**
 * These run for real against DATABASE_URL and skip cleanly without one. They
 * work in the empty degree square off West Africa: no live Lime coverage can
 * collide with them, and the cleanup below can safely take the whole box.
 */
// The provider budget is a production concern; here it would only make the
// tests order-dependent.
process.env.SPATIAL_PROVIDER_RPS = "1000";

const sql = process.env.DATABASE_URL ? createDb() : null;
let migrated: Promise<void> | null = null;

async function db(t: { skip: (reason?: string) => void }): Promise<Sql | null> {
  if (!sql) {
    t.skip("no DATABASE_URL");
    return null;
  }
  migrated ??= migrate(sql);
  await migrated;
  await sql`DELETE FROM place WHERE latitude BETWEEN -0.5 AND 0.5 AND longitude BETWEEN -0.5 AND 0.5`;
  await sql`DELETE FROM cell_coverage WHERE h3_index = ANY(${TEST_CELLS})`;
  return sql;
}

after(async () => {
  if (sql) await sql.end({ timeout: 5 });
});

const ORIGIN = { latitude: 0.11, longitude: 0.11 };
const TEST_CELLS = [coverageCell(ORIGIN.latitude, ORIGIN.longitude)];

/** A provider that never touches the network and counts what was asked of it. */
class MockProvider implements PlacesProvider {
  calls = 0;
  readonly name: ProviderName;
  readonly places: ProviderPlace[];
  constructor(name: ProviderName, places: ProviderPlace[]) {
    this.name = name;
    this.places = places;
  }
  async searchNearby(_req: NearbyRequest): Promise<ProviderPlace[]> {
    this.calls += 1;
    return this.places;
  }
  async searchText(_req: TextRequest): Promise<ProviderPlace[]> {
    this.calls += 1;
    return this.places;
  }
  async resolvePlace(): Promise<ProviderPlace | null> {
    return null;
  }
}

const TARGET: ProviderPlace = {
  providerPlaceId: "test-target",
  name: "Target - Test City",
  latitude: ORIGIN.latitude + 0.001,
  longitude: ORIGIN.longitude,
  rawTypes: ["department_store", "store"],
};

/** Deliberately a few hundred metres off the query cell. */
const MARKET: ProviderPlace = {
  providerPlaceId: "test-market",
  name: "Test Market",
  latitude: ORIGIN.latitude + 0.004,
  longitude: ORIGIN.longitude + 0.004,
  rawTypes: ["supermarket"],
};

test("a cold cell falls back to the provider and warms the index", async (t) => {
  const store = await db(t);
  if (!store) return;
  const google = new MockProvider("google", [TARGET, MARKET]);

  const result = await findNearby(store, [google], { ...ORIGIN, limit: 5 });
  assert.equal(google.calls, 1);
  assert.equal(result.telemetry.providerCalled, true);
  assert.equal(result.telemetry.providerRequests, 1);
  assert.equal(result.telemetry.coverageState, "unknown");
  assert.ok(result.places.length >= 1);
  assert.ok(result.places.every((place) => place.distanceMeters > 0));
});

test("returned POIs are filed under their own cells, not the query cell", async (t) => {
  const store = await db(t);
  if (!store) return;
  const google = new MockProvider("google", [TARGET, MARKET]);
  await findNearby(store, [google], { ...ORIGIN, limit: 5 });

  const rows = await store`SELECT normalized_name, h3_r8, h3_r9, h3_r10 FROM place
    WHERE latitude BETWEEN -0.5 AND 0.5`;
  assert.equal(rows.length, 2);
  const market = rows.find((row) => row.normalized_name === "test market");
  assert.equal(market?.h3_r9, lookupCell(MARKET.latitude, MARKET.longitude));
  assert.equal(market?.h3_r10, toCellHierarchy(MARKET.latitude, MARKET.longitude).h3R10);
  assert.notEqual(market?.h3_r9, lookupCell(ORIGIN.latitude, ORIGIN.longitude));
  assert.notEqual(market?.h3_r8, TEST_CELLS[0]);
});

test("a warm cell is served from Postgres with no provider request", async (t) => {
  const store = await db(t);
  if (!store) return;
  const google = new MockProvider("google", [TARGET, MARKET]);
  await findNearby(store, [google], { ...ORIGIN, limit: 5 });

  const second = await findNearby(store, [google], { ...ORIGIN, limit: 5 });
  assert.equal(google.calls, 1);
  assert.equal(second.telemetry.providerCalled, false);
  assert.equal(second.telemetry.coverageState, "fresh");
  assert.ok(second.places.length >= 1);
});

test("stale coverage is refreshed, fresh coverage is not", async (t) => {
  const store = await db(t);
  if (!store) return;
  const google = new MockProvider("google", [TARGET, MARKET]);
  await findNearby(store, [google], { ...ORIGIN, limit: 5 });

  await store`UPDATE cell_coverage SET expires_at = now() - interval '1 day'`;
  const refreshed = await findNearby(store, [google], { ...ORIGIN, limit: 5 });
  assert.equal(google.calls, 2);
  assert.equal(refreshed.telemetry.coverageState, "stale");
  assert.equal(refreshed.telemetry.providerCalled, true);
});

test("an empty cell is cached negatively and not re-purchased", async (t) => {
  const store = await db(t);
  if (!store) return;
  const google = new MockProvider("google", []);

  const first = await findNearby(store, [google], { ...ORIGIN, limit: 5 });
  assert.equal(first.places.length, 0);
  const spent = google.calls;
  const [coverage] = await store`SELECT coverage_status, expires_at, result_count
    FROM cell_coverage WHERE h3_index = ${TEST_CELLS[0]!}`;
  assert.equal(coverage?.coverage_status, "empty");
  assert.equal(coverage?.result_count, 0);

  const second = await findNearby(store, [google], { ...ORIGIN, limit: 5 });
  assert.equal(google.calls, spent);
  assert.equal(second.telemetry.coverageState, "empty");
  assert.equal(second.telemetry.providerCalled, false);
});

test("concurrent cold lookups coalesce into one provider request", async (t) => {
  const store = await db(t);
  if (!store) return;
  const google = new MockProvider("google", [TARGET, MARKET]);

  const results = await Promise.all(
    Array.from({ length: 8 }, () => findNearby(store, [google], { ...ORIGIN, limit: 5 })),
  );
  assert.equal(google.calls, 1);
  assert.equal(results.filter((r) => r.telemetry.providerRequests > 0).length, 1);
});

test("the same provider place is one row however often it is seen", async (t) => {
  const store = await db(t);
  if (!store) return;
  const google = new MockProvider("google", [TARGET]);
  await indexPlaces(store, google, [TARGET, TARGET]);
  await indexPlaces(store, google, [{ ...TARGET, name: "Target Store #77" }]);

  const rows = await store`SELECT id FROM place WHERE latitude BETWEEN -0.5 AND 0.5`;
  const sources = await store`SELECT place_id FROM place_source
    WHERE provider = 'google' AND provider_place_id = ${TARGET.providerPlaceId}`;
  assert.equal(rows.length, 1);
  assert.equal(sources.length, 1);
});

test("two differently shaped searches reuse the same place row", async (t) => {
  const store = await db(t);
  if (!store) return;
  const google = new MockProvider("google", [TARGET, MARKET]);

  const brandSearch = await findNearby(store, [google], {
    ...ORIGIN,
    query: "nearest target",
    limit: 5,
  });
  const typeSearch = await findNearby(store, [google], {
    ...ORIGIN,
    entityTypes: ["retail_store"],
    limit: 5,
  });

  assert.equal(brandSearch.telemetry.queryType, "brand");
  assert.equal(typeSearch.telemetry.queryType, "entity_types");
  assert.ok(brandSearch.places[0]);
  assert.equal(brandSearch.places[0]?.id, typeSearch.places[0]?.id);
  // Coverage is per query family, so the second shape is its own fact.
  const families = await store`SELECT DISTINCT query_family FROM cell_coverage
    WHERE h3_index = ${TEST_CELLS[0]!}`;
  assert.equal(families.length, 2);
});

test("Mapbox warms the same tables when Google finds nothing", async (t) => {
  const store = await db(t);
  if (!store) return;
  const google = new MockProvider("google", []);
  const mapbox = new MockProvider("mapbox", [MARKET]);

  const result = await findNearby(store, [google, mapbox], { ...ORIGIN, limit: 5 });
  assert.equal(google.calls, 1);
  assert.equal(mapbox.calls, 1);
  assert.equal(result.places.length, 1);
  assert.deepEqual(result.places[0]?.sources, [
    { provider: "mapbox", providerPlaceId: MARKET.providerPlaceId },
  ]);
  assert.deepEqual(result.places[0]?.attribution, []);
});

test("a row whose cached fields have expired is not served", async (t) => {
  const store = await db(t);
  if (!store) return;
  const google = new MockProvider("google", [TARGET, MARKET]);
  const warm = await findNearby(store, [google], { ...ORIGIN, limit: 5 });
  assert.ok(warm.places.length >= 1);

  // Age the cached display fields past their TTL but leave coverage fresh —
  // the orphan case, where a place stopped being returned and so stopped
  // being refreshed. Google lets us keep the id, not the name, this long.
  await store`
    UPDATE place SET fields_expire_at = now() - interval '1 day'
    WHERE latitude BETWEEN -0.5 AND 0.5 AND longitude BETWEEN -0.5 AND 0.5
  `;

  const after = await findNearby(store, [google], { ...ORIGIN, limit: 5 });
  assert.equal(after.places.length, 0, "expired fields must not be served");

  // The id survives; only the perishable fields are withheld.
  const [row] = await store`
    SELECT count(*)::int AS n FROM place_source WHERE provider = 'google'
      AND provider_place_id = ${TARGET.providerPlaceId}
  `;
  assert.equal(row?.n, 1);
});
