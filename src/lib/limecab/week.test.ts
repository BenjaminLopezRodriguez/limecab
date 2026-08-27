import test from "node:test";
import assert from "node:assert/strict";

import { civilDateInZone, mondayCivilDateInZone } from "./week.ts";

test("mondayCivilDateInZone for a Wednesday afternoon in LA is that Monday", () => {
  // 2026-08-26 20:00 UTC = 1pm PDT, a Wednesday.
  const when = new Date("2026-08-26T20:00:00Z");
  assert.equal(civilDateInZone(when), "2026-08-26");
  assert.equal(mondayCivilDateInZone(when), "2026-08-24");
});
