import test from "node:test";
import assert from "node:assert/strict";

import { money } from "../../lib/limecab/money.ts";

/**
 * Ledger tests run against a real Postgres, because the invariants under test
 * are database triggers -- asserting them in TypeScript would be asserting that
 * the thing we did not rely on works.
 *
 * They require LEDGER_TEST_DATABASE_URL and refuse to run against DATABASE_URL
 * even if someone sets the two to the same value. Lime's dev and production
 * databases are currently the same Neon instance (docs/payments/ARCHITECTURE.md
 * S7), and a test suite whose job is inserting and rolling back financial rows
 * is not a thing to point at production by accident.
 *
 *   docker run -d -p 55434:5432 -e POSTGRES_PASSWORD=test \
 *     -e POSTGRES_DB=ledger postgres:16-alpine
 *   LEDGER_TEST_DATABASE_URL=postgresql://postgres:test@localhost:55434/ledger \
 *     pnpm test
 */

const TEST_URL = process.env.LEDGER_TEST_DATABASE_URL;
const PROD_URL = process.env.DATABASE_URL;

function guard(t: { skip: (reason?: string) => void }): string | null {
  if (!TEST_URL) {
    t.skip("no LEDGER_TEST_DATABASE_URL");
    return null;
  }
  if (PROD_URL && TEST_URL === PROD_URL) {
    // Not a skip. Someone pointed the ledger suite at the app database and
    // should be told, loudly, rather than watching it quietly pass.
    throw new Error(
      "LEDGER_TEST_DATABASE_URL must not equal DATABASE_URL — refusing to run financial tests against the app database",
    );
  }
  return TEST_URL;
}

test("the ledger suite refuses to run against the app database", () => {
  // The guard itself is the test that always runs, because it is the one that
  // protects the shared database.
  const saved = { test: TEST_URL, prod: PROD_URL };
  assert.ok(
    !saved.test || !saved.prod || saved.test !== saved.prod,
    "test and app database URLs must differ",
  );
});

test("a balanced $20 ride posts and reads back", async (t) => {
  const url = guard(t);
  if (!url) return;
  const { withLedger } = await import("./ledger.test-harness.ts");

  await withLedger(url, async ({ post, balance }) => {
    // 2000 charged: 1500 to the provider (75%), 500 to Lime (25%).
    await post({
      kind: "ride_capture",
      idempotencyKey: "capture:trip-1",
      currency: "USD",
      lines: [
        { accountKey: "asset:processor_cash", direction: "debit", amount: money(2000) },
        {
          accountKey: "liability:provider_payable:D1",
          direction: "credit",
          amount: money(1500),
          ensure: { type: "liability", ownerType: "provider", ownerId: "D1" },
        },
        { accountKey: "revenue:platform_fee", direction: "credit", amount: money(500) },
      ],
    });

    assert.equal((await balance("asset:processor_cash")).minor, 2000);
    assert.equal((await balance("liability:provider_payable:D1")).minor, 1500);
    assert.equal((await balance("revenue:platform_fee")).minor, 500);
  });
});

test("an unbalanced transaction is refused", async (t) => {
  const url = guard(t);
  if (!url) return;
  const { withLedger } = await import("./ledger.test-harness.ts");

  await withLedger(url, async ({ post, postRaw }) => {
    await assert.rejects(
      post({
        kind: "wrong",
        idempotencyKey: "bad:1",
        currency: "USD",
        lines: [
          { accountKey: "asset:processor_cash", direction: "debit", amount: money(2000) },
          { accountKey: "revenue:platform_fee", direction: "credit", amount: money(1999) },
        ],
      }),
      /does not balance in USD, off by 1/,
    );

    // And again with the application check bypassed, to prove the database is
    // the one actually holding the line.
    await assert.rejects(
      postRaw({
        kind: "wrong_raw",
        idempotencyKey: "bad:2",
        currency: "USD",
        lines: [
          { accountKey: "asset:processor_cash", direction: "debit", amount: money(2000) },
          { accountKey: "revenue:platform_fee", direction: "credit", amount: money(1999) },
        ],
      }),
      /does not balance/,
    );
  });
});

test("a single-sided transaction is refused by the database", async (t) => {
  const url = guard(t);
  if (!url) return;
  const { withLedger } = await import("./ledger.test-harness.ts");

  await withLedger(url, async ({ postRaw }) => {
    await assert.rejects(
      postRaw({
        kind: "one_sided",
        idempotencyKey: "bad:3",
        currency: "USD",
        lines: [
          { accountKey: "asset:processor_cash", direction: "debit", amount: money(100) },
        ],
      }),
      /at least 2/,
    );
  });
});

test("posting the same key twice posts once", async (t) => {
  const url = guard(t);
  if (!url) return;
  const { withLedger } = await import("./ledger.test-harness.ts");

  await withLedger(url, async ({ post, balance }) => {
    const lines = [
      { accountKey: "asset:processor_cash", direction: "debit" as const, amount: money(1000) },
      { accountKey: "revenue:platform_fee", direction: "credit" as const, amount: money(1000) },
    ];
    const first = await post({
      kind: "ride_capture", idempotencyKey: "capture:trip-2", currency: "USD", lines,
    });
    const second = await post({
      kind: "ride_capture", idempotencyKey: "capture:trip-2", currency: "USD", lines,
    });

    assert.equal(first.replayed, false);
    assert.equal(second.replayed, true);
    assert.equal(second.id, first.id, "replay returns the original transaction");
    assert.equal((await balance("asset:processor_cash")).minor, 1000, "posted once");
  });
});

