CREATE TABLE "limecab_ledger_account" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"key" varchar(255) NOT NULL,
	"type" varchar(16) NOT NULL,
	"ownerType" varchar(16),
	"ownerId" varchar(255),
	"currency" char(3) NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	CONSTRAINT "limecab_ledger_account_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "limecab_ledger_entry" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"transactionId" varchar(255) NOT NULL,
	"accountId" varchar(255) NOT NULL,
	"direction" varchar(6) NOT NULL,
	"amountMinor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "limecab_ledger_transaction" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"kind" varchar(32) NOT NULL,
	"serviceId" varchar(255),
	"currency" char(3) NOT NULL,
	"idempotencyKey" varchar(255) NOT NULL,
	"memo" varchar(512),
	"createdAt" timestamp with time zone NOT NULL,
	CONSTRAINT "limecab_ledger_transaction_idem_unique" UNIQUE("idempotencyKey")
);
--> statement-breakpoint
ALTER TABLE "limecab_ledger_entry" ADD CONSTRAINT "limecab_ledger_entry_transactionId_limecab_ledger_transaction_id_fk" FOREIGN KEY ("transactionId") REFERENCES "public"."limecab_ledger_transaction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_ledger_entry" ADD CONSTRAINT "limecab_ledger_entry_accountId_limecab_ledger_account_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."limecab_ledger_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_ledger_transaction" ADD CONSTRAINT "limecab_ledger_transaction_serviceId_limecab_trip_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."limecab_trip"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "limecab_ledger_account_owner_idx" ON "limecab_ledger_account" USING btree ("ownerType","ownerId");--> statement-breakpoint
CREATE INDEX "limecab_ledger_entry_transaction_idx" ON "limecab_ledger_entry" USING btree ("transactionId");--> statement-breakpoint
CREATE INDEX "limecab_ledger_entry_account_idx" ON "limecab_ledger_entry" USING btree ("accountId");--> statement-breakpoint
CREATE INDEX "limecab_ledger_transaction_service_idx" ON "limecab_ledger_transaction" USING btree ("serviceId");--> statement-breakpoint
CREATE INDEX "limecab_ledger_transaction_kind_idx" ON "limecab_ledger_transaction" USING btree ("kind");--> statement-breakpoint

-- Everything below is why this is a ledger and not three tables. None of it is
-- expressible in Drizzle, and none of it belongs in TypeScript: an invariant
-- that lives only in the application holds until the first migration script,
-- backfill, or psql session runs.

-- Amounts are positive; `direction` carries the sign. Storing signed amounts
-- would make "credit -500" and "debit 500" two spellings of the same fact.
ALTER TABLE "limecab_ledger_entry"
  ADD CONSTRAINT "limecab_ledger_entry_amount_positive"
  CHECK ("amountMinor" > 0);--> statement-breakpoint

ALTER TABLE "limecab_ledger_entry"
  ADD CONSTRAINT "limecab_ledger_entry_direction_valid"
  CHECK ("direction" IN ('debit', 'credit'));--> statement-breakpoint

ALTER TABLE "limecab_ledger_account"
  ADD CONSTRAINT "limecab_ledger_account_type_valid"
  CHECK ("type" IN ('asset', 'liability', 'revenue', 'expense'));--> statement-breakpoint

-- An entry must be denominated in its account's currency. Without this a USD
-- payable could accumulate EUR entries and still "balance".
CREATE OR REPLACE FUNCTION limecab_ledger_entry_currency_matches()
RETURNS TRIGGER AS $$
DECLARE
  account_currency char(3);
BEGIN
  SELECT "currency" INTO account_currency
    FROM "limecab_ledger_account" WHERE "id" = NEW."accountId";
  IF account_currency IS DISTINCT FROM NEW."currency" THEN
    RAISE EXCEPTION
      'ledger entry currency % does not match account % currency %',
      NEW."currency", NEW."accountId", account_currency;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER limecab_ledger_entry_currency_trg
  BEFORE INSERT ON "limecab_ledger_entry"
  FOR EACH ROW EXECUTE FUNCTION limecab_ledger_entry_currency_matches();--> statement-breakpoint

