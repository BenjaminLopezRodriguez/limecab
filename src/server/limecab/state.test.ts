import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canTransition,
  driverMay,
  isTerminalStatus,
  riderMay,
  TRIP_STATUSES,
  type TripStatus,
} from "./state.ts";

const HAPPY_PATH: TripStatus[] = [
  "requested",
  "matched",
  "arriving",
  "in_progress",
  "complete",
];

test("the happy path is legal end to end", () => {
  for (let i = 0; i < HAPPY_PATH.length - 1; i++) {
    assert.ok(
      canTransition(HAPPY_PATH[i]!, HAPPY_PATH[i + 1]!),
      `${HAPPY_PATH[i]} -> ${HAPPY_PATH[i + 1]} should be legal`,
    );
  }
});

test("skipping a phase is rejected", () => {
  assert.equal(canTransition("requested", "in_progress"), false);
  assert.equal(canTransition("requested", "complete"), false);
  assert.equal(canTransition("matched", "complete"), false);
});

test("terminal statuses go nowhere", () => {
  for (const to of TRIP_STATUSES) {
    assert.equal(canTransition("complete", to), false);
    assert.equal(canTransition("cancelled", to), false);
  }
  assert.ok(isTerminalStatus("complete"));
  assert.ok(isTerminalStatus("cancelled"));
  assert.equal(isTerminalStatus("arriving"), false);
});

test("going backwards is rejected", () => {
  assert.equal(canTransition("in_progress", "arriving"), false);
  assert.equal(canTransition("arriving", "matched"), false);
  assert.equal(canTransition("matched", "requested"), false);
});

test("rider may cancel only before the ride starts", () => {
  assert.ok(riderMay("requested", "cancel"));
  assert.ok(riderMay("matched", "cancel"));
  assert.ok(riderMay("arriving", "cancel"));
  assert.equal(riderMay("in_progress", "cancel"), false);
  assert.equal(riderMay("complete", "cancel"), false);
  assert.equal(riderMay("cancelled", "cancel"), false);
});

test("rider cannot drive the driver's side", () => {
  assert.equal(riderMay("requested", "accept"), false);
  assert.equal(riderMay("in_progress", "complete"), false);
});

test("driver actions are gated by phase", () => {
  assert.ok(driverMay("requested", "accept"));
  assert.equal(driverMay("matched", "accept"), false);
  assert.ok(driverMay("matched", "arrive"));
  assert.ok(driverMay("arriving", "start"));
  assert.ok(driverMay("in_progress", "complete"));
  assert.equal(driverMay("requested", "complete"), false);
  assert.equal(driverMay("complete", "complete"), false);
});
