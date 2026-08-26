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

/** status -> the one action a driver may take there. */
const DRIVER_PATH: [TripStatus, DriverAction][] = [
  ["requested", "accept"],
  ["matched", "arrive"],
  ["arriving", "start"],
  ["in_progress", "complete"],
];

test("driverMay rejects out-of-order actions", () => {
  const actions = Object.keys(DRIVER_ACTION_TARGET) as DriverAction[];
  for (const [status, allowed] of DRIVER_PATH) {
    for (const action of actions) {
      assert.equal(
        driverMay(status, action),
        action === allowed,
        `${status} + ${action}`,
      );
    }
  }
  // Terminal statuses permit nothing at all.
  for (const status of ["complete", "cancelled"] as TripStatus[]) {
    for (const action of actions) {
      assert.equal(driverMay(status, action), false, `${status} + ${action}`);
    }
  }
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
