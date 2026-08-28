import test from "node:test";
import assert from "node:assert/strict";

import {
  formatPickupClock,
  reservedLabel,
  upcomingHalfHours,
} from "./reserve.ts";

test("today slots are half-hours at or after now", () => {
  const from = new Date("2026-08-27T16:10:00");
  const slots = upcomingHalfHours("today", 8, from);
  const first = slots[0];
  const second = slots[1];
  assert.equal(slots.length, 8);
  assert.ok(first && second);
  assert.equal(first.getMinutes() % 30, 0);
  assert.ok(first.getTime() > from.getTime());
  assert.equal(second.getTime() - first.getTime(), 30 * 60_000);
});

test("tomorrow starts in the morning of the next day", () => {
  const from = new Date("2026-08-27T21:40:00");
  const slots = upcomingHalfHours("tomorrow", 3, from);
  assert.equal(slots[0]?.getDate(), 28);
  assert.equal(slots[0]?.getHours(), 8);
  assert.equal(slots[0]?.getMinutes(), 0);
});

test("reserved copy is a clock, not an approaching car", () => {
  const at = new Date("2026-08-27T18:30:00");
  assert.equal(formatPickupClock(at), "6:30 PM");
  assert.equal(reservedLabel(at), "Reserved for 6:30 PM");
});
