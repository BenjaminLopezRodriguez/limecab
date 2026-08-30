CREATE TABLE "limecab_trip_message" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"tripId" varchar(255) NOT NULL,
	"senderUserId" varchar(255) NOT NULL,
	"senderRole" varchar(8) NOT NULL,
	"body" varchar(500) NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "limecab_trip_message" ADD CONSTRAINT "limecab_trip_message_tripId_limecab_trip_id_fk" FOREIGN KEY ("tripId") REFERENCES "public"."limecab_trip"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_trip_message" ADD CONSTRAINT "limecab_trip_message_senderUserId_limecab_user_id_fk" FOREIGN KEY ("senderUserId") REFERENCES "public"."limecab_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "limecab_trip_message_trip_id_idx" ON "limecab_trip_message" USING btree ("tripId");--> statement-breakpoint
CREATE INDEX "limecab_trip_message_trip_created_idx" ON "limecab_trip_message" USING btree ("tripId","createdAt");