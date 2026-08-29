import test from "node:test";
import assert from "node:assert/strict";

import {
  classifySearchQuery,
  isAddressQuery,
} from "./search-intent.ts";

test("Griffith is a ride to a place", () => {
  const classified = classifySearchQuery("Griffith");
  assert.deepEqual(classified.intents, ["ride"]);
  assert.equal(classified.placeQuery, "Griffith");
  assert.equal(classified.ambiguous, false);
});

test("send this to work is courier, destination Work", () => {
  const classified = classifySearchQuery("send this to work");
  assert.ok(classified.intents.includes("send"));
  assert.match(classified.placeQuery.toLowerCase(), /work/);
});

test("snake plant and butcher are store-style", () => {
  assert.ok(classifySearchQuery("snake plant").intents.includes("store"));
  assert.ok(classifySearchQuery("butcher").intents.includes("store"));
});

test("Traction Ave stays a flat address list", () => {
  assert.equal(isAddressQuery("Traction Ave"), true);
  const classified = classifySearchQuery("Traction Ave");
  assert.deepEqual(classified.intents, ["ride"]);
  assert.equal(classified.ambiguous, false);
});

test("empty and short queries still classify as ride", () => {
  assert.deepEqual(classifySearchQuery("").intents, ["ride"]);
  assert.deepEqual(classifySearchQuery("ab").intents, ["ride"]);
});

test("help alone is a visit, not a destination", () => {
  const classified = classifySearchQuery("help");
  assert.deepEqual(classified.intents, ["help"]);
  assert.equal(classified.placeQuery, "");
  assert.equal(classified.ambiguous, false);
});

test("help at home is a visit and help me get to LAX stays a ride", () => {
  assert.ok(classifySearchQuery("help at home").intents.includes("help"));
  assert.deepEqual(classifySearchQuery("help me get to LAX").intents, ["ride"]);
});
