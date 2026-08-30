CREATE TABLE "limecab_freight_settlement" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"loadId" varchar(255) NOT NULL,
	"carrierId" varchar(255) NOT NULL,
	"amountMinor" integer NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"simulated" boolean NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	CONSTRAINT "limecab_freight_settlement_load_unique" UNIQUE("loadId")
);
--> statement-breakpoint
ALTER TABLE "limecab_freight_settlement" ADD CONSTRAINT "limecab_freight_settlement_loadId_limecab_freight_load_id_fk" FOREIGN KEY ("loadId") REFERENCES "public"."limecab_freight_load"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_settlement" ADD CONSTRAINT "limecab_freight_settlement_carrierId_limecab_freight_carrier_id_fk" FOREIGN KEY ("carrierId") REFERENCES "public"."limecab_freight_carrier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "limecab_freight_settlement_carrier_idx" ON "limecab_freight_settlement" USING btree ("carrierId");