import test from "node:test";
import assert from "node:assert/strict";

import { milesToMeters } from "./economics.ts";
import { deterministicPricingEngine } from "./pricing.ts";

test("mock-v1 returns integer minor units + USD + simulated label", () => {
  const q = deterministicPricingEngine.quote({
    distanceMeters: milesToMeters(100),
    equipmentType: "DRY_VAN",
    weightLb: 20_000,
    pickupAt: new Date("2026-09-01T14:00:00Z"),
  });
  assert.equal(Number.isInteger(q.carrierRateMinor), true);
  assert.equal(Number.isInteger(q.shipperAmountMinor), true);
  assert.equal(q.currency, "USD");
  assert.equal(q.pricingVersion, "mock-v1");
  assert.equal(q.simulated, true);
  assert.ok(q.shipperAmountMinor > q.carrierRateMinor);
});

test("Ontario→Phoenix ~795mi lands near ~$1840 carrier", () => {
  const q = deterministicPricingEngine.quote({
    distanceMeters: Math.round(milesToMeters(795)),
    equipmentType: "DRY_VAN",
    weightLb: 34_000,
    pickupAt: new Date("2026-09-01T14:00:00Z"),
  });
  // Band: $1700–$2000 carrier (170000–200000 cents)
  assert.ok(
    q.carrierRateMinor >= 170_000 && q.carrierRateMinor <= 200_000,
    `carrierRateMinor=${q.carrierRateMinor}`,
  );
  // Expect near 184000
  assert.ok(
    Math.abs(q.carrierRateMinor - 184_000) < 5_000,
    `expected ~184000, got ${q.carrierRateMinor}`,
  );
  assert.ok(q.shipperAmountMinor > q.carrierRateMinor);
});

test("same inputs → same quote (deterministic)", () => {
  const input = {
    distanceMeters: 1_000_000,
    equipmentType: "REEFER" as const,
    weightLb: 42_000,
    pickupAt: new Date("2026-09-01T08:00:00Z"),
  };
  const a = deterministicPricingEngine.quote(input);
  const b = deterministicPricingEngine.quote(input);
  assert.deepEqual(a, b);
});
