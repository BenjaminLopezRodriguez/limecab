import test from "node:test";
import assert from "node:assert/strict";

import {
  dueSimulatedStatus,
  isSimulatedDriverId,
  isSyntheticDriverId,
  simulatedApproachStart,
  SIM_PHASE_MS,
  tripIsSimulated,
} from "./simulate.ts";

test("simulatedApproachStart is deterministic for a seed", () => {
  const origin = { latitude: 34.0505, longitude: -118.2551 };
  const a = simulatedApproachStart(origin, "trip-1");
  const b = simulatedApproachStart(origin, "trip-1");
  assert.equal(a.latitude, b.latitude);
  assert.equal(a.longitude, b.longitude);
  assert.notEqual(a.latitude, origin.latitude);
});

test("dueSimulatedStatus waits out the phase, then advances", () => {
  assert.equal(dueSimulatedStatus("requested", SIM_PHASE_MS.requested - 1), null);
  assert.equal(dueSimulatedStatus("requested", SIM_PHASE_MS.requested), "matched");
  assert.equal(dueSimulatedStatus("matched", SIM_PHASE_MS.matched), "arriving");
  assert.equal(
    dueSimulatedStatus("arriving", SIM_PHASE_MS.arriving),
    "in_progress",
  );
  assert.equal(
    dueSimulatedStatus("in_progress", SIM_PHASE_MS.in_progress),
    "complete",
  );
  assert.equal(dueSimulatedStatus("complete", 99_000), null);
});

/**
 * The money gate. These are the cases that decide whether a fare is payable,
 * so they are spelled out rather than folded into one loop.
 */

test("dispatch and money ask different questions of a driver id", () => {
  // Auto-advance drives its own drivers and nobody else's.
  assert.equal(isSimulatedDriverId("sim-driver-abc"), true);
  assert.equal(isSimulatedDriverId("seed-driver-abc"), false);
  assert.equal(isSimulatedDriverId("real-uuid"), false);

  // Money treats every fake driver as fake, seeded included. This is the
  // distinction that used to be missing: a seeded driver read as real.
  assert.equal(isSyntheticDriverId("sim-driver-abc"), true);
  assert.equal(isSyntheticDriverId("seed-driver-abc"), true);
  assert.equal(isSyntheticDriverId("real-uuid"), false);
  assert.equal(isSyntheticDriverId(null), false);
  assert.equal(isSyntheticDriverId(undefined), false);
});

test("a trip created while auto-advance runs is simulated whoever drives it", () => {
  // The trip is unmatched and may yet be claimed by a real driver. It is still
  // demo money, because auto-advance could equally have claimed it first.
  assert.equal(
    tripIsSimulated({ simulationEnabled: true, driverId: null }),
    true,
  );
  assert.equal(
    tripIsSimulated({ simulationEnabled: true, driverId: "real-uuid" }),
    true,
  );
});

test("a synthetic driver taints a trip even with simulation off", () => {
  // SIMULATE_DRIVERS flipped off after the trip was minted, or a seeded driver
  // signed in on a production-shaped environment.
  assert.equal(
    tripIsSimulated({ simulationEnabled: false, driverId: "sim-driver-x" }),
    true,
  );
  assert.equal(
    tripIsSimulated({ simulationEnabled: false, driverId: "seed-driver-x" }),
    true,
  );
});

test("only a real driver with simulation off is real money", () => {
  assert.equal(
    tripIsSimulated({ simulationEnabled: false, driverId: "real-uuid" }),
    false,
  );
  assert.equal(tripIsSimulated({ simulationEnabled: false }), false);
});
