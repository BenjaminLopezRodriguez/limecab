import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DRIVER_APP_STATES,
  driverAppQuestion,
  driverSceneForTripStatus,
  isDriving,
  reduceDriverAppState,
  type DriverAppEvent,
  type DriverAppState,
} from "./driver-state.ts";

const EVENTS: DriverAppEvent[] = [
  "go_online",
  "go_offline",
  "accepted",
  "arrived",
  "started",
  "completed",
  "done",
];

/** The whole duty session, and the one event that advances each step. */
const PATH: [DriverAppState, DriverAppEvent, DriverAppState][] = [
  ["offline", "go_online", "online"],
  ["online", "accepted", "to_pickup"],
  ["to_pickup", "arrived", "at_pickup"],
  ["at_pickup", "started", "on_trip"],
  ["on_trip", "completed", "complete"],
  ["complete", "done", "online"],
];

test("the duty session runs end to end and comes back online", () => {
  let state: DriverAppState = "offline";
  for (const [from, event, to] of PATH) {
    assert.equal(state, from);
    state = reduceDriverAppState(state, event);
    assert.equal(state, to, `${from} + ${event}`);
  }
});

test("only the one legal event moves each scene", () => {
  for (const [from, allowed, to] of PATH) {
    for (const event of EVENTS) {
      const next = reduceDriverAppState(from, event);
      if (event === allowed) {
        assert.equal(next, to, `${from} + ${event}`);
      } else if (event === "go_offline" && !isDriving(from)) {
        // Dropping duty is always allowed outside a job — including from the
        // fare splash, which is not itself a job.
        assert.equal(next, "offline", `${from} + ${event}`);
      } else {
        assert.equal(next, from, `${from} + ${event} must not move`);
      }
    }
  }
});

test("duty cannot be dropped mid-job", () => {
  for (const state of DRIVER_APP_STATES) {
    if (!isDriving(state)) continue;
    assert.equal(reduceDriverAppState(state, "go_offline"), state, state);
  }
});

test("every scene owns a question and a primary action", () => {
  for (const state of DRIVER_APP_STATES) {
    for (const courier of [false, true]) {
      const { question, action, exit } = driverAppQuestion(state, courier);
      assert.ok(question.length > 0, `${state} question`);
      assert.ok(action.length > 0, `${state} action`);
      assert.ok(exit.length > 0, `${state} exit`);
    }
  }
});

test("a live trip status lands on its job scene, and nothing else does", () => {
  assert.equal(driverSceneForTripStatus("matched"), "to_pickup");
  assert.equal(driverSceneForTripStatus("arriving"), "at_pickup");
  assert.equal(driverSceneForTripStatus("in_progress"), "on_trip");
  // An unclaimed offer is an interruption, and terminal trips are not scenes.
  for (const status of ["requested", "complete", "cancelled", "nonsense"]) {
    assert.equal(driverSceneForTripStatus(status), null, status);
  }
});
