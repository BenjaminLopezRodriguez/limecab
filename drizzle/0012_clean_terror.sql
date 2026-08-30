CREATE TABLE "limecab_freight_accessorial_request" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"loadId" varchar(255) NOT NULL,
	"carrierId" varchar(255) NOT NULL,
	"type" varchar(32) NOT NULL,
	"amountMinor" integer,
	"notes" text,
	"documentId" varchar(255),
	"status" varchar(16) DEFAULT 'REQUESTED' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "limecab_freight_bid" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"loadId" varchar(255) NOT NULL,
	"carrierId" varchar(255) NOT NULL,
	"amountMinor" integer NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"status" varchar(16) DEFAULT 'OPEN' NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "limecab_freight_carrier_member" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"carrierId" varchar(255) NOT NULL,
	"userId" varchar(255) NOT NULL,
	"role" varchar(16) NOT NULL,
	CONSTRAINT "limecab_freight_carrier_member_unique" UNIQUE("carrierId","userId")
);
--> statement-breakpoint
CREATE TABLE "limecab_freight_carrier" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"organizationName" varchar(255),
	"simulated" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "limecab_freight_document" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"loadId" varchar(255) NOT NULL,
	"type" varchar(32) NOT NULL,
	"uploadedByUserId" varchar(255) NOT NULL,
	"storageReference" varchar(512) NOT NULL,
	"status" varchar(16) DEFAULT 'PENDING' NOT NULL,
	"verifiedAt" timestamp with time zone,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "limecab_freight_driver_assignment" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"loadId" varchar(255) NOT NULL,
	"driverUserId" varchar(255) NOT NULL,
	"vehicleId" varchar(255),
	"assignedAt" timestamp with time zone NOT NULL,
	"releasedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "limecab_freight_exception" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"loadId" varchar(255) NOT NULL,
	"type" varchar(64) NOT NULL,
	"reportedByUserId" varchar(255) NOT NULL,
	"notes" text,
	"status" varchar(16) DEFAULT 'OPEN' NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "limecab_freight_facility" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(32) NOT NULL,
	"address" varchar(512) NOT NULL,
	"city" varchar(128) NOT NULL,
	"region" varchar(64) NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"placeId" varchar(255),
	"h3" varchar(16),
	"notes" text,
	"parking" boolean DEFAULT false NOT NULL,
	"restroom" boolean DEFAULT false NOT NULL,
	"scale" boolean DEFAULT false NOT NULL,
	"appointmentRequired" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "limecab_freight_facility_rating" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"facilityId" varchar(255) NOT NULL,
	"userId" varchar(255) NOT NULL,
	"rating" integer NOT NULL,
	"tags" text,
	"comment" varchar(1000),
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "limecab_freight_load" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"shipperUserId" varchar(255) NOT NULL,
	"carrierId" varchar(255),
	"assignedDriverUserId" varchar(255),
	"assignedVehicleId" varchar(255),
	"status" varchar(32) DEFAULT 'DRAFT' NOT NULL,
	"mode" varchar(8) DEFAULT 'FTL' NOT NULL,
	"equipmentType" varchar(16) NOT NULL,
	"commodity" varchar(255),
	"totalWeight" integer NOT NULL,
	"weightUnit" varchar(8) DEFAULT 'LB' NOT NULL,
	"pallets" integer,
	"pieces" integer,
	"distanceMeters" integer NOT NULL,
	"estimatedDurationSec" integer,
	"shipperPriceMinor" integer NOT NULL,
	"carrierRateMinor" integer NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"bookingMode" varchar(16) DEFAULT 'INSTANT' NOT NULL,
	"specialRequirements" text,
	"simulated" boolean NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"quotedAt" timestamp with time zone,
	"bookedAt" timestamp with time zone,
	"pickedUpAt" timestamp with time zone,
	"deliveredAt" timestamp with time zone,
	"completedAt" timestamp with time zone,
	"canceledAt" timestamp with time zone,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "limecab_freight_quote" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"loadId" varchar(255) NOT NULL,
	"amountMinor" integer NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"equipmentType" varchar(16) NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"pricingVersion" varchar(32) NOT NULL,
	"distanceComponent" integer NOT NULL,
	"equipmentComponent" integer NOT NULL,
	"marketAdjustment" integer,
	"accessorialEstimate" integer,
	"status" varchar(16) DEFAULT 'PENDING' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "limecab_freight_saved_lane" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"carrierId" varchar(255) NOT NULL,
	"originLabel" varchar(255) NOT NULL,
	"destLabel" varchar(255) NOT NULL,
	"originLat" double precision NOT NULL,
	"originLng" double precision NOT NULL,
	"destLat" double precision NOT NULL,
	"destLng" double precision NOT NULL,
	"equipmentTypes" text NOT NULL,
	"radiusMeters" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "limecab_freight_stop" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"loadId" varchar(255) NOT NULL,
	"sequence" integer NOT NULL,
	"type" varchar(16) NOT NULL,
	"facilityId" varchar(255),
	"address" varchar(512) NOT NULL,
	"city" varchar(128) NOT NULL,
	"region" varchar(64) NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"h3" varchar(16),
	"appointmentStart" timestamp with time zone,
	"appointmentEnd" timestamp with time zone,
	"instructions" text,
	"arrivalAt" timestamp with time zone,
	"checkInAt" timestamp with time zone,
	"loadingStartedAt" timestamp with time zone,
	"loadingFinishedAt" timestamp with time zone,
	"departedAt" timestamp with time zone,
	CONSTRAINT "limecab_freight_stop_load_seq_unique" UNIQUE("loadId","sequence")
);
--> statement-breakpoint
CREATE TABLE "limecab_freight_tracking_ping" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"loadId" varchar(255) NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"source" varchar(16) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "limecab_freight_vehicle" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"carrierId" varchar(255) NOT NULL,
	"unitNumber" varchar(64) NOT NULL,
	"equipmentType" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'AVAILABLE' NOT NULL,
	CONSTRAINT "limecab_freight_vehicle_unit_unique" UNIQUE("carrierId","unitNumber")
);
--> statement-breakpoint
ALTER TABLE "limecab_freight_accessorial_request" ADD CONSTRAINT "limecab_freight_accessorial_request_loadId_limecab_freight_load_id_fk" FOREIGN KEY ("loadId") REFERENCES "public"."limecab_freight_load"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_accessorial_request" ADD CONSTRAINT "limecab_freight_accessorial_request_carrierId_limecab_freight_carrier_id_fk" FOREIGN KEY ("carrierId") REFERENCES "public"."limecab_freight_carrier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_accessorial_request" ADD CONSTRAINT "limecab_freight_accessorial_request_documentId_limecab_freight_document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."limecab_freight_document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_bid" ADD CONSTRAINT "limecab_freight_bid_loadId_limecab_freight_load_id_fk" FOREIGN KEY ("loadId") REFERENCES "public"."limecab_freight_load"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_bid" ADD CONSTRAINT "limecab_freight_bid_carrierId_limecab_freight_carrier_id_fk" FOREIGN KEY ("carrierId") REFERENCES "public"."limecab_freight_carrier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_carrier_member" ADD CONSTRAINT "limecab_freight_carrier_member_carrierId_limecab_freight_carrier_id_fk" FOREIGN KEY ("carrierId") REFERENCES "public"."limecab_freight_carrier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_carrier_member" ADD CONSTRAINT "limecab_freight_carrier_member_userId_limecab_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."limecab_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_document" ADD CONSTRAINT "limecab_freight_document_loadId_limecab_freight_load_id_fk" FOREIGN KEY ("loadId") REFERENCES "public"."limecab_freight_load"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_document" ADD CONSTRAINT "limecab_freight_document_uploadedByUserId_limecab_user_id_fk" FOREIGN KEY ("uploadedByUserId") REFERENCES "public"."limecab_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_driver_assignment" ADD CONSTRAINT "limecab_freight_driver_assignment_loadId_limecab_freight_load_id_fk" FOREIGN KEY ("loadId") REFERENCES "public"."limecab_freight_load"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_driver_assignment" ADD CONSTRAINT "limecab_freight_driver_assignment_driverUserId_limecab_user_id_fk" FOREIGN KEY ("driverUserId") REFERENCES "public"."limecab_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_driver_assignment" ADD CONSTRAINT "limecab_freight_driver_assignment_vehicleId_limecab_freight_vehicle_id_fk" FOREIGN KEY ("vehicleId") REFERENCES "public"."limecab_freight_vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_exception" ADD CONSTRAINT "limecab_freight_exception_loadId_limecab_freight_load_id_fk" FOREIGN KEY ("loadId") REFERENCES "public"."limecab_freight_load"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_exception" ADD CONSTRAINT "limecab_freight_exception_reportedByUserId_limecab_user_id_fk" FOREIGN KEY ("reportedByUserId") REFERENCES "public"."limecab_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_facility_rating" ADD CONSTRAINT "limecab_freight_facility_rating_facilityId_limecab_freight_facility_id_fk" FOREIGN KEY ("facilityId") REFERENCES "public"."limecab_freight_facility"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_facility_rating" ADD CONSTRAINT "limecab_freight_facility_rating_userId_limecab_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."limecab_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_load" ADD CONSTRAINT "limecab_freight_load_shipperUserId_limecab_user_id_fk" FOREIGN KEY ("shipperUserId") REFERENCES "public"."limecab_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_load" ADD CONSTRAINT "limecab_freight_load_carrierId_limecab_freight_carrier_id_fk" FOREIGN KEY ("carrierId") REFERENCES "public"."limecab_freight_carrier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_load" ADD CONSTRAINT "limecab_freight_load_assignedDriverUserId_limecab_user_id_fk" FOREIGN KEY ("assignedDriverUserId") REFERENCES "public"."limecab_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_load" ADD CONSTRAINT "limecab_freight_load_assignedVehicleId_limecab_freight_vehicle_id_fk" FOREIGN KEY ("assignedVehicleId") REFERENCES "public"."limecab_freight_vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_quote" ADD CONSTRAINT "limecab_freight_quote_loadId_limecab_freight_load_id_fk" FOREIGN KEY ("loadId") REFERENCES "public"."limecab_freight_load"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_saved_lane" ADD CONSTRAINT "limecab_freight_saved_lane_carrierId_limecab_freight_carrier_id_fk" FOREIGN KEY ("carrierId") REFERENCES "public"."limecab_freight_carrier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_stop" ADD CONSTRAINT "limecab_freight_stop_loadId_limecab_freight_load_id_fk" FOREIGN KEY ("loadId") REFERENCES "public"."limecab_freight_load"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_stop" ADD CONSTRAINT "limecab_freight_stop_facilityId_limecab_freight_facility_id_fk" FOREIGN KEY ("facilityId") REFERENCES "public"."limecab_freight_facility"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_tracking_ping" ADD CONSTRAINT "limecab_freight_tracking_ping_loadId_limecab_freight_load_id_fk" FOREIGN KEY ("loadId") REFERENCES "public"."limecab_freight_load"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "limecab_freight_vehicle" ADD CONSTRAINT "limecab_freight_vehicle_carrierId_limecab_freight_carrier_id_fk" FOREIGN KEY ("carrierId") REFERENCES "public"."limecab_freight_carrier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "limecab_freight_accessorial_load_idx" ON "limecab_freight_accessorial_request" USING btree ("loadId");--> statement-breakpoint
CREATE INDEX "limecab_freight_bid_load_idx" ON "limecab_freight_bid" USING btree ("loadId");--> statement-breakpoint
CREATE INDEX "limecab_freight_bid_carrier_idx" ON "limecab_freight_bid" USING btree ("carrierId");--> statement-breakpoint
CREATE INDEX "limecab_freight_carrier_member_user_idx" ON "limecab_freight_carrier_member" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "limecab_freight_document_load_idx" ON "limecab_freight_document" USING btree ("loadId");--> statement-breakpoint
CREATE INDEX "limecab_freight_driver_assignment_load_idx" ON "limecab_freight_driver_assignment" USING btree ("loadId");--> statement-breakpoint
CREATE INDEX "limecab_freight_driver_assignment_driver_idx" ON "limecab_freight_driver_assignment" USING btree ("driverUserId");--> statement-breakpoint
CREATE UNIQUE INDEX "limecab_freight_driver_assignment_active_load_unique" ON "limecab_freight_driver_assignment" USING btree ("loadId") WHERE "limecab_freight_driver_assignment"."releasedAt" is null;--> statement-breakpoint
CREATE INDEX "limecab_freight_exception_load_idx" ON "limecab_freight_exception" USING btree ("loadId");--> statement-breakpoint
CREATE INDEX "limecab_freight_facility_h3_idx" ON "limecab_freight_facility" USING btree ("h3");--> statement-breakpoint
CREATE INDEX "limecab_freight_facility_rating_facility_idx" ON "limecab_freight_facility_rating" USING btree ("facilityId");--> statement-breakpoint
CREATE INDEX "limecab_freight_load_shipper_idx" ON "limecab_freight_load" USING btree ("shipperUserId");--> statement-breakpoint
CREATE INDEX "limecab_freight_load_carrier_idx" ON "limecab_freight_load" USING btree ("carrierId");--> statement-breakpoint
CREATE INDEX "limecab_freight_load_status_idx" ON "limecab_freight_load" USING btree ("status");--> statement-breakpoint
CREATE INDEX "limecab_freight_load_available_idx" ON "limecab_freight_load" USING btree ("status") WHERE "limecab_freight_load"."status" = 'AVAILABLE';--> statement-breakpoint
CREATE INDEX "limecab_freight_load_simulated_idx" ON "limecab_freight_load" USING btree ("simulated") WHERE "limecab_freight_load"."simulated";--> statement-breakpoint
CREATE INDEX "limecab_freight_quote_load_idx" ON "limecab_freight_quote" USING btree ("loadId");--> statement-breakpoint
CREATE INDEX "limecab_freight_saved_lane_carrier_idx" ON "limecab_freight_saved_lane" USING btree ("carrierId");--> statement-breakpoint
CREATE INDEX "limecab_freight_stop_load_idx" ON "limecab_freight_stop" USING btree ("loadId");--> statement-breakpoint
CREATE INDEX "limecab_freight_tracking_load_idx" ON "limecab_freight_tracking_ping" USING btree ("loadId");--> statement-breakpoint
CREATE INDEX "limecab_freight_tracking_load_ts_idx" ON "limecab_freight_tracking_ping" USING btree ("loadId","timestamp");--> statement-breakpoint
CREATE INDEX "limecab_freight_vehicle_carrier_idx" ON "limecab_freight_vehicle" USING btree ("carrierId");