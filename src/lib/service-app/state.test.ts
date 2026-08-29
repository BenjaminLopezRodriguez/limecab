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

test("back from configure without a service list revises to location", () => {
  assert.equal(backServiceAppState("configure", configured), "location_search");
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

/* ---- options first, place last (Shop's shop → list → drop-off) ---------- */

const optionsFirst = (over: Partial<ServiceAppContext> = {}) =>
  ctx({
    hasService: true,
    needsConfigure: true,
    needsServiceSelect: false,
    locationAfterConfigure: true,
    ...over,
  });

test("configure_done asks for the place when the place is still unknown", () => {
  assert.equal(
    reduceServiceAppState("configure", "configure_done", optionsFirst()),
    "location_search",
  );
});

test("configure_done goes to the quote once the place is known", () => {
  assert.equal(
    reduceServiceAppState(
      "configure",
      "configure_done",
      optionsFirst({ hasLocation: true }),
    ),
    "quote",
  );
});

test("choosing that last place lands on the quote, not back on configure", () => {
  assert.equal(
    reduceServiceAppState(
      "location_search",
      "select_location",
      optionsFirst({ hasLocation: true }),
    ),
    "quote",
  );
});

test("back out of the last search revises the options, never home", () => {
  assert.equal(backServiceAppState("location_search", optionsFirst()), "configure");
  assert.equal(
    reduceServiceAppState("location_search", "cancel_search", optionsFirst()),
    "configure",
  );
});

test("back out of that search revises the options even once the place is set", () => {
  assert.equal(
    backServiceAppState("location_search", optionsFirst({ hasLocation: true })),
    "configure",
  );
});

test("back from the options-first list leaves home; quote revises the place", () => {
  // The shop itself is a summary on the list ("At X · change"), so Back
  // must not loop through that search — that is how a rider gets stuck.
  assert.equal(backServiceAppState("configure", optionsFirst()), "home");
  assert.equal(
    backServiceAppState("quote", optionsFirst({ hasLocation: true })),
    "location_search",
  );
});

test("the first place still lands on configure, and back from it is home", () => {
  // Before the first place is picked the flag is off: nothing is configured
  // yet, so back out of that search is home and not an empty options scene.
  const first = ctx({ hasService: true, needsConfigure: true, needsServiceSelect: false });
  assert.equal(
    reduceServiceAppState("location_search", "select_location", first),
    "configure",
  );
  assert.equal(backServiceAppState("location_search", first), "home");
});

/* ---- options, then service, then place (Help's when → kind → where) ----- */

const whenFirst = (over: Partial<ServiceAppContext> = {}) =>
  ctx({
    needsConfigure: true,
    needsServiceSelect: true,
    selectAfterConfigure: true,
    locationAfterConfigure: true,
    ...over,
  });

test("entering a when-first flow opens its options, not a search", () => {
  assert.equal(
    reduceServiceAppState("home", "select_service", whenFirst()),
    "configure",
  );
});

test("answering the options asks which service, then where, then the price", () => {
  assert.equal(
    reduceServiceAppState("configure", "configure_done", whenFirst()),
    "service_select",
  );
  assert.equal(
    reduceServiceAppState(
      "service_select",
      "select_service",
      whenFirst({ hasService: true }),
    ),
    "location_search",
  );
  assert.equal(
    reduceServiceAppState(
      "location_search",
      "select_location",
      whenFirst({ hasService: true, hasLocation: true }),
    ),
    "quote",
  );
});

test("when-first back walks the same chain in reverse, never clearing", () => {
  const full = whenFirst({ hasService: true, hasLocation: true });
  assert.equal(backServiceAppState("quote", full), "location_search");
  assert.equal(backServiceAppState("location_search", full), "service_select");
  assert.equal(backServiceAppState("service_select", full), "configure");
  assert.equal(backServiceAppState("configure", full), "home");
});

test("revising the service with a place already set returns to the quote", () => {
  assert.equal(
    reduceServiceAppState(
      "service_select",
      "select_service",
      whenFirst({ hasService: true, hasLocation: true }),
    ),
    "quote",
  );
});

test("an ordinary ride flow is untouched by either flag", () => {
  const ride = ctx({ hasLocation: true, hasService: true });
  assert.equal(reduceServiceAppState("home", "select_service", ctx()), "home");
  assert.equal(
    reduceServiceAppState("service_select", "select_service", ride),
    "quote",
  );
  assert.equal(backServiceAppState("service_select", ride), "home");
  assert.equal(backServiceAppState("quote", ride), "service_select");
});
