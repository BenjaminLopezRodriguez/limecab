import assert from "node:assert/strict";
import { test } from "node:test";

import {
  rankStationOptions,
  STATION_DURATIONS,
  STATION_FIXTURES,
  stationDuration,
  stationMetaLabel,
  stationPriceLabel,
  stationTotalCents,
  walkMinutes,
} from "./station.ts";

const lot = { hourlyCents: 300 };

test("a duration id always resolves, even a bad one", () => {
  assert.equal(stationDuration("2h").hours, 2);
  // @ts-expect-error — the union is the contract; the fallback is the belt.
  assert.equal(stationDuration("nonsense").id, "1h");
});

test("price is the rate times the hours, until the day cap", () => {
  assert.equal(stationTotalCents(lot, "1h"), 300);
  assert.equal(stationTotalCents(lot, "2h"), 600);
  assert.equal(stationTotalCents(lot, "4h"), 1_200);
  // All day is twelve hours of parking but six hours of billing — nobody
  // sells a day at the hourly rate, and multiplying it out would be a lie.
  assert.equal(stationTotalCents(lot, "day"), 1_800);
  assert.equal(stationPriceLabel(lot, "day"), "$18.00");
});

test("walk time never rounds to zero minutes", () => {
  assert.equal(walkMinutes(0), 1);
  assert.equal(walkMinutes(10), 1);
  assert.equal(walkMinutes(750), 10);
});

test("the meta line omits closing time rather than inventing one", () => {
  const known = STATION_FIXTURES.find((o) => o.openUntil)!;
  assert.match(stationMetaLabel(known), /min walk · until /);
  const unknown = STATION_FIXTURES.find((o) => !o.openUntil)!;
  assert.match(stationMetaLabel(unknown), /^\d+ min walk$/);
});

test("lots are ordered by walk, because that is the choice", () => {
  const ranked = rankStationOptions(STATION_FIXTURES);
  const walks = ranked.map((o) => o.distanceMeters);
  assert.deepEqual(walks, [...walks].sort((a, b) => a - b));
  assert.equal(ranked.length, STATION_FIXTURES.length);
});

test("every duration preset is priceable", () => {
  for (const d of STATION_DURATIONS) {
    assert.ok(stationTotalCents(lot, d.id) > 0, d.id);
  }
});
