import test from "node:test";
import assert from "node:assert/strict";

import {
  addStop,
  applyRouteChoice,
  MAX_INTERMEDIATE_STOPS,
  nextEmptyField,
  removeStop,
  routeComplete,
  type RouteDraft,
} from "./route-draft.ts";

const origin = { address: "S Grand Ave & W 5th St" };
const dest = { address: "Union Station" };
const stop = { address: "Echo Park Ave" };

const empty = (): RouteDraft => ({
  origin: { address: "" },
  destination: null,
  stops: [],
});

test("a pickup-only draft is not complete; next field is destination", () => {
  const draft: RouteDraft = { origin, destination: null, stops: [] };
  assert.equal(routeComplete(draft), false);
  assert.equal(nextEmptyField(draft), "destination");
});

test("choosing pickup with no destination stays on the route and focuses destination", () => {
  const { draft, next } = applyRouteChoice(empty(), "origin", origin);
  assert.equal(draft.origin.address, origin.address);
  assert.equal(next, "destination");
  assert.equal(routeComplete(draft), false);
});

test("choosing destination with pickup set completes the route", () => {
  const { next } = applyRouteChoice(
    { origin, destination: null, stops: [] },
    "destination",
    dest,
  );
  assert.equal(next, "complete");
});

test("choosing destination with an empty stop stays and focuses the stop", () => {
  const { draft, next } = applyRouteChoice(
    { origin, destination: null, stops: [{ address: "" }] },
    "destination",
    dest,
  );
  assert.deepEqual(next, "stop:0");
  assert.equal(draft.destination?.address, dest.address);
  assert.equal(routeComplete(draft), false);
});

test("filling the last empty stop completes the route", () => {
  const { next } = applyRouteChoice(
    { origin, destination: dest, stops: [{ address: "" }] },
    "stop:0",
    stop,
  );
  assert.equal(next, "complete");
});

test("adding a stop inserts an empty field and focuses it", () => {
  const added = addStop({ origin, destination: dest, stops: [] });
  assert.ok(added);
  assert.equal(added.draft.stops.length, 1);
  assert.equal(added.draft.stops[0]?.address, "");
  assert.equal(added.next, "stop:0");
  assert.equal(routeComplete(added.draft), false);
});

test("adding a stop is refused at the cap", () => {
  const stops = Array.from({ length: MAX_INTERMEDIATE_STOPS }, () => stop);
  assert.equal(addStop({ origin, destination: dest, stops }), null);
});

test("removing a stop drops that waypoint", () => {
  const draft = removeStop(
    { origin, destination: dest, stops: [stop, { address: "Work" }] },
    0,
  );
  assert.equal(draft.stops.length, 1);
  assert.equal(draft.stops[0]?.address, "Work");
});
