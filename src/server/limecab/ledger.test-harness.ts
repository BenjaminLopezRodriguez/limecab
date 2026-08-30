import { readFileSync } from "node:fs";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import type { Money } from "../../lib/limecab/money.ts";
import * as schema from "../db/schema.ts";
import {
  balanceFor,
  postTransaction,
  type PostTransactionInput,
} from "./ledger.ts";

/**
 * Harness for the ledger suite. Kept out of `ledger.test.ts` so that file
 * stays readable as a list of claims about the ledger.
 *
 * It builds only the tables the ledger needs, applying the trigger SQL from the
 * real migration rather than a copy — a hand-maintained duplicate of the
 * invariants would eventually test something the database does not do.
 */

type Harness = {
  post: (input: PostTransactionInput) => Promise<{ id: string; replayed: boolean }>;
  /** Bypasses the application-side balance check to prove the DB holds the line. */
  postRaw: (input: PostTransactionInput) => Promise<unknown>;
  balance: (accountKey: string) => Promise<Money>;
  sql: Sql;
};

const MIGRATION = "drizzle/0011_slimy_jack_power.sql";

export async function withLedger(
  url: string,
  body: (h: Harness) => Promise<void>,
): Promise<void> {
  const sql: Sql = postgres(url, { max: 4, onnotice: () => undefined });
  const db = drizzle(sql, { schema });

  try {
    await reset(sql);
    await body({
      post: (input) => postTransaction(db, input),
      postRaw: (input) => rawInsert(sql, input),
      balance: (key) => balanceFor(db, key),
      sql,
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/** A clean ledger per test, so ordering never decides an assertion. */
async function reset(sql: Sql): Promise<void> {
  await sql`DROP TABLE IF EXISTS limecab_ledger_entry CASCADE`;
  // A stub for the serviceId foreign key. Kept real rather than dropped so the
  // harness does not quietly permit a reference production would reject.
  await sql`
    CREATE TABLE IF NOT EXISTS limecab_trip (
      "id" varchar(255) PRIMARY KEY NOT NULL
    )`;
  await sql`DROP TABLE IF EXISTS limecab_ledger_transaction CASCADE`;
  await sql`DROP TABLE IF EXISTS limecab_ledger_account CASCADE`;

  await sql`
    CREATE TABLE limecab_ledger_account (
      "id" varchar(255) PRIMARY KEY NOT NULL,
      "key" varchar(255) NOT NULL,
      "type" varchar(16) NOT NULL,
      "ownerType" varchar(16),
      "ownerId" varchar(255),
      "currency" char(3) NOT NULL,
      "createdAt" timestamp with time zone NOT NULL
    )`;
  await sql`
    CREATE TABLE limecab_ledger_transaction (
      "id" varchar(255) PRIMARY KEY NOT NULL,
      "kind" varchar(32) NOT NULL,
      "serviceId" varchar(255),
      "currency" char(3) NOT NULL,
      "idempotencyKey" varchar(255) NOT NULL,
      "memo" varchar(512),
      "createdAt" timestamp with time zone NOT NULL
    )`;
  await sql`
    CREATE TABLE limecab_ledger_entry (
      "id" varchar(255) PRIMARY KEY NOT NULL,
      "transactionId" varchar(255) NOT NULL REFERENCES limecab_ledger_transaction("id"),
      "accountId" varchar(255) NOT NULL REFERENCES limecab_ledger_account("id"),
      "direction" varchar(6) NOT NULL,
      "amountMinor" bigint NOT NULL,
      "currency" char(3) NOT NULL,
      "createdAt" timestamp with time zone NOT NULL
    )`;
  await sql`
    ALTER TABLE limecab_ledger_account
      ADD CONSTRAINT limecab_ledger_account_key_unique UNIQUE ("key")`;
  await sql`
    ALTER TABLE limecab_ledger_transaction
      ADD CONSTRAINT limecab_ledger_transaction_idem_unique UNIQUE ("idempotencyKey")`;

  // The invariants, taken verbatim from the migration that production runs.
  for (const statement of invariantStatements()) {
    await sql.unsafe(statement);
  }
}

/**
 * Everything in the migration from the first CHECK onward: the constraints,
 * the three trigger functions and their triggers, and the chart of accounts.
 * Read from the file so this cannot drift from what production has.
 */
function invariantStatements(): string[] {
  const text = readFileSync(MIGRATION, "utf8");
  const from = text.indexOf('ALTER TABLE "limecab_ledger_entry"');
  if (from < 0) throw new Error(`${MIGRATION}: could not find the invariant block`);
  return text
    .slice(from)
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    // Drop chunks that are only comments; a lone comment is not a statement.
    .filter((statement) => stripComments(statement).length > 0);
}

const stripComments = (sql: string): string =>
  sql.replace(/^\s*--[^\n]*$/gm, "").trim();

/** Inserts entries without the application balance check. */
async function rawInsert(
  sql: Sql,
  input: PostTransactionInput,
): Promise<unknown> {
  return sql.begin(async (tx) => {
    const [txn] = await tx<{ id: string }[]>`
      INSERT INTO limecab_ledger_transaction
        ("id", "kind", "currency", "idempotencyKey", "createdAt")
      VALUES (gen_random_uuid(), ${input.kind}, ${input.currency},
              ${input.idempotencyKey}, now())
      RETURNING id`;
    for (const line of input.lines) {
      const [acct] = await tx<{ id: string }[]>`
        SELECT id FROM limecab_ledger_account WHERE key = ${line.accountKey}`;
      if (!acct) throw new Error(`no account ${line.accountKey}`);
      await tx`
        INSERT INTO limecab_ledger_entry
          ("id", "transactionId", "accountId", "direction", "amountMinor", "currency", "createdAt")
        VALUES (gen_random_uuid(), ${txn!.id}, ${acct.id}, ${line.direction},
                ${line.amount.minor}, ${line.amount.currency}, now())`;
    }
  });
}
