import assert from "node:assert/strict";
import { test } from "node:test";

import {
  expandPoi,
  needsModelParse,
  parsePlaceIntent,
  vendorQueryFor,
} from "./place-intent.ts";

test("McDonalds the one on Las Tunas keeps the street", () => {
  const intent = parsePlaceIntent("McDonalds the one on Las Tunas");
  assert.equal(intent.poi, "McDonald's");
  assert.equal(intent.street, "Las Tunas");
  assert.equal(intent.closest, false);
  assert.equal(intent.nearby, false);
  assert.equal(vendorQueryFor(intent, ""), "McDonald's Las Tunas");
});

test("Closest 711 becomes the nearest 7-Eleven", () => {
  const intent = parsePlaceIntent("Closest 711");
  assert.equal(intent.poi, "7-Eleven");
  assert.equal(intent.closest, true);
  assert.equal(intent.nearby, false);
  assert.equal(vendorQueryFor(intent, ""), "7-Eleven");
});

test("Home Depot next to a chinese place nearby", () => {
  const intent = parsePlaceIntent(
    "That Home Depot next to that chinese place nearby",
  );
  assert.equal(intent.poi, "Home Depot");
  assert.equal(intent.landmark, "Chinese restaurant");
  assert.equal(intent.nearby, true);
  assert.equal(intent.closest, false);
});

test("expandPoi maps shorthand even after a model parse", () => {
  assert.equal(expandPoi("711"), "7-Eleven");
  assert.equal(expandPoi("mcdonalds"), "McDonald's");
  assert.equal(expandPoi("In N Out"), "In-N-Out");
});

test("a short brand name does not need the model", () => {
  const intent = parsePlaceIntent("Starbucks");
  assert.equal(needsModelParse("Starbucks", intent), false);
});

test("street and closest queries ask the model when a key exists", () => {
  assert.equal(
    needsModelParse(
      "McDonalds the one on Las Tunas",
      parsePlaceIntent("McDonalds the one on Las Tunas"),
    ),
    true,
  );
  assert.equal(
    needsModelParse("Closest 711", parsePlaceIntent("Closest 711")),
    true,
  );
});
