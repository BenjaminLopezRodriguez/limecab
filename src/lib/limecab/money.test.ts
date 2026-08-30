import test from "node:test";
import assert from "node:assert/strict";

import {
  add,
  allocate,
  compare,
  equals,
  formatMoney,
  isCurrencyCode,
  money,
  negate,
  subtract,
  sum,
  zero,
} from "./money.ts";

test("money is whole minor units or it is not money", () => {
  assert.equal(money(1124).minor, 1124);
  assert.equal(money(0).minor, 0);
  assert.equal(money(-500).minor, -500, "a reversal is a real amount");
  // The float that started it all. Rounding here would be a decision nobody made.
  assert.throws(() => money(11.24), TypeError);
  assert.throws(() => money(0.1 + 0.2), TypeError);
  assert.throws(() => money(Number.MAX_SAFE_INTEGER + 2), RangeError);
  assert.throws(() => money(NaN), TypeError);
});

test("currencies do not mix silently", () => {
  const usd = money(100, "USD");
  const eur = { minor: 100, currency: "EUR" } as unknown as typeof usd;
  assert.throws(() => add(usd, eur), TypeError);
  assert.throws(() => subtract(usd, eur), TypeError);
  assert.throws(() => compare(usd, eur), TypeError);
  assert.equal(equals(usd, eur), false, "equals reports, it does not throw");
});

test("arithmetic stays in minor units", () => {
  assert.equal(add(money(1999), money(1)).minor, 2000);
  assert.equal(subtract(money(2000), money(1)).minor, 1999);
  assert.equal(negate(money(250)).minor, -250);
  assert.equal(sum([money(100), money(200), money(3)], "USD").minor, 303);
  assert.equal(sum([], "USD").minor, 0);
  assert.equal(zero().minor, 0);
});

test("an empty sum takes the currency it is told, not a default", () => {
  // If this defaulted, a non-USD ledger would balance in dollars and nobody
  // would find out until reconciliation.
  assert.equal(sum([], "USD").currency, "USD");
});

test("allocate loses no cents", () => {
  const thirds = allocate(money(1000), [1, 1, 1]);
  assert.deepEqual(
    thirds.map((m) => m.minor),
    [334, 333, 333],
  );
  assert.equal(sum(thirds, "USD").minor, 1000);

  // The 25% take rate on an odd fare: 75/25 of 1999.
  const split = allocate(money(1999), [75, 25]);
  assert.equal(sum(split, "USD").minor, 1999);
  assert.deepEqual(
    split.map((m) => m.minor),
    [1500, 499],
  );
});

test("allocate handles negatives and rejects nonsense weights", () => {
  const reversal = allocate(money(-1000), [1, 1, 1]);
  assert.equal(sum(reversal, "USD").minor, -1000);
  assert.throws(() => allocate(money(100), []), TypeError);
  assert.throws(() => allocate(money(100), [0, 0]), TypeError);
  assert.throws(() => allocate(money(100), [1.5, 1]), TypeError);
  assert.throws(() => allocate(money(100), [-1, 2]), TypeError);
});

test("currency codes are checked, not assumed", () => {
  assert.equal(isCurrencyCode("USD"), true);
  assert.equal(isCurrencyCode("EUR"), false);
  assert.equal(formatMoney(money(1124)), "$11.24");
});
