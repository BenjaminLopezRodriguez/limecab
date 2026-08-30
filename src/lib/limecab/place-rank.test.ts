import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePlaceIntent } from "./place-intent.ts";
import {
  addressHasStreet,
  rankPlaceCandidates,
  suggestionsFromRanked,
  type PlaceCandidate,
} from "./place-rank.ts";

const DOWNTOWN = { latitude: 34.0505, longitude: -118.2551 };

const lasTunas: PlaceCandidate = {
  name: "McDonald's",
  address: "5601 Las Tunas Dr, Temple City, CA",
  latitude: 34.106,
  longitude: -118.055,
  source: "mapbox",
};

const downtownMcdonalds: PlaceCandidate = {
  name: "McDonald's",
  address: "505 W 6th St, Los Angeles, CA",
  latitude: 34.048,
  longitude: -118.256,
  source: "google",
};

const closeSeven: PlaceCandidate = {
  name: "7-Eleven",
  address: "400 S Grand Ave, Los Angeles, CA",
  latitude: 34.0512,
  longitude: -118.2548,
  source: "mapbox",
};

const farSeven: PlaceCandidate = {
  name: "7-Eleven",
  address: "1200 N Alameda St, Los Angeles, CA",
  latitude: 34.065,
  longitude: -118.236,
  source: "google",
};

const homeDepotByChinese: PlaceCandidate = {
  name: "The Home Depot",
  address: "4141 Eagle Rock Blvd, Los Angeles, CA",
  latitude: 34.12,
  longitude: -118.22,
  source: "mapbox",
};

const homeDepotAlone: PlaceCandidate = {
  name: "The Home Depot",
  address: "700 N San Fernando Rd, Los Angeles, CA",
  latitude: 34.08,
  longitude: -118.24,
  source: "google",
};

const chinese: PlaceCandidate = {
  name: "Lucky Chinese Restaurant",
  address: "4160 Eagle Rock Blvd, Los Angeles, CA",
  latitude: 34.1203,
  longitude: -118.2202,
  source: "mapbox",
};

test("Las Tunas beats a downtown McDonald's when the query names the street", () => {
  const intent = parsePlaceIntent("McDonalds the one on Las Tunas");
  const ranked = rankPlaceCandidates(
    [downtownMcdonalds, lasTunas],
    intent,
    DOWNTOWN,
  );
  assert.equal(ranked[0]?.address.includes("Las Tunas"), true);
  assert.equal(ranked.every((row) => /mcdonald/i.test(row.name)), true);
});

test("closest 711 prefers the nearer store", () => {
  const intent = parsePlaceIntent("Closest 711");
  const ranked = rankPlaceCandidates([farSeven, closeSeven], intent, DOWNTOWN);
  assert.equal(ranked[0]?.address.includes("Grand"), true);
});

test("Home Depot next to a chinese place ranks the adjacent store first", () => {
  const intent = parsePlaceIntent(
    "That Home Depot next to that chinese place nearby",
  );
  const ranked = rankPlaceCandidates(
    [homeDepotAlone, homeDepotByChinese],
    intent,
    DOWNTOWN,
    [chinese],
  );
  assert.equal(ranked[0]?.address.includes("Eagle Rock"), true);
});

test("addressHasStreet ignores Dr/Ave suffixes", () => {
  assert.equal(addressHasStreet(lasTunas, "Las Tunas"), true);
  assert.equal(addressHasStreet(downtownMcdonalds, "Las Tunas"), false);
});

test("ranked rows stay LocationSuggestion-shaped", () => {
  const intent = parsePlaceIntent("Closest 711");
  const suggestions = suggestionsFromRanked(
    rankPlaceCandidates([closeSeven], intent, DOWNTOWN),
  );
  assert.equal(suggestions[0]?.address, "7-Eleven");
  assert.ok(suggestions[0]?.id.startsWith("mb:"));
  assert.match(suggestions[0]?.context ?? "", /Grand/);
});
