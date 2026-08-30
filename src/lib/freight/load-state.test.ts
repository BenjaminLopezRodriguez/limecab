import test from "node:test";
import assert from "node:assert/strict";

import {
  ACTION_TARGET,
  actorMay,
  canTransition,
  isTerminalStatus,
} from "./load-state.ts";

test("happy path Ontario→Phoenix lifecycle transitions", () => {
  const path = [
    ["DRAFT", "QUOTE_PENDING"],
    ["QUOTE_PENDING", "QUOTED"],
    ["QUOTED", "AVAILABLE"],
    ["AVAILABLE", "BOOKED"],
    ["BOOKED", "DRIVER_ASSIGNED"],
    ["DRIVER_ASSIGNED", "EN_ROUTE_TO_PICKUP"],
    ["EN_ROUTE_TO_PICKUP", "AT_PICKUP"],
    ["AT_PICKUP", "LOADING"],
    ["LOADING", "IN_TRANSIT"],
    ["IN_TRANSIT", "AT_DELIVERY"],
    ["AT_DELIVERY", "UNLOADING"],
    ["UNLOADING", "DELIVERED"],
    ["DELIVERED", "POD_PENDING"],
    ["POD_PENDING", "COMPLETED"],
  ] as const;

  for (const [from, to] of path) {
    assert.equal(canTransition(from, to), true, `${from} → ${to}`);
  }
  assert.equal(isTerminalStatus("COMPLETED"), true);
});

test("invalid transitions rejected", () => {
  assert.equal(canTransition("DRAFT", "BOOKED"), false);
  assert.equal(canTransition("AVAILABLE", "IN_TRANSIT"), false);
  assert.equal(canTransition("COMPLETED", "AVAILABLE"), false);
  assert.equal(canTransition("CANCELED", "BOOKED"), false);
  assert.equal(canTransition("IN_TRANSIT", "LOADING"), false);
});

test("actorMay + ACTION_TARGET align with canTransition", () => {
  assert.equal(actorMay("carrier", "AVAILABLE", "book"), true);
  assert.equal(canTransition("AVAILABLE", ACTION_TARGET.book), true);
  assert.equal(actorMay("shipper", "AVAILABLE", "book"), false);
  assert.equal(actorMay("driver", "DRIVER_ASSIGNED", "en_route_pickup"), true);
  assert.equal(actorMay("driver", "AVAILABLE", "en_route_pickup"), false);
});
