import assert from "node:assert/strict";
import { test } from "node:test";

import { toDriverCell } from "./h3.ts";
import {
  isPoolProduct,
  poolFits,
  rankOpenOffers,
  POOL_PRODUCT_ID,
} from "./pool-match.ts";

const downtown = { latitude: 34.0505, longitude: -118.2551 };
const echo = { latitude: 34.0782, longitude: -118.2606 };
const nearPickup = { latitude: 34.0535, longitude: -118.254 };
const nearDest = { latitude: 34.0805, longitude: -118.259 };
const pasadena = { latitude: 34.1459, longitude: -118.1376 };
const south = { latitude: 34.02, longitude: -118.255 };

function leg(
  productId: string,
  pickup: { latitude: number; longitude: number },
  dest: { latitude: number; longitude: number },
  extra: { arrivalMinutes?: number; status?: string } = {},
) {
  return {
    productId,
    pickupLatitude: pickup.latitude,
    pickupLongitude: pickup.longitude,
    pickupH3: toDriverCell(pickup.latitude, pickup.longitude),
    destinationLatitude: dest.latitude,
    destinationLongitude: dest.longitude,
    arrivalMinutes: extra.arrivalMinutes ?? 9,
    status: extra.status,
  };
}

const activePool = leg(POOL_PRODUCT_ID, downtown, echo, {
  status: "in_progress",
});
const nearbyPool = {
  id: "nearby",
  ...leg(POOL_PRODUCT_ID, nearPickup, nearDest, { arrivalMinutes: 12 }),
};
const farPool = {
  id: "far",
  ...leg(POOL_PRODUCT_ID, pasadena, south, { arrivalMinutes: 3 }),
};
const nearbyLime = {
  id: "lime",
  ...leg("lime", nearPickup, nearDest, { arrivalMinutes: 2 }),
};

test("lime-pool is the existing Pool product", () => {
  assert.equal(isPoolProduct("lime-pool"), true);
  assert.equal(isPoolProduct("lime"), false);
});

test("a nearby same-direction Pool request fits the live Pool trip", () => {
  assert.equal(poolFits(activePool, nearbyPool), true);
});

test("a far opposite Pool request does not fit", () => {
  assert.equal(poolFits(activePool, farPool), false);
});

test("Pool only stacks with Pool", () => {
  assert.equal(poolFits(activePool, nearbyLime), false);
  assert.equal(poolFits(leg("lime", downtown, echo), nearbyPool), false);
});

test("nearby same-direction Pool ranks ahead of a far opposite one", () => {
  const ranked = rankOpenOffers([farPool, nearbyPool], activePool);
  assert.deepEqual(
    ranked.map((trip) => trip.id),
    ["nearby", "far"],
  );
});

test("a non-Pool request does not jump the Pool stack", () => {
  const ranked = rankOpenOffers([nearbyLime, farPool, nearbyPool], activePool);
  assert.equal(ranked[0]?.id, "nearby");
  assert.ok(
    ranked.findIndex((trip) => trip.id === "nearby") <
      ranked.findIndex((trip) => trip.id === "lime"),
  );
});

test("an empty car still ranks by nearest deadhead, Pool included", () => {
  const ranked = rankOpenOffers([nearbyPool, nearbyLime, farPool], null);
  assert.deepEqual(
    ranked.map((trip) => trip.id),
    ["lime", "far", "nearby"],
  );
});

test("Wait & Save ranks behind a standard Lime request", () => {
  const waitSave = {
    id: "wait",
    ...leg("lime-wait-save", nearPickup, nearDest, { arrivalMinutes: 2 }),
  };
  const ranked = rankOpenOffers([waitSave, nearbyLime, farPool], null);
  assert.equal(ranked.at(-1)?.id, "wait");
  assert.ok(
    ranked.findIndex((trip) => trip.id === "lime") <
      ranked.findIndex((trip) => trip.id === "wait"),
  );
});
