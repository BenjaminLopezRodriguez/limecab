import assert from "node:assert/strict";
import { test } from "node:test";

import { nearbyRestStops, restStopsFromFeatures } from "./rest-stops.ts";

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

const ORIGIN = { latitude: DOWNTOWN.latitude, longitude: DOWNTOWN.longitude };

const FIXTURE = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-118.27, 34.08] },
      properties: {
        name: "Mid coffee",
        full_address: "200 Mid St, Los Angeles, CA",
        address: "200 Mid St",
        place_formatted: "Los Angeles, CA",
        poi_category_ids: ["coffee"],
        mapbox_id: "mid",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-118.256, 34.051] },
      properties: {
        name: "Nearby coffee",
        full_address: "100 Near St, Los Angeles, CA",
        address: "100 Near St",
        place_formatted: "Los Angeles, CA",
        poi_category_ids: ["coffee"],
        mapbox_id: "near",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-119.5, 35.2] },
      properties: {
        name: "Far rest area",
        full_address: "I-5 Rest Area",
        address: "I-5",
        place_formatted: "CA",
        poi_category_ids: ["rest_area"],
        mapbox_id: "far",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-118.256, 34.051] },
      properties: {
        name: "Nearby coffee duplicate id",
        full_address: "100 Near St, Los Angeles, CA",
        poi_category_ids: ["coffee"],
        mapbox_id: "near",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-118.25604, 34.05104] },
      properties: {
        name: "Nearby coffee rounded coords",
        full_address: "102 Near St, Los Angeles, CA",
        poi_category_ids: ["coffee"],
        mapbox_id: "near-rounded",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-118.26, 34.055] },
      properties: {},
    },
    {
      type: "Feature",
      properties: {
        name: "No geometry",
        mapbox_id: "ghost",
        poi_category_ids: ["coffee"],
      },
    },
  ],
};

test("restStopsFromFeatures sorts by distance and skips empties", () => {
  const stops = restStopsFromFeatures(FIXTURE, ORIGIN, 8);
  assert.deepEqual(
    stops.map((stop) => stop.shortName),
    ["Nearby coffee", "Mid coffee", "Far rest area"],
  );
  assert.equal(stops[0]?.category, "coffee");
  assert.equal(stops[2]?.category, "rest_area");
  assert.equal(typeof stops[0]?.distanceMeters, "number");
  assert.ok((stops[0]?.distanceMeters ?? Infinity) < (stops[1]?.distanceMeters ?? 0));
});

test("restStopsFromFeatures dedupes by mapbox_id and rounded coords", () => {
  const stops = restStopsFromFeatures(FIXTURE, ORIGIN, 8);
  assert.equal(stops.filter((stop) => stop.shortName?.startsWith("Nearby")).length, 1);
});

test("restStopsFromFeatures respects the cap", () => {
  const stops = restStopsFromFeatures(FIXTURE, ORIGIN, 1);
  assert.equal(stops.length, 1);
  assert.equal(stops[0]?.shortName, "Nearby coffee");
});

test("restStopsFromFeatures interleaves categories inside the cap", () => {
  const stops = restStopsFromFeatures(FIXTURE, ORIGIN, 2);
  assert.deepEqual(
    stops.map((stop) => stop.shortName),
    ["Nearby coffee", "Far rest area"],
  );
});
