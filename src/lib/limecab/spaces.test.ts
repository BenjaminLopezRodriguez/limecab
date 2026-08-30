import assert from "node:assert/strict";
import { test } from "node:test";

import {
  rankSpaceOptions,
  SPACE_KINDS,
  SPACES_FIXTURES,
  SPACES_SPANS,
  spaceKindLabel,
  spaceKindUnit,
  spacesPriceLabel,
  spacesRateLabel,
  spacesTotalCents,
} from "./spaces.ts";

test("a room is priced by the hour and a stay by the night", () => {
  assert.equal(spaceKindUnit("meeting"), "hour");
  assert.equal(spaceKindUnit("venue"), "hour");
  assert.equal(spaceKindUnit("stay"), "night");
  assert.equal(spaceKindLabel("stay"), "Stay overnight");
});

test("the total is the rate times the span the rider chose", () => {
  const room = { priceCents: 6_500 };
  assert.equal(spacesTotalCents(room, "1"), 6_500);
  assert.equal(spacesTotalCents(room, "4"), 26_000);
  assert.equal(spacesPriceLabel(room, "2"), "$130.00");
});

test("the rate line names the unit, and omits capacity we were not given", () => {
  const room = SPACES_FIXTURES.find((o) => o.capacity)!;
  assert.match(spacesRateLabel(room), /\/hr · seats \d+$/);
  const stay = SPACES_FIXTURES.find((o) => o.kind === "stay")!;
  assert.match(spacesRateLabel(stay), /\/night$/);
  assert.doesNotMatch(spacesRateLabel(stay), /seats/);
});

test("filtering by kind keeps only that kind, cheapest first", () => {
  const meetings = rankSpaceOptions(SPACES_FIXTURES, "meeting");
  assert.ok(meetings.length >= 2);
  assert.ok(meetings.every((o) => o.kind === "meeting"));
  const prices = meetings.map((o) => o.priceCents);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
});

test("no kind means every kind — the list is never silently empty", () => {
  assert.equal(
    rankSpaceOptions(SPACES_FIXTURES, null).length,
    SPACES_FIXTURES.length,
  );
});

test("every kind has at least three options to compare", () => {
  // Three is the point: two rows is a toggle, not a comparison, and the
  // acceptance walk asks for a real list behind each kind.
  for (const kind of SPACE_KINDS) {
    const rows = rankSpaceOptions(SPACES_FIXTURES, kind.id);
    assert.ok(rows.length >= 3, `${kind.id} has ${rows.length}`);
  }
});

test("every span preset prices something", () => {
  for (const span of SPACES_SPANS) {
    assert.ok(spacesTotalCents({ priceCents: 100 }, span.id) > 0, span.id);
  }
});
