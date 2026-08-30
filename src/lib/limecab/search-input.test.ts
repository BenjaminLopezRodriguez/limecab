import test from "node:test";
import assert from "node:assert/strict";

import {
  searchInputContract,
  searchShortcutCopy,
} from "./search-input.ts";

test("assist is a single query field, not a pickup and dropoff", () => {
  const contract = searchInputContract({
    mode: "assist",
    target: "destination",
  });
  assert.equal(contract.role, "query");
  assert.equal(contract.commit, "query");
  assert.equal(contract.showRoute, false);
  assert.equal(contract.allowStops, false);
  assert.equal(contract.destinationRequired, false);
  assert.equal(contract.hereCompletes, true);
  assert.deepEqual(contract.shortcuts, []);
  assert.equal(contract.title, "What would you like to do?");
});

test("ride destination still requires a place and a route stack", () => {
  const contract = searchInputContract({
    mode: "ride",
    target: "destination",
  });
  assert.equal(contract.role, "destination");
  assert.equal(contract.commit, "place");
  assert.equal(contract.showRoute, true);
  assert.equal(contract.allowStops, true);
  assert.equal(contract.destinationRequired, true);
  assert.equal(contract.hereCompletes, false);
  assert.deepEqual(contract.shortcuts, []);
  assert.equal(contract.title, "Where to?");
});

test("help is one house, not a pickup and a destination", () => {
  const contract = searchInputContract({ mode: "help", target: "destination" });
  assert.equal(contract.role, "visit");
  assert.equal(contract.commit, "place_or_here");
  assert.equal(contract.showRoute, false);
  assert.equal(contract.allowStops, false);
  assert.equal(contract.destinationRequired, false);
  assert.equal(contract.hereCompletes, true);
  assert.deepEqual(contract.shortcuts, ["use_here", "send_to"]);
  assert.equal(contract.title, "Where is the house?");
  assert.equal(contract.placeholder, "House address…");
});

test("help sent to someone else relabels the field and drops send-to", () => {
  const contract = searchInputContract({
    mode: "help",
    target: "destination",
    audience: "other",
  });
  assert.equal(contract.placeholder, "Their address…");
  assert.deepEqual(contract.shortcuts, ["use_here"]);
});

test("shop first asks for a store, not the rider's door", () => {
  const contract = searchInputContract({ mode: "shop", target: "pickup" });
  assert.equal(contract.role, "store");
  assert.equal(contract.showRoute, false);
  assert.equal(contract.hereCompletes, false);
  assert.deepEqual(contract.shortcuts, []);
  assert.equal(contract.title, "Which shop?");
});

test("shop drop-off can be here or send-to", () => {
  const contract = searchInputContract({
    mode: "shop",
    target: "destination",
  });
  assert.equal(contract.role, "dropoff");
  assert.equal(contract.showRoute, true);
  assert.equal(contract.allowStops, false);
  assert.equal(contract.originLabel, "Shop");
  assert.equal(contract.destinationLabel, "Deliver to");
  assert.equal(contract.hereCompletes, true);
  assert.deepEqual(contract.shortcuts, ["use_here", "send_to"]);
});

test("courier drop-off is the same here-or-send contract as shop", () => {
  const contract = searchInputContract({
    mode: "courier",
    target: "destination",
  });
  assert.equal(contract.role, "dropoff");
  assert.equal(contract.originLabel, "Pick up");
  assert.deepEqual(contract.shortcuts, ["use_here", "send_to"]);
});

test("shortcut copy is the house for help and the door for drop-off", () => {
  assert.equal(
    searchShortcutCopy("use_here", "visit", "self").label,
    "This house",
  );
  assert.equal(
    searchShortcutCopy("send_to", "dropoff", "self").label,
    "Send to someone",
  );
  assert.equal(
    searchShortcutCopy("use_here", "visit", "other").label,
    "Use my location",
  );
});
