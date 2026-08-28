CREATE TABLE IF NOT EXISTS "limecab_saved_place" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"userId" varchar(255) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"label" varchar(64) NOT NULL,
	"address" varchar(512) NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"h3" varchar(16) NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone
);--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "limecab_saved_place" ADD CONSTRAINT "limecab_saved_place_userId_limecab_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."limecab_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "limecab_saved_place_user_idx" ON "limecab_saved_place" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "limecab_saved_place_h3_idx" ON "limecab_saved_place" USING btree ("h3");--> statement-breakpoint
ALTER TABLE "limecab_driver" ADD COLUMN IF NOT EXISTS "lastLatitude" double precision;--> statement-breakpoint
ALTER TABLE "limecab_driver" ADD COLUMN IF NOT EXISTS "lastLongitude" double precision;--> statement-breakpoint
ALTER TABLE "limecab_driver" ADD COLUMN IF NOT EXISTS "lastH3" varchar(16);--> statement-breakpoint
ALTER TABLE "limecab_driver" ADD COLUMN IF NOT EXISTS "lastSeenAt" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "limecab_driver_last_h3_idx" ON "limecab_driver" USING btree ("lastH3");--> statement-breakpoint
ALTER TABLE "limecab_trip" ADD COLUMN IF NOT EXISTS "pickupH3" varchar(16);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "limecab_trip_pickup_h3_idx" ON "limecab_trip" USING btree ("pickupH3");
