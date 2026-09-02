import { test } from "node:test";
import assert from "node:assert/strict";

import {
  initialSurfaceManagerState,
  reduceSurfaceManager,
} from "../src/core/surface-manager.ts";
import { RIDE_ADD_ONS, RIDE_TIERS, PICKUP_SPOTS } from "../src/fixtures/rider.ts";
import { createScenario } from "../src/harness/flow-machine.ts";
import { rideSurfaces } from "../src/recipes/ride.ts";
import { SURFACES } from "../src/recipes/surfaces.ts";
import { riderHappyPath } from "../src/scenarios/rider/happy-path.ts";

test("rider fare choices match production order and deterministic values", () => {
  assert.deepEqual(
    RIDE_TIERS.map(({ title, seats, badge, fareCents }) => ({ title, seats, badge, fareCents })),
    [
      { title: "Lime", seats: 4, badge: "Fastest", fareCents: 501 },
      { title: "Wait & Save", seats: 4, badge: undefined, fareCents: 470 },
      { title: "Lime XL", seats: 6, badge: undefined, fareCents: 607 },
      { title: "Lime Comfort", seats: 4, badge: undefined, fareCents: 571 },
      { title: "Lime Pool", seats: 2, badge: "Cheapest", fareCents: 431 },
    ],
  );
});

test("upsell and pickup fixtures match the observed rider flow", () => {
  assert.deepEqual(RIDE_ADD_ONS, [
    { id: "coffee", label: "Coffee", priceCents: 500 },
    { id: "tea", label: "Tea", priceCents: 500 },
    { id: "sparkling-water", label: "Sparkling water", priceCents: 500 },
  ]);
  assert.equal(PICKUP_SPOTS[0]?.label, "Front entrance");
  assert.equal(PICKUP_SPOTS[0]?.detail, "Current location");
});

test("rider progresses from fare choice through curb choice without a second quote", () => {
  assert.deepEqual(riderHappyPath.order.slice(0, 4), ["home", "rideSelect", "confirmPickup", "matching"]);
});

test("ride extras suspend the pickup sheet and return it untouched", () => {
  const start = initialSurfaceManagerState(rideSurfaces);
  const asked = reduceSurfaceManager(start, { type: "perform", action: "offerExtras" }, rideSurfaces);
  assert.equal(asked.layout[SURFACES.primary]?.emphasis, "suspended");
  assert.equal(asked.layout[SURFACES.primary]?.presentation, "sheet");
  assert.equal(asked.layout[SURFACES.interrupt]?.emphasis, "interrupt");
  assert.equal(asked.layout[SURFACES.interrupt]?.presentation, "sheet");

  const returned = reduceSurfaceManager(asked, { type: "perform", action: "resume" }, rideSurfaces);
  assert.deepEqual(returned.layout[SURFACES.primary], start.layout[SURFACES.primary]);
  assert.equal(returned.layout[SURFACES.interrupt]?.emphasis, "hidden");

  const flow = createScenario(riderHappyPath);
  flow.jump("confirmPickup");
  const before = flow.snapshot();
  flow.openInterrupt("rideExtras");
  flow.closeInterrupt();
  assert.deepEqual(flow.snapshot(), before);
});
