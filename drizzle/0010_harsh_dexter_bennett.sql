-- Play money gets a column, not a naming convention.
--
-- Before this, a trip was "simulated" only if its driverId happened to start
-- with 'sim-driver-'. Seeded drivers use 'seed-driver-' and so read as real.
-- Once trip completion mints earnings, a string prefix is not a thing to let
-- stand between a demo ride and a payable one.
ALTER TABLE "limecab_trip" ADD COLUMN "simulated" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Backfill what is still knowable. Any trip ever touched by a synthetic driver
-- is demo money.
--
-- What this CANNOT recover: a trip that auto-advanced but was never matched,
-- and any trip driven by a genuine driver row created during local development
-- against this same database. Those stay false. The creation-time write added
-- alongside this migration is what makes the flag trustworthy from here on --
-- history is best-effort, the future is not.
UPDATE "limecab_trip"
   SET "simulated" = true
 WHERE "driverId" LIKE 'sim-driver-%'
    OR "driverId" LIKE 'seed-driver-%';--> statement-breakpoint

-- Financial queries filter on this. Partial: the interesting set is the small one.
CREATE INDEX "limecab_trip_simulated_idx" ON "limecab_trip" USING btree ("simulated") WHERE "limecab_trip"."simulated";
