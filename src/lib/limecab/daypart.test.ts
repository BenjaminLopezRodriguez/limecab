import assert from "node:assert/strict";
import { test } from "node:test";

import { daypart } from "./daypart.ts";

/** Local hour, deliberately: `new Date(y, m, d, h)` is local time. */
const at = (hour: number) => daypart(new Date(2026, 7, 27, hour, 30));

test("daypart names the hour a driver is actually in", () => {
  assert.equal(at(7).headline, "It’s morning");
  assert.equal(at(12).headline, "It’s lunch time");
  assert.equal(at(15).headline, "Afternoon lull");
  assert.equal(at(19).headline, "It’s dinner time");
});

test("outside the named bands it says nothing about demand", () => {
  for (const hour of [0, 3, 4, 22, 23]) {
    const part = at(hour);
    assert.equal(part.headline, "Looking for rides");
    assert.equal(part.sub, "Offers will show up here");
  }
});

test("every band covers the clock exactly once", () => {
  const seen = new Set<string>();
  for (let hour = 0; hour < 24; hour += 1) seen.add(at(hour).headline);
  assert.equal(seen.size, 5);
});
