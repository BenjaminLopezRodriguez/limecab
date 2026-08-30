import test from "node:test";
import assert from "node:assert/strict";

import { toCellHierarchy, coverageCell } from "../h3/cells.ts";
import { TokenBucket, hydrateKey, singleFlight } from "./hydrate.ts";

test("single-flight coalesces concurrent callers into one run", async () => {
  const map = new Map<string, Promise<number>>();
  let runs = 0;
  const run = async () => {
    runs += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return runs;
  };
  const results = await Promise.all(
    Array.from({ length: 20 }, () => singleFlight("k", map, run)),
  );
  assert.equal(runs, 1);
  assert.deepEqual(new Set(results), new Set([1]));
  assert.equal(map.size, 0);

  // The key is released afterwards, so a later caller does pay for a run.
  await singleFlight("k", map, run);
  assert.equal(runs, 2);
});

test("the single-flight key is provider, family, cell and radius", () => {
  const key = hydrateKey({
    key: { provider: "google", queryFamily: "brand:target", h3Index: "8929a1d1807ffff" },
  });
  assert.equal(key, "google|brand:target|8929a1d1807ffff|700");
});

test("the token bucket runs out and refills", () => {
  const bucket = new TokenBucket(2, 1);
  const t0 = Date.now();
  assert.equal(bucket.take(t0), true);
  assert.equal(bucket.take(t0), true);
  assert.equal(bucket.take(t0), false);
  assert.equal(bucket.take(t0 + 1000), true);
});

test("a returned POI belongs to its own cells, not the query cell", () => {
  const query = { latitude: 34.0806, longitude: -118.0728 };
  const poi = { latitude: 34.0866, longitude: -118.0668 };
  const queryCells = toCellHierarchy(query.latitude, query.longitude);
  const poiCells = toCellHierarchy(poi.latitude, poi.longitude);
  assert.notEqual(poiCells.h3R9, queryCells.h3R9);
  assert.notEqual(poiCells.h3R10, queryCells.h3R10);
  // One hydration warms a neighbourhood of places while claiming one cell.
  assert.notEqual(coverageCell(poi.latitude, poi.longitude), queryCells.h3R8);
});
