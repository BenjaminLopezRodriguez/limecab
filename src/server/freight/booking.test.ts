import test from "node:test";
import assert from "node:assert/strict";

import {
  simulateBookRace,
  tryClaimAvailableLoad,
} from "./booking.ts";

test("tryClaimAvailableLoad wins on AVAILABLE empty carrier", () => {
  const r = tryClaimAvailableLoad(
    { status: "AVAILABLE", carrierId: null },
    "carrier_a",
  );
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.next.status, "BOOKED");
    assert.equal(r.next.carrierId, "carrier_a");
  }
});

test("tryClaimAvailableLoad loses when already booked", () => {
  const r = tryClaimAvailableLoad(
    { status: "BOOKED", carrierId: "carrier_a" },
    "carrier_b",
  );
  assert.equal(r.ok, false);
});

test("simulateBookRace: second claimant loses", () => {
  const shared = { status: "AVAILABLE", carrierId: null as string | null };
  const { winner, loser } = simulateBookRace(shared, "c1", "c2");
  assert.equal(winner, "c1");
  assert.equal(loser, "c2");
  assert.equal(shared.status, "BOOKED");
  assert.equal(shared.carrierId, "c1");
});
