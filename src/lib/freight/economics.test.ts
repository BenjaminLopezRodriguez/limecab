import test from "node:test";
import assert from "node:assert/strict";

import {
  deadheadMiles,
  milesToMeters,
  ratePerMile,
} from "./economics.ts";

test("ratePerMile truncates to integer cents/mi", () => {
  const meters = milesToMeters(795);
  assert.equal(ratePerMile(184_000, meters), Math.trunc(184_000 / 795));
  assert.equal(ratePerMile(100, 0), 0);
  assert.throws(() => ratePerMile(11.5, 1000), TypeError);
});

test("deadheadMiles Ontario→Phoenix is positive finite", () => {
  // Ontario CA → Phoenix AZ
  const mi = deadheadMiles(34.0633, -117.6509, 33.4484, -112.074);
  assert.ok(Number.isFinite(mi));
  assert.ok(mi > 300 && mi < 500, `deadhead=${mi}`);
});

test("deadhead zero at same point", () => {
  assert.equal(deadheadMiles(34.0, -117.0, 34.0, -117.0), 0);
});
