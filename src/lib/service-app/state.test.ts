import test from "node:test";
import assert from "node:assert/strict";

import {
  backServiceAppState,
  reduceServiceAppState,
  serviceAppQuestion,
  type ServiceAppContext,
} from "./state.ts";

const ctx = (over: Partial<ServiceAppContext> = {}): ServiceAppContext => ({
  hasLocation: false,
  hasService: false,
  ...over,
});

test("choose_on_map from search opens the pin scene", () => {
  assert.equal(
    reduceServiceAppState("location_search", "choose_on_map", ctx()),
    "location_pin",
  );
});

test("choose_on_map from home opens the pin scene", () => {
  assert.equal(
    reduceServiceAppState("home", "choose_on_map", ctx({ pinEntry: "home" })),
    "location_pin",
  );
});

test("choose_on_map is ignored outside home and search", () => {
  assert.equal(
    reduceServiceAppState(
      "quote",
      "choose_on_map",
      ctx({ hasLocation: true, hasService: true }),
    ),
    "quote",
  );
});

test("back from the pin scene returns to search", () => {
  assert.equal(backServiceAppState("location_pin", ctx()), "location_search");
});

test("back from a home map pin returns home", () => {
  assert.equal(
    backServiceAppState("location_pin", ctx({ pinEntry: "home" })),
    "home",
  );
});

test("cancel_search from the pin scene leaves locating like search does", () => {
  assert.equal(
    reduceServiceAppState("location_pin", "cancel_search", ctx()),
    "home",
  );
  assert.equal(
    reduceServiceAppState(
      "location_pin",
      "cancel_search",
      ctx({ hasLocation: true }),
    ),
    "service_select",
  );
});

test("confirming a pin with no service goes to service_select", () => {
  assert.equal(
    reduceServiceAppState(
      "location_pin",
      "select_location",
      ctx({ hasLocation: true }),
    ),
    "service_select",
  );
});

test("location_pin asks where on the map", () => {
  const q = serviceAppQuestion("location_pin");
  assert.equal(q.question, "Where on the map?");
  assert.equal(q.action, "Place the pin");
  assert.equal(q.exit, "Back");
});

const configured = ctx({
  hasLocation: true,
  hasService: true,
  needsConfigure: true,
  needsServiceSelect: false,
});

test("a preselected service that needs options goes to configure", () => {
  assert.equal(
    reduceServiceAppState("home", "select_location", configured),
    "configure",
  );
});

test("configure_done advances to quote", () => {
  assert.equal(
    reduceServiceAppState("configure", "configure_done", configured),
    "quote",
  );
});

test("back from configure without a service list returns home", () => {
  assert.equal(backServiceAppState("configure", configured), "home");
});

test("back from configure still returns to services when that scene exists", () => {
  assert.equal(
    backServiceAppState(
      "configure",
      ctx({ hasLocation: true, hasService: true, needsConfigure: true }),
    ),
    "service_select",
  );
});

test("back from quote with configure returns to options", () => {
  assert.equal(backServiceAppState("quote", configured), "configure");
});
