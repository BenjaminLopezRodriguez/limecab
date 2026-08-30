CREATE TABLE "limecab_freight_carrier_invite" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"carrierId" varchar(255) NOT NULL,
	"code" varchar(32) NOT NULL,
	"role" varchar(16) NOT NULL,
	"invitedEmail" varchar(255),
	"invitedName" varchar(128),
	"createdByUserId" varchar(255) NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"acceptedByUserId" varchar(255),
	"acceptedAt" timestamp with time zone,
	"revokedAt" timestamp with time zone,
	"createdAt" timestamp with time zone NOT NULL,
	CONSTRAINT "limecab_freight_carrier_invite_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "limecab_freight_carrier_invite" ADD CONSTRAINT "limecab_freight_carrier_invite_carrierId_limecab_freight_carrier_id_fk" FOREIGN KEY ("carrierId") REFERENCES "public"."limecab_freight_carrier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_carrier_invite" ADD CONSTRAINT "limecab_freight_carrier_invite_createdByUserId_limecab_user_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."limecab_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_carrier_invite" ADD CONSTRAINT "limecab_freight_carrier_invite_acceptedByUserId_limecab_user_id_fk" FOREIGN KEY ("acceptedByUserId") REFERENCES "public"."limecab_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "limecab_freight_carrier_invite_carrier_idx" ON "limecab_freight_carrier_invite" USING btree ("carrierId");