-- The balance rule. DEFERRABLE INITIALLY DEFERRED so it is checked once at
-- COMMIT rather than after each row -- a balanced transaction is necessarily
-- unbalanced partway through being written.
CREATE OR REPLACE FUNCTION limecab_ledger_transaction_balances()
RETURNS TRIGGER AS $$
DECLARE
  row_count integer;
  imbalance bigint;
  bad_currency text;
BEGIN
  -- The transaction may have been rolled back after this trigger was queued.
  IF NOT EXISTS (
    SELECT 1 FROM "limecab_ledger_transaction" WHERE "id" = NEW."transactionId"
  ) THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO row_count
    FROM "limecab_ledger_entry" WHERE "transactionId" = NEW."transactionId";

  IF row_count < 2 THEN
    RAISE EXCEPTION
      'ledger transaction % has % entries; double-entry needs at least 2',
      NEW."transactionId", row_count;
  END IF;

  -- Per currency: a transaction spanning two currencies must balance in each,
  -- because there is no rate here to net them against one another.
  SELECT "currency",
         SUM(CASE WHEN "direction" = 'debit' THEN "amountMinor"
                  ELSE -"amountMinor" END)
    INTO bad_currency, imbalance
    FROM "limecab_ledger_entry"
   WHERE "transactionId" = NEW."transactionId"
   GROUP BY "currency"
  HAVING SUM(CASE WHEN "direction" = 'debit' THEN "amountMinor"
                  ELSE -"amountMinor" END) <> 0
   LIMIT 1;

  IF bad_currency IS NOT NULL THEN
    RAISE EXCEPTION
      'ledger transaction % does not balance in %: off by %',
      NEW."transactionId", bad_currency, imbalance;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE CONSTRAINT TRIGGER limecab_ledger_balance_trg
  AFTER INSERT ON "limecab_ledger_entry"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION limecab_ledger_transaction_balances();--> statement-breakpoint

-- Append-only. A refund is a new transaction, never an edit to the original;
-- history is added to and never rewritten, so "what did we believe on the day"
-- stays answerable.
CREATE OR REPLACE FUNCTION limecab_ledger_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'ledger history is append-only: % on % is not permitted. Post a correcting transaction instead.',
    TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER limecab_ledger_entry_immutable_trg
  BEFORE UPDATE OR DELETE ON "limecab_ledger_entry"
  FOR EACH ROW EXECUTE FUNCTION limecab_ledger_append_only();--> statement-breakpoint

CREATE TRIGGER limecab_ledger_transaction_immutable_trg
  BEFORE UPDATE OR DELETE ON "limecab_ledger_transaction"
  FOR EACH ROW EXECUTE FUNCTION limecab_ledger_append_only();--> statement-breakpoint

-- System accounts. Per-beneficiary accounts (provider payables, tips payable)
-- are created on demand, because they are keyed by someone who may not exist yet.
--
-- `revenue:saas_fee` and `liability:tax_payable` are deliberately created and
-- deliberately unused: which of platform_fee/saas_fee a service posts to is a
-- legal question that is still open, and having both means answering it later
-- is configuration rather than a migration.
INSERT INTO "limecab_ledger_account" ("id", "key", "type", "currency", "createdAt")
VALUES
  (gen_random_uuid(), 'asset:processor_cash',       'asset',     'USD', now()),
  (gen_random_uuid(), 'asset:processor_receivable', 'asset',     'USD', now()),
  (gen_random_uuid(), 'liability:customer_refundable', 'liability', 'USD', now()),
  (gen_random_uuid(), 'liability:tax_payable',      'liability', 'USD', now()),
  (gen_random_uuid(), 'revenue:platform_fee',       'revenue',   'USD', now()),
  (gen_random_uuid(), 'revenue:saas_fee',           'revenue',   'USD', now()),
  (gen_random_uuid(), 'expense:processor_fee',      'expense',   'USD', now()),
  (gen_random_uuid(), 'expense:promotion',          'expense',   'USD', now()),
  (gen_random_uuid(), 'expense:refund',             'expense',   'USD', now()),
  (gen_random_uuid(), 'expense:adjustment',         'expense',   'USD', now())
ON CONFLICT ("key") DO NOTHING;
