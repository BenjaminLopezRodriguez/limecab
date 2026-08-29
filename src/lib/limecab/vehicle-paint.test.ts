import test from "node:test";
import assert from "node:assert/strict";

import { vehiclePaintClass } from "./vehicle-paint.ts";

test("Maya's Slate maps to a distinctive fill, not muted fallback", () => {
  const slate = vehiclePaintClass("Slate");
  assert.ok(slate);
  assert.notEqual(slate, "bg-muted");
  assert.notEqual(slate, vehiclePaintClass("Silver"));
});

test("known pool colours map; unknown names do not invent grey", () => {
  assert.ok(vehiclePaintClass("White"));
  assert.ok(vehiclePaintClass("Black"));
  assert.ok(vehiclePaintClass("Silver"));
  assert.equal(vehiclePaintClass("Chartreuse"), null);
});
