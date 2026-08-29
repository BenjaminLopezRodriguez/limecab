import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canTransition,
  driverMay,
  DRIVER_ACTION_TARGET,
  TRIP_STATUSES,
  type DriverAction,
  type TripStatus,
} from "./state.ts";

/** status -> the advance a driver may take there. Cancel is extra on matched/arriving. */
const DRIVER_PATH: [TripStatus, DriverAction][] = [
  ["requested", "accept"],
  ["matched", "arrive"],
  ["arriving", "start"],
  ["in_progress", "complete"],
];

const CANCEL_FROM: readonly TripStatus[] = ["matched", "arriving"];

function allowedOn(status: TripStatus, action: DriverAction): boolean {
  const step = DRIVER_PATH.find(([from]) => from === status);
  if (step?.[1] === action) return true;
  return action === "cancel" && CANCEL_FROM.includes(status);
}

test("driverMay rejects out-of-order actions", () => {
  const actions = Object.keys(DRIVER_ACTION_TARGET) as DriverAction[];
  for (const status of TRIP_STATUSES) {
    if (status === "complete" || status === "cancelled") {
      for (const action of actions) {
        assert.equal(driverMay(status, action), false, `${status} + ${action}`);
      }
      continue;
    }
    for (const action of actions) {
      assert.equal(
        driverMay(status, action),
        allowedOn(status, action),
        `${status} + ${action}`,
      );
    }
  }
});

test("driver cancel is legal from matched and arriving only", () => {
  assert.ok(canTransition("matched", DRIVER_ACTION_TARGET.cancel));
  assert.ok(canTransition("arriving", DRIVER_ACTION_TARGET.cancel));
  assert.equal(canTransition("in_progress", DRIVER_ACTION_TARGET.cancel), false);
});

test("driverMay rejects a made-up action", () => {
  assert.equal(driverMay("requested", "teleport"), false);
});

test("every DRIVER_ACTION_TARGET is reachable from where it is allowed", () => {
  for (const [status, action] of DRIVER_PATH) {
    assert.ok(
      canTransition(status, DRIVER_ACTION_TARGET[action]),
      `${status} -> ${DRIVER_ACTION_TARGET[action]} via ${action}`,
    );
  }
  // No target is a status the machine does not know.
  for (const target of Object.values(DRIVER_ACTION_TARGET)) {
    assert.ok(TRIP_STATUSES.includes(target), `${target} is a real status`);
  }
});

test("the driver happy path is legal and every skip is not", () => {
  const path = [
    "requested",
    "matched",
    "arriving",
    "in_progress",
    "complete",
  ] as const;

  for (let i = 0; i < path.length - 1; i++) {
    assert.ok(canTransition(path[i]!, path[i + 1]!), `${i} step`);
    // Skipping ahead by two or more is never legal.
    for (let j = i + 2; j < path.length; j++) {
      assert.equal(
        canTransition(path[i]!, path[j]!),
        false,
        `${path[i]} must not skip to ${path[j]}`,
      );
    }
    // Nor is going backwards.
    for (let j = 0; j <= i; j++) {
      assert.equal(
        canTransition(path[i + 1]!, path[j]!),
        false,
        `${path[i + 1]} must not return to ${path[j]}`,
      );
    }
  }
});
