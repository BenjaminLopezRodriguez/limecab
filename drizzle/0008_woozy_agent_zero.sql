ALTER TABLE "limecab_driver" ADD COLUMN "careJobs" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "limecab_driver" ADD COLUMN "careRulesVersion" varchar(16);--> statement-breakpoint
ALTER TABLE "limecab_driver" ADD COLUMN "careAcknowledgedAt" timestamp with time zone;