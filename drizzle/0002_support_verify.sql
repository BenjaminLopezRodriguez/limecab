ALTER TABLE "limecab_user" ADD COLUMN IF NOT EXISTS "phone" varchar(20);--> statement-breakpoint
ALTER TABLE "limecab_user" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "limecab_user" ADD COLUMN IF NOT EXISTS "identityStatus" varchar(16) DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "limecab_user" ADD COLUMN IF NOT EXISTS "identityLegalName" varchar(128);--> statement-breakpoint
ALTER TABLE "limecab_user" ADD COLUMN IF NOT EXISTS "identitySubmittedAt" timestamp with time zone;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "limecab_support_ticket" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"userId" varchar(255) NOT NULL,
	"tripId" varchar(255) NOT NULL,
	"topic" varchar(32) NOT NULL,
	"message" varchar(2000) NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);--> statement-breakpoint
ALTER TABLE "limecab_support_ticket" ADD CONSTRAINT "limecab_support_ticket_userId_limecab_user_id_fk" FOREIGN KEY ("userId") REFERENCES "limecab_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_support_ticket" ADD CONSTRAINT "limecab_support_ticket_tripId_limecab_trip_id_fk" FOREIGN KEY ("tripId") REFERENCES "limecab_trip"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "limecab_support_user_id_idx" ON "limecab_support_ticket" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "limecab_support_trip_id_idx" ON "limecab_support_ticket" USING btree ("tripId");
