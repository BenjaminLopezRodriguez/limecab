import test from "node:test";
import assert from "node:assert/strict";

import type { EntityType } from "../contract.ts";
import { distanceMeters, lookupCell } from "../h3/cells.ts";
import { rankPlaces, type Candidate, type Criteria } from "./find-nearby.ts";

const ORIGIN = { latitude: 34.0806, longitude: -118.0728 };

function candidate(input: {
  name: string;
  brandKey?: string | null;
  entityType?: EntityType;
  latitude: number;
  longitude: number;
  freshnessMs?: number;
}): Candidate {
  return {
    id: input.name,
    canonicalName: input.name,
    shortName: input.name,
    normalizedName: input.name.toLowerCase(),
    brandKey: input.brandKey ?? null,
    latitude: input.latitude,
    longitude: input.longitude,
    entityType: input.entityType ?? "generic_place",
    entitySubtype: null,
    distanceMeters: 0,
    h3R9: lookupCell(input.latitude, input.longitude),
    h3R10: lookupCell(input.latitude, input.longitude),
    sources: [{ provider: "google", providerPlaceId: input.name }],
    attribution: ["google"],
    freshnessMs: input.freshnessMs ?? 0,
  };
}

const NO_CRITERIA: Criteria = { brandKey: null, entityTypes: [], normalizedQuery: "" };

/** Walk the origin's ring looking for a point in (or out of) its own cell. */
function findPoint(
  sameCell: boolean,
  order: "nearest" | "farthest",
): { latitude: number; longitude: number } {
  const originCell = lookupCell(ORIGIN.latitude, ORIGIN.longitude);
  const steps = [...Array(58).keys()].map((i) => 20 + i * 10);
  if (order === "farthest") steps.reverse();
  for (const metres of steps) {
    for (const bearing of [0, 90, 180, 270]) {
      const dLat = (metres / 111_320) * Math.cos((bearing * Math.PI) / 180);
      const dLng =
        (metres / (111_320 * Math.cos((ORIGIN.latitude * Math.PI) / 180))) *
        Math.sin((bearing * Math.PI) / 180);
      const point = {
        latitude: ORIGIN.latitude + dLat,
        longitude: ORIGIN.longitude + dLng,
      };
      if ((lookupCell(point.latitude, point.longitude) === originCell) === sameCell) {
        return point;
      }
    }
  }
  throw new Error("no point found");
}

test("true distance outranks cell adjacency", () => {
  const near = findPoint(false, "nearest"); // a neighbouring cell, but closer
  const far = findPoint(true, "farthest"); // the origin's own cell, but farther
  const nearMeters = distanceMeters(
    ORIGIN.latitude, ORIGIN.longitude, near.latitude, near.longitude,
  );
  const farMeters = distanceMeters(
    ORIGIN.latitude, ORIGIN.longitude, far.latitude, far.longitude,
  );
  // The premise: the closer place is NOT in the origin cell.
  assert.notEqual(
    lookupCell(near.latitude, near.longitude),
    lookupCell(ORIGIN.latitude, ORIGIN.longitude),
  );
  assert.ok(nearMeters < farMeters, `${nearMeters} !< ${farMeters}`);

  const ranked = rankPlaces(
    [candidate({ name: "far", ...far }), candidate({ name: "near", ...near })],
    ORIGIN.latitude,
    ORIGIN.longitude,
    NO_CRITERIA,
  );
  assert.equal(ranked[0]?.id, "near");
  assert.ok(ranked[0]!.distanceMeters < ranked[1]!.distanceMeters);
});

test("exact brand match beats a nearer place of the wrong brand", () => {
  const ranked = rankPlaces(
    [
      candidate({ name: "Bodega", latitude: ORIGIN.latitude + 0.0002, longitude: ORIGIN.longitude }),
      candidate({
        name: "Target",
        brandKey: "target",
        latitude: ORIGIN.latitude + 0.02,
        longitude: ORIGIN.longitude,
      }),
    ],
    ORIGIN.latitude,
    ORIGIN.longitude,
    { brandKey: "target", entityTypes: [], normalizedQuery: "target" },
  );
  assert.equal(ranked[0]?.brandKey, "target");
});

test("entity-type relevance beats distance, distance beats freshness", () => {
  const ranked = rankPlaces(
    [
      candidate({ name: "Near Bar", entityType: "entertainment", latitude: ORIGIN.latitude + 0.0002, longitude: ORIGIN.longitude }),
      candidate({ name: "Far Cafe", entityType: "cafe", latitude: ORIGIN.latitude + 0.004, longitude: ORIGIN.longitude }),
      candidate({ name: "Mid Cafe", entityType: "cafe", latitude: ORIGIN.latitude + 0.002, longitude: ORIGIN.longitude, freshnessMs: 1 }),
    ],
    ORIGIN.latitude,
    ORIGIN.longitude,
    { brandKey: null, entityTypes: ["cafe"], normalizedQuery: "" },
  );
  assert.deepEqual(ranked.map((p) => p.id), ["Mid Cafe", "Far Cafe", "Near Bar"]);
});

test("maxDistanceMeters drops candidates the disk happened to touch", () => {
  const ranked = rankPlaces(
    [
      candidate({ name: "close", latitude: ORIGIN.latitude + 0.0005, longitude: ORIGIN.longitude }),
      candidate({ name: "distant", latitude: ORIGIN.latitude + 0.02, longitude: ORIGIN.longitude }),
    ],
    ORIGIN.latitude,
    ORIGIN.longitude,
    NO_CRITERIA,
    300,
  );
  assert.deepEqual(ranked.map((p) => p.id), ["close"]);
});
