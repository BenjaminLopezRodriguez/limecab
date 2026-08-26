import test from "node:test";
import assert from "node:assert/strict";

import {
  clockTime,
  distanceMiles,
  estimateFare,
  tripMinutes,
  vehicleLabel,
  type RideProduct,
} from "./domain.ts";

const product = (priceCents: number): RideProduct => ({
  id: "p",
  name: "LimeGo",
  description: "",
  seats: 4,
  etaMinutes: 4,
  priceCents,
  status: "available",
});

test("estimateFare total is the sum of its parts", () => {
  const fare = estimateFare(product(100), 4.2, 17);
  assert.equal(
    fare.totalCents,
    fare.baseCents + fare.distanceCents + fare.timeCents + fare.bookingCents,
  );
});

test("estimateFare is deterministic: quote equals receipt", () => {
  assert.deepEqual(
    estimateFare(product(140), 6.31, 22),
    estimateFare(product(140), 6.31, 22),
  );
});

test("estimateFare scales base, distance and time with the product rate", () => {
  const single = estimateFare(product(100), 5, 20);
  const double = estimateFare(product(200), 5, 20);
  assert.equal(double.baseCents, single.baseCents * 2);
  assert.equal(double.distanceCents, single.distanceCents * 2);
  assert.equal(double.timeCents, single.timeCents * 2);
  assert.ok(double.totalCents > single.totalCents);
});

test("estimateFare booking fee is flat across products and trips", () => {
  assert.equal(estimateFare(product(100), 1, 3).bookingCents, 249);
  assert.equal(estimateFare(product(320), 40, 90).bookingCents, 249);
});

test("estimateFare grows with distance and with time", () => {
  const short = estimateFare(product(100), 2, 10);
  const longer = estimateFare(product(100), 9, 10);
  const slower = estimateFare(product(100), 2, 45);
  assert.ok(longer.distanceCents > short.distanceCents);
  assert.ok(slower.timeCents > short.timeCents);
});

const sf = { address: "SF", latitude: 37.7749, longitude: -122.4194 };
const oakland = { address: "Oakland", latitude: 37.8044, longitude: -122.2712 };

test("distanceMiles returns 0 when any coordinate is missing", () => {
  assert.equal(distanceMiles({ address: "No coords" }, oakland), 0);
  assert.equal(distanceMiles(sf, { address: "No coords" }), 0);
  assert.equal(
    distanceMiles({ address: "Lat only", latitude: 37.7749 }, oakland),
    0,
  );
  assert.equal(
    distanceMiles(sf, { address: "Lon only", longitude: -122.2712 }),
    0,
  );
});

test("distanceMiles gives a plausible mileage for a known pair", () => {
  // SF -> Oakland: ~8.5 great-circle miles, x1.25 street factor.
  const miles = distanceMiles(sf, oakland);
  assert.ok(miles > 9 && miles < 13, `expected 9..13 miles, got ${miles}`);
});

test("distanceMiles is symmetric", () => {
  assert.equal(distanceMiles(sf, oakland), distanceMiles(oakland, sf));
});

test("distanceMiles is 0 for identical points", () => {
  assert.equal(distanceMiles(sf, sf), 0);
});

test("tripMinutes floors at 3", () => {
  assert.equal(tripMinutes(0), 3);
  assert.equal(tripMinutes(0.2), 3);
  assert.equal(tripMinutes(0.9), 3);
});

test("tripMinutes scales with miles above the floor", () => {
  assert.equal(tripMinutes(10), 32);
  assert.ok(tripMinutes(20) > tripMinutes(10));
});

test("clockTime advances the given minutes from the supplied now", () => {
  const now = new Date(2026, 0, 1, 10, 0, 0);
  assert.equal(clockTime(0, now), "10:00 AM");
  assert.equal(clockTime(30, now), "10:30 AM");
  assert.equal(clockTime(125, now), "12:05 PM");
});

test("clockTime crosses midnight", () => {
  assert.equal(clockTime(30, new Date(2026, 0, 1, 23, 45, 0)), "12:15 AM");
});

test("vehicleLabel formats colour, make, model and plate", () => {
  assert.equal(
    vehicleLabel({
      make: "Toyota",
      model: "Prius",
      color: "White",
      plate: "8XKC412",
    }),
    "White Toyota Prius · 8XKC412",
  );
});
