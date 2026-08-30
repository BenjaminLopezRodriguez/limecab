import test from "node:test";
import assert from "node:assert/strict";

import {
  brandKeyFor,
  categoryAlias,
  entityTypeFor,
  normalizePlace,
  normalizeText,
  readQuery,
  stripLocationTail,
} from "./normalize.ts";

test("location tails and store numbers are not part of the name", () => {
  assert.equal(stripLocationTail("Target - Rosemead"), "Target");
  assert.equal(stripLocationTail("Target Store #1234"), "Target");
  assert.equal(stripLocationTail("Walmart Supercenter (El Monte)"), "Walmart Supercenter");
  assert.equal(stripLocationTail("Starbucks"), "Starbucks");
});

test("normalizeText keeps the punctuation brands are spelled with", () => {
  assert.equal(normalizeText("  7-Eleven "), "7-eleven");
  assert.equal(normalizeText("McDonald's"), "mcdonald's");
  assert.equal(normalizeText("Café Céleste"), "cafe celeste");
});

test("brand keys come from the alias table, longest prefix first", () => {
  assert.equal(brandKeyFor("Target - Rosemead"), "target");
  assert.equal(brandKeyFor("711"), "7-eleven");
  assert.equal(brandKeyFor("7-Eleven"), "7-eleven");
  assert.equal(brandKeyFor("starbucks coffee"), "starbucks");
  assert.equal(brandKeyFor("Trader Joe's"), "trader joe's");
  assert.equal(brandKeyFor("Ana's Taqueria"), null);
});

test("category aliases map human words to Lime entity types", () => {
  assert.equal(categoryAlias("coffee"), "cafe");
  assert.equal(categoryAlias("gas"), "gas_station");
  assert.equal(categoryAlias("grocery"), "grocery_store");
  assert.equal(categoryAlias("grocery store"), "grocery_store");
  assert.equal(categoryAlias("nonsense"), null);
});

test("provider types map to Lime types and are preserved raw", () => {
  assert.equal(entityTypeFor(["supermarket", "store"]), "grocery_store");
  assert.equal(entityTypeFor(["coffee_shop"]), "cafe");
  assert.equal(entityTypeFor(["point_of_interest", "gas_station"]), "gas_station");
  assert.equal(entityTypeFor(["nothing_we_know"]), "generic_place");
});

test("normalizePlace produces the canonical/normalized/brand triple", () => {
  const target = normalizePlace({
    name: "Target Store #1234",
    rawTypes: ["department_store", "store"],
  });
  assert.equal(target.canonicalName, "Target");
  assert.equal(target.normalizedName, "target");
  assert.equal(target.brandKey, "target");
  assert.equal(target.entityType, "retail_store");
  assert.equal(target.entitySubtype, "department_store");

  const seven = normalizePlace({ name: "7-Eleven", rawTypes: ["convenience_store"] });
  assert.equal(seven.canonicalName, "7-Eleven");
  assert.equal(seven.brandKey, "7-eleven");
  assert.equal(seven.entityType, "convenience_store");

  const local = normalizePlace({ name: "Ana's Taqueria - Rosemead", rawTypes: ["restaurant"] });
  assert.equal(local.canonicalName, "Ana's Taqueria");
  assert.equal(local.brandKey, null);
  assert.equal(local.entityType, "restaurant");
});

test("a free-text query yields a brand and categories, no model call", () => {
  const nearestTarget = readQuery("nearest Target");
  assert.equal(nearestTarget.brandKey, "target");

  const coffee = readQuery("starbucks coffee");
  assert.equal(coffee.brandKey, "starbucks");
  assert.ok(coffee.entityTypes.includes("cafe"));

  const gas = readQuery("cheapest gas");
  assert.equal(gas.brandKey, null);
  assert.deepEqual(gas.entityTypes, ["gas_station"]);
});
