import assert from "node:assert/strict";
import { test } from "node:test";

import { nearbyRestStops } from "./rest-stops.ts";

const DOWNTOWN = {
  address: "Downtown",
  latitude: 34.0505,
  longitude: -118.2551,
};

const STOPS = [
  {
    address: "Nearby coffee",
    shortName: "Nearby",
    latitude: 34.051,
    longitude: -118.256,
  },
  {
    address: "Far rest area",
    shortName: "Far",
    latitude: 35.2,
    longitude: -119.5,
  },
  {
    address: "Mid coffee",
    shortName: "Mid",
    latitude: 34.08,
    longitude: -118.27,
  },
];

test("nearbyRestStops keeps the closest stops and drops the far one", () => {
  const nearby = nearbyRestStops(DOWNTOWN, STOPS, { limit: 8, maxMiles: 40 });
  assert.deepEqual(
    nearby.map((stop) => stop.shortName),
    ["Nearby", "Mid"],
  );
});

test("nearbyRestStops respects the cap", () => {
  const nearby = nearbyRestStops(DOWNTOWN, STOPS, { limit: 1, maxMiles: 40 });
  assert.equal(nearby.length, 1);
  assert.equal(nearby[0]?.shortName, "Nearby");
});
