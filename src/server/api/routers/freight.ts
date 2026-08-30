import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import {
  ACCESSORIAL_TYPES,
  type AccessorialType,
} from "@/lib/freight/accessorial-state";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/freight/document-state";
import {
  deadheadMeters,
  ratePerMile,
} from "@/lib/freight/economics";
import {
  ACTION_TARGET,
  canTransition,
  carrierMay,
  shipperMay,
  type DriverAction,
  type LoadStatus,
} from "@/lib/freight/load-state";
import { deterministicPricingEngine } from "@/lib/freight/pricing";
import { rankLoads } from "@/lib/freight/recommendations";
import { EQUIPMENT_TYPES } from "@/lib/freight/types";
import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import {
  freightAccessorialRequests,
  freightCarrierMembers,
  freightDocuments,
  freightDriverAssignments,
  freightExceptions,
  freightLoads,
  freightQuotes,
  freightSavedLanes,
  freightStops,
  freightTrackingPings,
  freightVehicles,
  users,
} from "@/server/db/schema";
import { assertDriverAdvance, assertSystemComplete, stopTouchForAction } from "@/server/freight/advance";
import {
  capabilitiesForRole,
  getAllCarrierMemberships,
  getCarrierMembership,
  loadById,
  requireCarrierAccess,
  requireDriverAssigned,
  requireShipperOwnsLoad,
} from "@/server/freight/authz";
import { bookLoadExclusive } from "@/server/freight/booking";
import { createSimulatedSettlement } from "@/server/freight/settlement";

const equipmentZod = z.enum(EQUIPMENT_TYPES);
const driverActionZod = z.enum([
  "en_route_pickup",
  "arrive_pickup",
  "start_loading",
  "depart_pickup",
  "arrive_delivery",
  "start_unloading",
  "finish_delivery",
  "submit_pod",
  "report_exception",
]);

const stopInput = z.object({
  address: z.string().min(1).max(512),
  city: z.string().min(1).max(128),
  region: z.string().min(1).max(64),
  lat: z.number().finite(),
  lng: z.number().finite(),
  appointmentStart: z.date().optional(),
  appointmentEnd: z.date().optional(),
  instructions: z.string().max(2000).optional(),
  facilityId: z.string().optional(),
});

const QUOTE_TTL_MS = 24 * 60 * 60 * 1000;

function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  return Math.round(deadheadMeters(aLat, aLng, bLat, bLng));
}

async function completeAfterPod(
  database: typeof import("@/server/db").db,
  load: typeof freightLoads.$inferSelect,
) {
  const to = assertSystemComplete(load.status as LoadStatus);
  const docs = await database.query.freightDocuments.findMany({
    where: and(
      eq(freightDocuments.loadId, load.id),
      eq(freightDocuments.type, "POD"),
    ),
  });
  const hasPod = docs.some(
    (d) => d.status === "UPLOADED" || d.status === "VERIFIED",
  );
  await createSimulatedSettlement(database, load, hasPod);

  const now = new Date();
  const [done] = await database
    .update(freightLoads)
    .set({ status: to, completedAt: now })
    .where(
      and(eq(freightLoads.id, load.id), eq(freightLoads.status, "POD_PENDING")),
    )
    .returning();
  return done ?? load;
}

