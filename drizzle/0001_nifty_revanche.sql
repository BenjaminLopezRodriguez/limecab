ALTER TABLE "limecab_trip" ADD COLUMN "recipientName" varchar(80);--> statement-breakpoint
ALTER TABLE "limecab_trip" ADD COLUMN "recipientPhone" varchar(20);--> statement-breakpoint
ALTER TABLE "limecab_trip" ADD COLUMN "packageCount" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "limecab_trip" ADD COLUMN "deliveryProof" varchar(16);--> statement-breakpoint
ALTER TABLE "limecab_trip" ADD COLUMN "deliveryPin" varchar(8);--> statement-breakpoint
ALTER TABLE "limecab_trip" ADD COLUMN "pickupVerifiedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "limecab_trip" ADD COLUMN "deliveryVerifiedAt" timestamp with time zone;