import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DRIVER_APP_STATES,
  currentJob,
  driverAppQuestion,
  driverJobKind,
  driverSceneForTripStatus,
  driverSceneFromInbox,
  freightMapScene,
  freightSceneForLoadStatus,
  isDriving,
  rankLiveJobs,
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
  "released",
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
      } else if (
        event === "released" &&
        (from === "to_pickup" || from === "at_pickup")
      ) {
        assert.equal(next, "online", `${from} + ${event}`);
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
    for (const kind of ["ride", "courier", "shop", "help"] as const) {
      const { question, action, exit } = driverAppQuestion(state, kind);
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

test("driverSceneFromInbox matches duty and active trip", () => {
  assert.equal(
    driverSceneFromInbox({ driver: { available: false }, active: [] }),
    "offline",
  );
  assert.equal(
    driverSceneFromInbox({ driver: { available: true }, active: [] }),
    "online",
  );
  assert.equal(
    driverSceneFromInbox({
      driver: { available: false },
      active: [{ status: "matched" }],
    }),
    "to_pickup",
  );
  assert.equal(
    driverSceneFromInbox({
      driver: { available: true },
      active: [
        { status: "matched", requestedAt: "2026-01-02" },
        { status: "in_progress", requestedAt: "2026-01-01" },
      ],
    }),
    "on_trip",
  );
});

test("rankLiveJobs keeps the current leg in front of queued accepts", () => {
  const ranked = rankLiveJobs([
    { id: "b", status: "matched", requestedAt: "2026-01-02" },
    { id: "a", status: "matched", requestedAt: "2026-01-01" },
    { id: "c", status: "in_progress", requestedAt: "2026-01-03" },
  ]);
  assert.deepEqual(
    ranked.map((job) => job.id),
    ["c", "a", "b"],
  );
  assert.equal(currentJob(ranked)?.id, "c");
});

test("accepting while already on a job does not leave that job", () => {
  assert.equal(reduceDriverAppState("to_pickup", "accepted"), "to_pickup");
  assert.equal(reduceDriverAppState("on_trip", "accepted"), "on_trip");
});

test("releasing a job before start returns the driver to the hunt", () => {
  assert.equal(reduceDriverAppState("to_pickup", "released"), "online");
  assert.equal(reduceDriverAppState("at_pickup", "released"), "online");
  assert.equal(reduceDriverAppState("on_trip", "released"), "on_trip");
  assert.equal(reduceDriverAppState("online", "released"), "online");
});

test("a courier trip carrying a list is a Shop job", () => {
  assert.equal(driverJobKind({ productId: "lime" }), "ride");
  assert.equal(driverJobKind({ productId: "courier-small" }), "courier");
  assert.equal(
    driverJobKind({ productId: "courier-small", itemList: "[]" }),
    "courier",
  );
  assert.equal(
    driverJobKind({
      productId: "courier-small",
      itemList: '[{"label":"Milk"}]',
    }),
    "shop",
  );
  assert.equal(driverJobKind(null), "ride");
});

test("Shop asks for the list at the store, never for a pickup code", () => {
  const shop = driverAppQuestion("at_pickup", "shop");
  assert.match(shop.question, /list/i);
  assert.equal(shop.action, "Got the list");
  assert.equal(driverAppQuestion("at_pickup", "courier").action, "Scan pickup");
});

test("a Help product is a visit, whatever else is on the row", () => {
  assert.equal(driverJobKind({ productId: "lime-help" }), "help");
  assert.equal(driverJobKind({ productId: "lime-care" }), "help");
});

test("a visit arrives, starts and completes — it is never a pickup", () => {
  assert.equal(driverAppQuestion("at_pickup", "help").action, "Start visit");
  assert.equal(driverAppQuestion("on_trip", "help").action, "Complete visit");
  assert.match(driverAppQuestion("to_pickup", "help").question, /house/i);
});

test("every freight load status a driver can be assigned to has a scene", () => {
  const onTheRoad = [
    "DRIVER_ASSIGNED",
    "EN_ROUTE_TO_PICKUP",
    "AT_PICKUP",
    "LOADING",
    "IN_TRANSIT",
    "AT_DELIVERY",
    "UNLOADING",
    "DELIVERED",
    "POD_PENDING",
    "EXCEPTION",
  ];
  for (const status of onTheRoad) {
    const scene = freightSceneForLoadStatus(status);
    assert.ok(scene, `${status} has no scene`);
    // Every one of them is a driving scene: duty cannot be dropped under load.
    assert.ok(isDriving(scene), `${status} mapped to ${scene}`);
  }
});

test("a load nobody is driving yet, or is finished with, has no scene", () => {
  for (const status of [
    "DRAFT",
    "QUOTE_PENDING",
    "QUOTED",
    "AVAILABLE",
    "BOOKED",
    "COMPLETED",
    "CANCELED",
    "REJECTED",
  ]) {
    assert.equal(freightSceneForLoadStatus(status), null, status);
  }
});

test("the freight ladder runs pickup, then loading, then the road", () => {
  assert.equal(freightSceneForLoadStatus("EN_ROUTE_TO_PICKUP"), "to_pickup");
  assert.equal(freightSceneForLoadStatus("LOADING"), "at_pickup");
  assert.equal(freightSceneForLoadStatus("IN_TRANSIT"), "on_trip");
  // Freight never asks a rider question, on any scene.
  assert.match(driverAppQuestion("at_pickup", "freight").question, /loaded/i);
  assert.doesNotMatch(
    driverAppQuestion("to_pickup", "freight").question,
    /rider|package/i,
  );
});

test("the lane is only the road itself", () => {
  // Both ends of the load are local operations, whatever the fix says.
  assert.equal(freightMapScene("EN_ROUTE_TO_PICKUP", "far"), "to_pickup");
  assert.equal(freightMapScene("LOADING", "arrived"), "to_pickup");
  assert.equal(freightMapScene("IN_TRANSIT", "far"), "linehaul");
  assert.equal(freightMapScene("IN_TRANSIT", "near"), "near_delivery");
  assert.equal(freightMapScene("IN_TRANSIT", "arrived"), "near_delivery");
  // The server saying the truck is at the receiver outranks the fix.
  assert.equal(freightMapScene("AT_DELIVERY", "far"), "near_delivery");
  assert.equal(freightMapScene("UNLOADING", null), "near_delivery");
});

test("an unknown proximity keeps the corridor rather than guessing arrival", () => {
  assert.equal(freightMapScene("IN_TRANSIT", null), "linehaul");
});

test("a load nobody is driving has no map scene", () => {
  assert.equal(freightMapScene("AVAILABLE", "far"), null);
  assert.equal(freightMapScene("CANCELLED", null), null);
});
