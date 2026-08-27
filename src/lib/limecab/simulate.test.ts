import test from "node:test";
import assert from "node:assert/strict";

import {
  dueSimulatedStatus,
  simulatedApproachStart,
  SIM_PHASE_MS,
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