export const freightRouter = createTRPCRouter({
  perspective: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const memberships = await getAllCarrierMemberships(ctx.db, userId);
    const isDriver = memberships.some((m) => m.role === "DRIVER");
    return {
      shipper: true,
      carrierMemberships: memberships.map((m) => ({
        ...m,
        capabilities: capabilitiesForRole(m.role),
      })),
      isDriver,
    };
  }),

  createDraft: protectedProcedure
    .input(
      z.object({
        pickup: stopInput,
        delivery: stopInput,
        equipmentType: equipmentZod,
        weightLb: z.number().int().positive(),
        commodity: z.string().max(255).optional(),
        simulated: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const distanceMeters = haversineMeters(
        input.pickup.lat,
        input.pickup.lng,
        input.delivery.lat,
        input.delivery.lng,
      );

      const [load] = await ctx.db
        .insert(freightLoads)
        .values({
          shipperUserId: userId,
          status: "DRAFT",
          equipmentType: input.equipmentType,
          commodity: input.commodity ?? null,
          totalWeight: input.weightLb,
          distanceMeters,
          shipperPriceMinor: 0,
          carrierRateMinor: 0,
          simulated: input.simulated ?? true,
        })
        .returning();
      if (!load) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await ctx.db.insert(freightStops).values([
        {
          loadId: load.id,
          sequence: 0,
          type: "PICKUP",
          address: input.pickup.address,
          city: input.pickup.city,
          region: input.pickup.region,
          lat: input.pickup.lat,
          lng: input.pickup.lng,
          appointmentStart: input.pickup.appointmentStart ?? null,
          appointmentEnd: input.pickup.appointmentEnd ?? null,
          instructions: input.pickup.instructions ?? null,
          facilityId: input.pickup.facilityId ?? null,
        },
        {
          loadId: load.id,
          sequence: 1,
          type: "DROPOFF",
          address: input.delivery.address,
          city: input.delivery.city,
          region: input.delivery.region,
          lat: input.delivery.lat,
          lng: input.delivery.lng,
          appointmentStart: input.delivery.appointmentStart ?? null,
          appointmentEnd: input.delivery.appointmentEnd ?? null,
          instructions: input.delivery.instructions ?? null,
          facilityId: input.delivery.facilityId ?? null,
        },
      ]);

      return load;
    }),

  getQuote: protectedProcedure
    .input(z.object({ loadId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const load = await loadById(ctx.db, input.loadId);
      requireShipperOwnsLoad(load, userId);

      if (load.status !== "DRAFT" && load.status !== "QUOTE_PENDING") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot quote from ${load.status}.`,
        });
      }

      const stops = await ctx.db.query.freightStops.findMany({
        where: eq(freightStops.loadId, load.id),
        orderBy: (s, { asc }) => [asc(s.sequence)],
      });
      const pickup = stops.find((s) => s.type === "PICKUP");
      const delivery = stops.find((s) => s.type === "DROPOFF");
      if (!pickup || !delivery) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Pickup and delivery stops required.",
        });
      }

      const distanceMeters = haversineMeters(
        pickup.lat,
        pickup.lng,
        delivery.lat,
        delivery.lng,
      );
      const pickupAt = pickup.appointmentStart ?? new Date();
      const priced = deterministicPricingEngine.quote({
        distanceMeters,
        equipmentType: load.equipmentType,
        weightLb: load.totalWeight,
        pickupAt,
      });

      if (load.status === "DRAFT") {
        if (!shipperMay("DRAFT", "request_quote")) {
          throw new TRPCError({ code: "PRECONDITION_FAILED" });
        }
        await ctx.db
          .update(freightLoads)
          .set({ status: ACTION_TARGET.request_quote })
          .where(and(eq(freightLoads.id, load.id), eq(freightLoads.status, "DRAFT")));
      }

      const now = new Date();
      const [quote] = await ctx.db
        .insert(freightQuotes)
        .values({
          loadId: load.id,
          amountMinor: priced.shipperAmountMinor,
          currency: priced.currency,
          equipmentType: load.equipmentType,
          expiresAt: new Date(now.getTime() + QUOTE_TTL_MS),
          pricingVersion: priced.pricingVersion,
          distanceComponent: priced.components.distanceMinor,
          equipmentComponent: priced.components.equipmentAdjMinor,
          marketAdjustment: priced.components.marketAdjustmentMinor,
          accessorialEstimate: 0,
          status: "ACTIVE",
        })
        .returning();

      const [quoted] = await ctx.db
        .update(freightLoads)
        .set({
          status: "QUOTED",
          distanceMeters,
          shipperPriceMinor: priced.shipperAmountMinor,
          carrierRateMinor: priced.carrierRateMinor,
          currency: priced.currency,
          quotedAt: now,
        })
        .where(
          and(
            eq(freightLoads.id, load.id),
            inArray(freightLoads.status, ["DRAFT", "QUOTE_PENDING"]),
          ),
        )
        .returning();

      if (!quoted) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Load status changed during quote.",
        });
      }

      return { load: quoted, quote };
    }),

  publishShipment: protectedProcedure
    .input(z.object({ loadId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const load = await loadById(ctx.db, input.loadId);
      requireShipperOwnsLoad(load, userId);

      if (!shipperMay(load.status as LoadStatus, "publish")) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot publish from ${load.status}.`,
        });
      }
      const to = ACTION_TARGET.publish;
      if (!canTransition(load.status as LoadStatus, to)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED" });
      }

      const [published] = await ctx.db
        .update(freightLoads)
        .set({ status: to })
        .where(
          and(eq(freightLoads.id, load.id), eq(freightLoads.status, "QUOTED")),
        )
        .returning();

      if (!published) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Load no longer QUOTED.",
        });
      }

      await ctx.db
        .update(freightQuotes)
        .set({ status: "ACCEPTED" })
        .where(
          and(
            eq(freightQuotes.loadId, load.id),
            eq(freightQuotes.status, "ACTIVE"),
          ),
        );

      return published;
    }),

  /** UX alias — same as publishShipment (shipper publish, not carrier book). */
  bookShipment: protectedProcedure
    .input(z.object({ loadId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Delegate via same logic path — call publish by reusing update.
      const userId = ctx.session.user.id;
      const load = await loadById(ctx.db, input.loadId);
      requireShipperOwnsLoad(load, userId);
      if (!shipperMay(load.status as LoadStatus, "publish")) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot publish from ${load.status}.`,
        });
      }
      const [published] = await ctx.db
        .update(freightLoads)
        .set({ status: ACTION_TARGET.publish })
        .where(
          and(eq(freightLoads.id, load.id), eq(freightLoads.status, "QUOTED")),
        )
        .returning();
      if (!published) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Load no longer QUOTED.",
        });
      }
      return published;
    }),

  myShipments: protectedProcedure
    .input(
      z
        .object({
          status: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const loads = await ctx.db.query.freightLoads.findMany({
        where: input?.status
          ? and(
              eq(freightLoads.shipperUserId, userId),
              eq(freightLoads.status, input.status as LoadStatus),
            )
          : eq(freightLoads.shipperUserId, userId),
        with: { stops: true },
        orderBy: [desc(freightLoads.createdAt)],
      });
      return loads;
    }),

  getLoad: protectedProcedure
    .input(z.object({ loadId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const load = await ctx.db.query.freightLoads.findFirst({
        where: eq(freightLoads.id, input.loadId),
        with: {
          stops: { with: { facility: true } },
          quotes: true,
          documents: true,
          driverAssignments: true,
          accessorials: true,
          exceptions: true,
        },
      });
      if (!load) throw new TRPCError({ code: "NOT_FOUND" });

      if (load.shipperUserId === userId) return load;

      const membership = await getCarrierMembership(
        ctx.db,
        userId,
        load.carrierId ?? undefined,
      );
      if (load.status === "AVAILABLE") {
        const any = await getCarrierMembership(ctx.db, userId);
        if (any) return load;
      } else if (membership && load.carrierId === membership.carrierId) {
        return load;
      } else if (load.assignedDriverUserId === userId) {
        return load;
      }

      throw new TRPCError({ code: "FORBIDDEN" });
    }),

  searchLoads: protectedProcedure
    .input(
      z.object({
        originLat: z.number().finite(),
        originLng: z.number().finite(),
        radiusMeters: z.number().positive(),
        destLat: z.number().finite().optional(),
        destLng: z.number().finite().optional(),
        equipmentType: equipmentZod.optional(),
        pickupDate: z.date().optional(),
        minRateMinor: z.number().int().optional(),
        minRpm: z.number().optional(),
        maxDeadheadMeters: z.number().positive().optional(),
        vehicleEquipment: equipmentZod.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const membership = await getCarrierMembership(ctx.db, ctx.session.user.id);
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Carrier membership required.",
        });
      }

      const available = await ctx.db.query.freightLoads.findMany({
        where: and(
          eq(freightLoads.status, "AVAILABLE"),
          isNull(freightLoads.carrierId),
        ),
        with: { stops: true },
      });

      const now = new Date();
      type Candidate = {
        id: string;
        equipmentType: (typeof EQUIPMENT_TYPES)[number];
        carrierRateMinor: number;
        distanceMeters: number;
        pickupLat: number;
        pickupLng: number;
        pickupAt: Date;
        deadheadMeters: number;
        rpmMinor: number;
        load: (typeof available)[number];
      };
      const candidates: Candidate[] = [];
      for (const load of available) {
        if (
          input.equipmentType &&
          load.equipmentType !== input.equipmentType
        ) {
          continue;
        }
        if (
          input.minRateMinor != null &&
          load.carrierRateMinor < input.minRateMinor
        ) {
          continue;
        }
        const pickup = load.stops.find((s) => s.type === "PICKUP");
        const delivery = load.stops.find((s) => s.type === "DROPOFF");
        if (!pickup) continue;

        const dh = deadheadMeters(
          input.originLat,
          input.originLng,
          pickup.lat,
          pickup.lng,
        );
        if (dh > input.radiusMeters) continue;
        if (
          input.maxDeadheadMeters != null &&
          dh > input.maxDeadheadMeters
        ) {
          continue;
        }

        if (input.destLat != null && input.destLng != null && delivery) {
          const destDh = deadheadMeters(
            delivery.lat,
            delivery.lng,
            input.destLat,
            input.destLng,
          );
          if (destDh > input.radiusMeters) continue;
        }

        if (input.pickupDate && pickup.appointmentStart) {
          const day = input.pickupDate.toISOString().slice(0, 10);
          const appt = pickup.appointmentStart.toISOString().slice(0, 10);
          if (day !== appt) continue;
        }

        const rpm = ratePerMile(load.carrierRateMinor, load.distanceMeters);
        if (input.minRpm != null && rpm < input.minRpm) continue;

        candidates.push({
          id: load.id,
          equipmentType: load.equipmentType,
          carrierRateMinor: load.carrierRateMinor,
          distanceMeters: load.distanceMeters,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          pickupAt: pickup.appointmentStart ?? load.createdAt,
          deadheadMeters: Math.round(dh),
          rpmMinor: rpm,
          load,
        });
      }

      const ranked = rankLoads(
        candidates,
        {
          vehicleEquipment:
            input.vehicleEquipment ?? input.equipmentType ?? "DRY_VAN",
          vehicleLat: input.originLat,
          vehicleLng: input.originLng,
          now,
        },
      );

      return ranked.map((r) => {
        const c = candidates.find((x) => x.id === r.id)!;
        return {
          ...r,
          deadheadMeters: c.deadheadMeters,
          load: c.load,
        };
      });
    }),

  bookLoad: protectedProcedure
    .input(
      z.object({
        loadId: z.string().min(1),
        carrierId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const membership = input.carrierId
        ? await getCarrierMembership(ctx.db, userId, input.carrierId)
        : await getCarrierMembership(ctx.db, userId);
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Carrier membership required.",
        });
      }
      const caps = capabilitiesForRole(membership.role);
      if (!caps.canBook) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Role cannot book loads.",
        });
      }

      const load = await loadById(ctx.db, input.loadId);
      requireCarrierAccess(load, membership);
      if (!carrierMay(load.status as LoadStatus, "book")) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot book from ${load.status}.`,
        });
      }

      const result = await bookLoadExclusive(
        ctx.db,
        input.loadId,
        membership.carrierId,
      );
      if (!result.ok) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That load is no longer available.",
        });
      }
      return result.load;
    }),

  myLoads: protectedProcedure
    .input(
      z
        .object({
          status: z.string().optional(),
          carrierId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const membership = input?.carrierId
        ? await getCarrierMembership(
            ctx.db,
            ctx.session.user.id,
            input.carrierId,
          )
        : await getCarrierMembership(ctx.db, ctx.session.user.id);
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Carrier membership required.",
        });
      }

      return ctx.db.query.freightLoads.findMany({
        where: input?.status
          ? and(
              eq(freightLoads.carrierId, membership.carrierId),
              eq(freightLoads.status, input.status as LoadStatus),
            )
          : eq(freightLoads.carrierId, membership.carrierId),
        with: { stops: true },
        orderBy: [desc(freightLoads.updatedAt), desc(freightLoads.createdAt)],
      });
    }),

  assignDriver: protectedProcedure
    .input(
      z.object({
        loadId: z.string().min(1),
        driverUserId: z.string().min(1),
        vehicleId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const load = await loadById(ctx.db, input.loadId);
      if (!load.carrierId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Load has no carrier.",
        });
      }

      const membership = await getCarrierMembership(
        ctx.db,
        userId,
        load.carrierId,
      );
      requireCarrierAccess(load, membership);
      if (!membership || !capabilitiesForRole(membership.role).canAssign) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Role cannot assign drivers.",
        });
      }
      if (!carrierMay(load.status as LoadStatus, "assign_driver")) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot assign from ${load.status}.`,
        });
      }

      const driverMember = await getCarrierMembership(
        ctx.db,
        input.driverUserId,
        load.carrierId,
      );
      if (!driverMember) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Driver is not a carrier member.",
        });
      }
      if (
        driverMember.role !== "DRIVER" &&
        driverMember.role !== "OWNER"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Target user is not a driver role.",
        });
      }

      const vehicle = await ctx.db.query.freightVehicles.findFirst({
        where: and(
          eq(freightVehicles.id, input.vehicleId),
          eq(freightVehicles.carrierId, load.carrierId),
        ),
      });
      if (!vehicle) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Vehicle not found." });
      }
      if (vehicle.equipmentType !== load.equipmentType) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Vehicle equipment mismatch.",
        });
      }

      const to = ACTION_TARGET.assign_driver;
      const [updated] = await ctx.db
        .update(freightLoads)
        .set({
          status: to,
          assignedDriverUserId: input.driverUserId,
          assignedVehicleId: input.vehicleId,
        })
        .where(
          and(eq(freightLoads.id, load.id), eq(freightLoads.status, "BOOKED")),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Load no longer BOOKED.",
        });
      }

      await ctx.db.insert(freightDriverAssignments).values({
        loadId: load.id,
        driverUserId: input.driverUserId,
        vehicleId: input.vehicleId,
      });

      return updated;
    }),

  suggestReturnLoads: protectedProcedure
    .input(
      z.object({
        loadId: z.string().min(1),
        radiusMeters: z.number().positive().default(160_934),
      }),
    )
    .query(async ({ ctx, input }) => {
      const membership = await getCarrierMembership(ctx.db, ctx.session.user.id);
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const load = await ctx.db.query.freightLoads.findFirst({
        where: eq(freightLoads.id, input.loadId),
        with: { stops: true },
      });
      if (!load) throw new TRPCError({ code: "NOT_FOUND" });
      requireCarrierAccess(load, membership);

      const delivery = load.stops.find((s) => s.type === "DROPOFF");
      if (!delivery) return [];

      const available = await ctx.db.query.freightLoads.findMany({
        where: and(
          eq(freightLoads.status, "AVAILABLE"),
          isNull(freightLoads.carrierId),
          sql`${freightLoads.id} <> ${input.loadId}`,
        ),
        with: { stops: true },
      });

      return available.filter((cand) => {
        const pickup = cand.stops.find((s) => s.type === "PICKUP");
        if (!pickup) return false;
        return (
          deadheadMeters(
            delivery.lat,
            delivery.lng,
            pickup.lat,
            pickup.lng,
          ) <= input.radiusMeters
        );
      });
    }),

  driverCurrent: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    return ctx.db.query.freightLoads.findMany({
      where: and(
        eq(freightLoads.assignedDriverUserId, userId),
        sql`${freightLoads.status} NOT IN ('COMPLETED', 'CANCELED', 'REJECTED')`,
      ),
      with: { stops: true },
      orderBy: [desc(freightLoads.updatedAt)],
    });
  }),

  advance: protectedProcedure
    .input(
      z.object({
        loadId: z.string().min(1),
        action: driverActionZod,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const load = await loadById(ctx.db, input.loadId);
      requireDriverAssigned(load, userId);

      const action = input.action as DriverAction;
      if (action === "submit_pod") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use submitPod for proof of delivery.",
        });
      }
      if (action === "report_exception") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use reportException.",
        });
      }

      const to = assertDriverAdvance(load.status as LoadStatus, action);
      const now = new Date();

      const [advanced] = await ctx.db
        .update(freightLoads)
        .set({
          status: to,
          ...(action === "depart_pickup" ? { pickedUpAt: now } : {}),
          ...(action === "finish_delivery" ? { deliveredAt: now } : {}),
        })
        .where(
          and(
            eq(freightLoads.id, load.id),
            eq(freightLoads.assignedDriverUserId, userId),
            eq(freightLoads.status, load.status),
          ),
        )
        .returning();

      if (!advanced) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Load status changed.",
        });
      }

      const touch = stopTouchForAction(action);
      if (touch) {
        await ctx.db
          .update(freightStops)
          .set({ [touch.field]: now })
          .where(
            and(
              eq(freightStops.loadId, load.id),
              eq(freightStops.sequence, touch.sequence),
            ),
          );
      }

      return advanced;
    }),

  submitPod: protectedProcedure
    .input(
      z.object({
        loadId: z.string().min(1),
        storageReference: z.string().min(1).max(512),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const load = await loadById(ctx.db, input.loadId);
      requireDriverAssigned(load, userId);

      const toPod = assertDriverAdvance(
        load.status as LoadStatus,
        "submit_pod",
      );

      await ctx.db.insert(freightDocuments).values({
        loadId: load.id,
        type: "POD",
        uploadedByUserId: userId,
        storageReference: input.storageReference,
        status: "UPLOADED",
      });

      const [pending] = await ctx.db
        .update(freightLoads)
        .set({ status: toPod })
        .where(
          and(
            eq(freightLoads.id, load.id),
            eq(freightLoads.status, "DELIVERED"),
            eq(freightLoads.assignedDriverUserId, userId),
          ),
        )
        .returning();

      if (!pending) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Load no longer DELIVERED.",
        });
      }

      const completed = await completeAfterPod(ctx.db, pending);
      return completed;
    }),

  pingLocation: protectedProcedure
    .input(
      z.object({
        loadId: z.string().min(1),
        lat: z.number().finite(),
        lng: z.number().finite(),
        timestamp: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const load = await loadById(ctx.db, input.loadId);
      requireDriverAssigned(load, userId);

      const [ping] = await ctx.db
        .insert(freightTrackingPings)
        .values({
          loadId: load.id,
          lat: input.lat,
          lng: input.lng,
          timestamp: input.timestamp ?? new Date(),
          source: "DRIVER_APP",
        })
        .returning();
      return ping;
    }),

  requestAccessorial: protectedProcedure
    .input(
      z.object({
        loadId: z.string().min(1),
        type: z.enum(ACCESSORIAL_TYPES),
        amountMinor: z.number().int().optional(),
        notes: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const load = await loadById(ctx.db, input.loadId);
      if (!load.carrierId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Load has no carrier.",
        });
      }
      const membership = await getCarrierMembership(
        ctx.db,
        userId,
        load.carrierId,
      );
      requireCarrierAccess(load, membership);

      const [row] = await ctx.db
        .insert(freightAccessorialRequests)
        .values({
          loadId: load.id,
          carrierId: load.carrierId,
          type: input.type as AccessorialType,
          amountMinor: input.amountMinor ?? null,
          notes: input.notes ?? null,
          status: "REQUESTED",
        })
        .returning();
      return row;
    }),

  reportException: protectedProcedure
    .input(
      z.object({
        loadId: z.string().min(1),
        type: z.string().min(1).max(64),
        notes: z.string().max(2000).optional(),
        /** When true, also move load → EXCEPTION if driverMay allows. */
        transitionLoad: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const load = await loadById(ctx.db, input.loadId);

      const isShipper = load.shipperUserId === userId;
      const isDriver = load.assignedDriverUserId === userId;
      const membership = load.carrierId
        ? await getCarrierMembership(ctx.db, userId, load.carrierId)
        : null;
      if (!isShipper && !isDriver && !membership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [row] = await ctx.db
        .insert(freightExceptions)
        .values({
          loadId: load.id,
          type: input.type,
          reportedByUserId: userId,
          notes: input.notes ?? null,
          status: "OPEN",
        })
        .returning();

      // Do not force illegal transitions — only when explicitly requested + legal.
      if (input.transitionLoad && isDriver) {
        try {
          const to = assertDriverAdvance(
            load.status as LoadStatus,
            "report_exception",
          );
          await ctx.db
            .update(freightLoads)
            .set({ status: to })
            .where(
              and(
                eq(freightLoads.id, load.id),
                eq(freightLoads.status, load.status),
              ),
            );
        } catch {
          // leave load status; exception row still recorded
        }
      }

      return row;
    }),

  uploadDocument: protectedProcedure
    .input(
      z.object({
        loadId: z.string().min(1),
        type: z.enum(DOCUMENT_TYPES),
        storageReference: z.string().min(1).max(512),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const load = await loadById(ctx.db, input.loadId);

      const isShipper = load.shipperUserId === userId;
      const isDriver = load.assignedDriverUserId === userId;
      const membership = load.carrierId
        ? await getCarrierMembership(ctx.db, userId, load.carrierId)
        : load.status === "AVAILABLE"
          ? await getCarrierMembership(ctx.db, userId)
          : null;
      if (!isShipper && !isDriver && !membership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [doc] = await ctx.db
        .insert(freightDocuments)
        .values({
          loadId: load.id,
          type: input.type as DocumentType,
          uploadedByUserId: userId,
          storageReference: input.storageReference,
          status: "UPLOADED",
        })
        .returning();
      return doc;
    }),

  /** Saved lanes for the carrier portal. */
  listSavedLanes: protectedProcedure.query(async ({ ctx }) => {
    const membership = await getCarrierMembership(ctx.db, ctx.session.user.id);
    if (!membership) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Carrier membership required." });
    }
    return ctx.db.query.freightSavedLanes.findMany({
      where: and(
        eq(freightSavedLanes.carrierId, membership.carrierId),
        eq(freightSavedLanes.active, true),
      ),
    });
  }),

  saveLane: protectedProcedure
    .input(
      z.object({
        originLabel: z.string().min(1).max(255),
        destLabel: z.string().min(1).max(255),
        originLat: z.number().finite(),
        originLng: z.number().finite(),
        destLat: z.number().finite(),
        destLng: z.number().finite(),
        equipmentTypes: z.array(equipmentZod).min(1),
        radiusMeters: z.number().int().positive().default(80_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const membership = await getCarrierMembership(ctx.db, ctx.session.user.id);
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Carrier membership required." });
      }
      const [lane] = await ctx.db
        .insert(freightSavedLanes)
        .values({
          carrierId: membership.carrierId,
          originLabel: input.originLabel,
          destLabel: input.destLabel,
          originLat: input.originLat,
          originLng: input.originLng,
          destLat: input.destLat,
          destLng: input.destLng,
          equipmentTypes: JSON.stringify(input.equipmentTypes),
          radiusMeters: input.radiusMeters,
          active: true,
        })
        .returning();
      return lane;
    }),

  deactivateLane: protectedProcedure
    .input(z.object({ laneId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const membership = await getCarrierMembership(ctx.db, ctx.session.user.id);
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const [updated] = await ctx.db
        .update(freightSavedLanes)
        .set({ active: false })
        .where(
          and(
            eq(freightSavedLanes.id, input.laneId),
            eq(freightSavedLanes.carrierId, membership.carrierId),
          ),
        )
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  listFleet: protectedProcedure.query(async ({ ctx }) => {
    const membership = await getCarrierMembership(ctx.db, ctx.session.user.id);
    if (!membership) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Carrier membership required." });
    }
    const members = await ctx.db.query.freightCarrierMembers.findMany({
      where: eq(freightCarrierMembers.carrierId, membership.carrierId),
      with: { user: { columns: { id: true, name: true, email: true } } },
    });
    const vehicles = await ctx.db.query.freightVehicles.findMany({
      where: eq(freightVehicles.carrierId, membership.carrierId),
    });
    return { members, vehicles, carrierId: membership.carrierId };
  }),

  addFleetMember: protectedProcedure
    .input(
      z.object({
        email: z.string().email().max(255),
        role: z.enum(["OWNER", "DISPATCHER", "DRIVER"]),
        name: z.string().min(1).max(128).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const membership = await getCarrierMembership(ctx.db, ctx.session.user.id);
      if (!membership || !capabilitiesForRole(membership.role).canManageFleet) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the carrier owner can add members.",
        });
      }
      if (input.role === "OWNER") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot add another OWNER this way.",
        });
      }

      let user = await ctx.db.query.users.findFirst({
        where: eq(users.email, input.email),
      });
      if (!user) {
        const [created] = await ctx.db
          .insert(users)
          .values({
            name: input.name ?? input.email.split("@")[0] ?? "Fleet member",
            email: input.email,
          })
          .returning();
        user = created;
      }
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const existing = await getCarrierMembership(
        ctx.db,
        user.id,
        membership.carrierId,
      );
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Already a member of this carrier.",
        });
      }

      const [row] = await ctx.db
        .insert(freightCarrierMembers)
        .values({
          carrierId: membership.carrierId,
          userId: user.id,
          role: input.role,
        })
        .returning();
      return row;
    }),

  removeFleetMember: protectedProcedure
    .input(z.object({ memberId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const membership = await getCarrierMembership(ctx.db, ctx.session.user.id);
      if (!membership || !capabilitiesForRole(membership.role).canManageFleet) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const target = await ctx.db.query.freightCarrierMembers.findFirst({
        where: and(
          eq(freightCarrierMembers.id, input.memberId),
          eq(freightCarrierMembers.carrierId, membership.carrierId),
        ),
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      if (target.role === "OWNER") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot remove the owner.",
        });
      }
      await ctx.db
        .delete(freightCarrierMembers)
        .where(eq(freightCarrierMembers.id, input.memberId));
      return { ok: true as const };
    }),
});
