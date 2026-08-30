import { and, eq, inArray, sql } from "drizzle-orm";

import type { CurrencyCode, Money } from "../../lib/limecab/money.ts";
import { money, sum } from "../../lib/limecab/money.ts";
// Type-only, deliberately. A value import of `db` would open a connection to
// whatever DATABASE_URL points at the moment this module is imported -- which
// for a test run is the production database. The ledger takes its handle from
// the caller instead.
import type { db } from "../db/index.ts";
import {
  ledgerAccounts,
  ledgerEntries,
  ledgerTransactions,
} from "../db/schema.ts";

/**
 * Posting to the ledger.
 *
 * One entry point, `postTransaction`, and no other way in. Balances are read
 * back out of entries and are never stored, so there is no number here that can
 * disagree with its own history.
 *
 * The database enforces the rules that matter -- balance, immutability,
 * currency agreement -- and this module's job is to make the common case
 * convenient and to fail early with a message that names the problem. It is
 * deliberately not the last line of defence.
 */

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type OwnerType = "provider" | "carrier" | "merchant" | "platform";
export type AccountType = "asset" | "liability" | "revenue" | "expense";

/** System accounts, seeded by migration. Owner-scoped ones are minted on demand. */
export const SYSTEM_ACCOUNTS = {
  processorCash: "asset:processor_cash",
  processorReceivable: "asset:processor_receivable",
  customerRefundable: "liability:customer_refundable",
  taxPayable: "liability:tax_payable",
  platformFee: "revenue:platform_fee",
  saasFee: "revenue:saas_fee",
  processorFee: "expense:processor_fee",
  promotion: "expense:promotion",
  refund: "expense:refund",
  adjustment: "expense:adjustment",
} as const;

export const providerPayableKey = (providerId: string) =>
  `liability:provider_payable:${providerId}`;
export const tipsPayableKey = (providerId: string) =>
  `liability:tips_payable:${providerId}`;
export const carrierPayableKey = (carrierId: string) =>
  `liability:carrier_payable:${carrierId}`;
export const merchantPayableKey = (merchantId: string) =>
  `liability:merchant_payable:${merchantId}`;

/** An account's natural side: what a positive balance means for its type. */
const NORMAL_SIDE: Record<AccountType, "debit" | "credit"> = {
  asset: "debit",
  expense: "debit",
  liability: "credit",
  revenue: "credit",
};

export type PostingLine = {
  accountKey: string;
  direction: "debit" | "credit";
  amount: Money;
  /** Minted on first use for owner-scoped accounts. */
  ensure?: { type: AccountType; ownerType?: OwnerType; ownerId?: string };
};

export type PostTransactionInput = {
  kind: string;
  /**
   * Deterministic and derived from the event, e.g. `capture:<serviceId>`.
   * Stripe prunes its own idempotency keys after 24 hours, so a retry a day
   * later is a brand new request there; this key is what still holds.
   */
  idempotencyKey: string;
  currency: CurrencyCode;
  serviceId?: string | null;
  memo?: string;
  lines: PostingLine[];
};

export type PostedTransaction = {
  id: string;
  idempotencyKey: string;
  /** True when this call did nothing because the key had already been posted. */
  replayed: boolean;
};

/**
 * Post one balanced transaction, or return the one already posted under this
 * key. Everything happens inside a single database transaction: the entries
 * and their header commit together or not at all, and the deferred balance
 * trigger fires at COMMIT, so a partially-written transaction cannot be
 * observed and cannot be left behind by a crash.
 */
export async function postTransaction(
  database: Db | Tx,
  input: PostTransactionInput,
): Promise<PostedTransaction> {
  assertBalanced(input);

  const run = async (tx: Tx): Promise<PostedTransaction> => {
    const existing = await tx.query.ledgerTransactions.findFirst({
      where: eq(ledgerTransactions.idempotencyKey, input.idempotencyKey),
      columns: { id: true },
    });
    if (existing) {
      return {
        id: existing.id,
        idempotencyKey: input.idempotencyKey,
        replayed: true,
      };
    }

    const accountIds = await resolveAccounts(tx, input);

    const [header] = await tx
      .insert(ledgerTransactions)
      .values({
        kind: input.kind,
        serviceId: input.serviceId ?? null,
        currency: input.currency,
        idempotencyKey: input.idempotencyKey,
        memo: input.memo ?? null,
      })
      .returning({ id: ledgerTransactions.id });
    if (!header) throw new Error("ledger transaction insert returned no row");

    await tx.insert(ledgerEntries).values(
      input.lines.map((line) => ({
        transactionId: header.id,
        accountId: accountIds.get(line.accountKey)!,
        direction: line.direction,
        amountMinor: line.amount.minor,
        currency: line.amount.currency,
      })),
    );

    return {
      id: header.id,
      idempotencyKey: input.idempotencyKey,
      replayed: false,
    };
  };

  // Callers mid-transaction pass their own tx so the ledger write commits with
  // whatever economic event caused it -- a trip completing and the earning it
  // creates must not be able to land separately.
  return "transaction" in database
    ? database.transaction(run)
    : run(database as Tx);
}

/**
 * Fails before touching the database, with a message naming the imbalance.
 * The deferred trigger would catch this too, but a Postgres exception at COMMIT
 * is a worse thing to debug than a thrown error at the call site.
 */
