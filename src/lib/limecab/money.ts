/**
 * Money, as an amount and a currency that cannot be separated.
 *
 * Two rules, both enforced here rather than by convention:
 *
 * - **Minor units, always integers.** `$11.24` is `1124`, never `11.24`.
 *   Floats do not represent tenths exactly, so `0.1 + 0.2 !== 0.3` and a cent
 *   goes missing in a way that surfaces months later in a reconciliation
 *   report. Every constructor rejects a non-integer instead of rounding one,
 *   because rounding here is a decision nobody made on purpose.
 * - **Currencies never mix silently.** Adding USD to EUR throws. It is not a
 *   number plus a number; without a rate it is not an amount at all.
 *
 * This module is pure and has no opinion about ledgers, Stripe, or fares.
 */

export const CURRENCIES = ["USD"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export type Money = {
  /** Minor units — cents for USD. Always a safe integer. */
  readonly minor: number;
  readonly currency: CurrencyCode;
};

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (CURRENCIES as readonly string[]).includes(value);
}

/**
 * The only way to make a Money. Negative is allowed — a reversal is a real
 * amount — but a fraction of a cent is not, and neither is a number large
 * enough to have stopped being exact.
 */
export function money(minor: number, currency: CurrencyCode = "USD"): Money {
  if (!Number.isInteger(minor)) {
    throw new TypeError(`Money must be whole minor units, got ${minor}`);
  }
  if (!Number.isSafeInteger(minor)) {
    throw new RangeError(`Money ${minor} is past exact integer range`);
  }
  return { minor, currency };
}

export const zero = (currency: CurrencyCode = "USD"): Money =>
  money(0, currency);

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    // Widened to string: inside this branch the union has narrowed to never,
    // which is true today with one currency and wrong the moment there are two.
    throw new TypeError(
      `Cannot combine ${a.currency as string} with ${b.currency as string} — no rate is defined`,
    );
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor + b.minor, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor - b.minor, a.currency);
}

export function negate(a: Money): Money {
  return money(-a.minor, a.currency);
}

/**
 * An empty sum has no currency of its own, so it must be told one. Defaulting
 * to USD here would be how a EUR ledger silently starts balancing in dollars.
 */
export function sum(amounts: readonly Money[], currency: CurrencyCode): Money {
  return amounts.reduce((total, next) => add(total, next), zero(currency));
}

export const isZero = (a: Money): boolean => a.minor === 0;
export const isNegative = (a: Money): boolean => a.minor < 0;

export function compare(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  return a.minor === b.minor ? 0 : a.minor < b.minor ? -1 : 1;
}

export const equals = (a: Money, b: Money): boolean =>
  a.currency === b.currency && a.minor === b.minor;

/**
 * Split an amount so the parts add back to exactly the whole. The remainder
 * cents go to the earliest weights rather than vanishing: 1000 split 1:1:1 is
 * 334/333/333, not three 333s and a lost cent.
 *
 * Weights must be non-negative integers — a float weight would reintroduce
 * exactly the arithmetic this module exists to prevent.
 */
export function allocate(amount: Money, weights: readonly number[]): Money[] {
  if (weights.length === 0) throw new TypeError("allocate needs a weight");
  if (weights.some((w) => !Number.isInteger(w) || w < 0)) {
    throw new TypeError("allocate weights must be non-negative integers");
  }
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) throw new TypeError("allocate weights must not sum to zero");

  const shares = weights.map((w) =>
    Math.trunc((amount.minor * w) / total),
  );
  let remainder = amount.minor - shares.reduce((a, b) => a + b, 0);
  // Signed step, so a negative amount distributes its remainder the same way.
  const step = remainder < 0 ? -1 : 1;
  for (let i = 0; remainder !== 0; i = (i + 1) % shares.length) {
    if (weights[i] === 0) continue;
    shares[i] = shares[i]! + step;
    remainder -= step;
  }
  return shares.map((minor) => money(minor, amount.currency));
}

/** Display only. Never parse this back into a Money. */
export function formatMoney(amount: Money): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: amount.currency,
  }).format(amount.minor / 100);
}
