ALTER TABLE "limecab_driver" ADD COLUMN "helpJobs" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "limecab_driver" ADD COLUMN "helpAcknowledgedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "limecab_trip" ADD COLUMN "scheduledAt" timestamp with time zone;