function assertBalanced(input: PostTransactionInput): void {
  if (input.lines.length < 2) {
    throw new TypeError(
      `${input.kind}: double-entry needs at least 2 lines, got ${input.lines.length}`,
    );
  }
  const byCurrency = new Map<CurrencyCode, Money[]>();
  for (const line of input.lines) {
    if (line.amount.minor <= 0) {
      throw new TypeError(
        `${input.kind}: amounts are positive and direction carries the sign, got ${line.amount.minor}`,
      );
    }
    const signed =
      line.direction === "debit" ? line.amount : money(-line.amount.minor, line.amount.currency);
    const bucket = byCurrency.get(line.amount.currency) ?? [];
    bucket.push(signed);
    byCurrency.set(line.amount.currency, bucket);
  }
  for (const [currency, amounts] of byCurrency) {
    const total = sum(amounts, currency);
    if (total.minor !== 0) {
      throw new TypeError(
        `${input.kind}: does not balance in ${currency}, off by ${total.minor}`,
      );
    }
  }
}

/** Resolves every account key to an id, minting owner-scoped accounts on first use. */
async function resolveAccounts(
  tx: Tx,
  input: PostTransactionInput,
): Promise<Map<string, string>> {
  const keys = [...new Set(input.lines.map((l) => l.accountKey))];
  const found = await tx
    .select({ id: ledgerAccounts.id, key: ledgerAccounts.key })
    .from(ledgerAccounts)
    .where(inArray(ledgerAccounts.key, keys));

  const ids = new Map(found.map((row) => [row.key, row.id]));

  for (const line of input.lines) {
    if (ids.has(line.accountKey)) continue;
    if (!line.ensure) {
      throw new Error(
        `No ledger account ${line.accountKey}, and no ensure{} given to create one`,
      );
    }
    const [created] = await tx
      .insert(ledgerAccounts)
      .values({
        key: line.accountKey,
        type: line.ensure.type,
        ownerType: line.ensure.ownerType ?? null,
        ownerId: line.ensure.ownerId ?? null,
        currency: line.amount.currency,
      })
      .onConflictDoNothing({ target: ledgerAccounts.key })
      .returning({ id: ledgerAccounts.id, key: ledgerAccounts.key });

    if (created) {
      ids.set(created.key, created.id);
      continue;
    }
    // Lost the race to a concurrent poster; theirs is as good as ours.
    const raced = await tx.query.ledgerAccounts.findFirst({
      where: eq(ledgerAccounts.key, line.accountKey),
      columns: { id: true },
    });
    if (!raced) throw new Error(`Could not resolve ledger account ${line.accountKey}`);
    ids.set(line.accountKey, raced.id);
  }
  return ids;
}

/**
 * What an account holds, derived from its entries every time. There is no
 * stored balance to drift, and no `driver.balance` column to be wrong.
 */
export async function balanceFor(
  database: Db | Tx,
  accountKey: string,
): Promise<Money> {
  const [row] = await database
    .select({
      currency: ledgerAccounts.currency,
      // Signed by the account's natural side, so a provider payable of 1600
      // reads as 1600 owed rather than -1600.
      total: sql<string>`COALESCE(SUM(
        CASE WHEN ${ledgerEntries.direction} = ${NORMAL_SIDE_SQL(accountKey)}
             THEN ${ledgerEntries.amountMinor}
             ELSE -${ledgerEntries.amountMinor} END), 0)`,
    })
    .from(ledgerAccounts)
    .leftJoin(ledgerEntries, eq(ledgerEntries.accountId, ledgerAccounts.id))
    .where(eq(ledgerAccounts.key, accountKey))
    .groupBy(ledgerAccounts.id, ledgerAccounts.currency);

  if (!row) throw new Error(`No ledger account ${accountKey}`);
  return money(Number(row.total), row.currency as CurrencyCode);
}

/**
 * The natural side is a property of the account type, which lives in the row.
 * Resolved in SQL so the balance is one round trip rather than two.
 */
function NORMAL_SIDE_SQL(_accountKey: string) {
  return sql`CASE WHEN ${ledgerAccounts.type} IN ('asset', 'expense')
                  THEN 'debit' ELSE 'credit' END`;
}

/** Every entry behind an account, newest first. The audit answer to "why". */
export async function entriesFor(
  database: Db | Tx,
  accountKey: string,
  limit = 100,
) {
  return database
    .select({
      transactionId: ledgerEntries.transactionId,
      kind: ledgerTransactions.kind,
      serviceId: ledgerTransactions.serviceId,
      direction: ledgerEntries.direction,
      amountMinor: ledgerEntries.amountMinor,
      currency: ledgerEntries.currency,
      memo: ledgerTransactions.memo,
      createdAt: ledgerEntries.createdAt,
    })
    .from(ledgerEntries)
    .innerJoin(ledgerAccounts, eq(ledgerEntries.accountId, ledgerAccounts.id))
    .innerJoin(
      ledgerTransactions,
      eq(ledgerEntries.transactionId, ledgerTransactions.id),
    )
    .where(and(eq(ledgerAccounts.key, accountKey)))
    .orderBy(sql`${ledgerEntries.createdAt} DESC`)
    .limit(limit);
}

export { NORMAL_SIDE };