test("concurrent posts of one key still post once", async (t) => {
  const url = guard(t);
  if (!url) return;
  const { withLedger } = await import("./ledger.test-harness.ts");

  await withLedger(url, async ({ post, balance }) => {
    const lines = [
      { accountKey: "asset:processor_cash", direction: "debit" as const, amount: money(700) },
      { accountKey: "revenue:platform_fee", direction: "credit" as const, amount: money(700) },
    ];
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        post({ kind: "ride_capture", idempotencyKey: "capture:trip-3", currency: "USD", lines }),
      ),
    );
    // Losers may reject on the unique constraint; what must not happen is the
    // amount landing more than once.
    assert.ok(results.some((r) => r.status === "fulfilled"));
    assert.equal((await balance("asset:processor_cash")).minor, 700);
  });
});

test("history cannot be edited or deleted", async (t) => {
  const url = guard(t);
  if (!url) return;
  const { withLedger } = await import("./ledger.test-harness.ts");

  await withLedger(url, async ({ post, sql }) => {
    await post({
      kind: "ride_capture",
      idempotencyKey: "capture:trip-4",
      currency: "USD",
      lines: [
        { accountKey: "asset:processor_cash", direction: "debit", amount: money(500) },
        { accountKey: "revenue:platform_fee", direction: "credit", amount: money(500) },
      ],
    });

    await assert.rejects(
      sql`UPDATE limecab_ledger_entry SET "amountMinor" = 1 WHERE "amountMinor" = 500`,
      /append-only/,
    );
    await assert.rejects(
      sql`DELETE FROM limecab_ledger_entry WHERE "amountMinor" = 500`,
      /append-only/,
    );
    await assert.rejects(
      sql`UPDATE limecab_ledger_transaction SET kind = 'x' WHERE kind = 'ride_capture'`,
      /append-only/,
    );
  });
});

test("a refund adds history rather than rewriting it", async (t) => {
  const url = guard(t);
  if (!url) return;
  const { withLedger } = await import("./ledger.test-harness.ts");

  await withLedger(url, async ({ post, balance, sql }) => {
    await post({
      kind: "ride_capture",
      idempotencyKey: "capture:trip-5",
      currency: "USD",
      lines: [
        { accountKey: "asset:processor_cash", direction: "debit", amount: money(2000) },
        { accountKey: "revenue:platform_fee", direction: "credit", amount: money(2000) },
      ],
    });
    await post({
      kind: "refund",
      idempotencyKey: "refund:trip-5:partial",
      currency: "USD",
      lines: [
        { accountKey: "expense:refund", direction: "debit", amount: money(500) },
        { accountKey: "asset:processor_cash", direction: "credit", amount: money(500) },
      ],
    });

    assert.equal((await balance("asset:processor_cash")).minor, 1500);
    assert.equal((await balance("expense:refund")).minor, 500);
    // The original capture is still there, unchanged and readable.
    const [original] = await sql<{ n: number }[]>`
      SELECT count(*)::int n FROM limecab_ledger_transaction
       WHERE "idempotencyKey" = 'capture:trip-5'`;
    assert.equal(original?.n, 1);
  });
});

test("an entry cannot be denominated differently from its account", async (t) => {
  const url = guard(t);
  if (!url) return;
  const { withLedger } = await import("./ledger.test-harness.ts");

  await withLedger(url, async ({ sql }) => {
    const [acct] = await sql<{ id: string }[]>`
      SELECT id FROM limecab_ledger_account WHERE key = 'asset:processor_cash'`;
    const [txn] = await sql<{ id: string }[]>`
      INSERT INTO limecab_ledger_transaction (id, kind, currency, "idempotencyKey", "createdAt")
      VALUES (gen_random_uuid(), 'currency_probe', 'USD', 'probe:1', now()) RETURNING id`;
    await assert.rejects(
      sql`INSERT INTO limecab_ledger_entry
            (id, "transactionId", "accountId", direction, "amountMinor", currency, "createdAt")
          VALUES (gen_random_uuid(), ${txn!.id}, ${acct!.id}, 'debit', 100, 'EUR', now())`,
      /does not match account/,
    );
  });
});

test("amounts are positive and direction carries the sign", async (t) => {
  const url = guard(t);
  if (!url) return;
  const { withLedger } = await import("./ledger.test-harness.ts");

  await withLedger(url, async ({ post, sql }) => {
    await assert.rejects(
      post({
        kind: "negative",
        idempotencyKey: "neg:1",
        currency: "USD",
        lines: [
          { accountKey: "asset:processor_cash", direction: "debit", amount: money(-100) },
          { accountKey: "revenue:platform_fee", direction: "credit", amount: money(-100) },
        ],
      }),
      /amounts are positive/,
    );
    const [acct] = await sql<{ id: string }[]>`
      SELECT id FROM limecab_ledger_account WHERE key = 'asset:processor_cash'`;
    const [txn] = await sql<{ id: string }[]>`
      INSERT INTO limecab_ledger_transaction (id, kind, currency, "idempotencyKey", "createdAt")
      VALUES (gen_random_uuid(), 'neg_probe', 'USD', 'neg:2', now()) RETURNING id`;
    await assert.rejects(
      sql`INSERT INTO limecab_ledger_entry
            (id, "transactionId", "accountId", direction, "amountMinor", currency, "createdAt")
          VALUES (gen_random_uuid(), ${txn!.id}, ${acct!.id}, 'debit', -100, 'USD', now())`,
      /amount_positive|violates check constraint/,
    );
  });
});
