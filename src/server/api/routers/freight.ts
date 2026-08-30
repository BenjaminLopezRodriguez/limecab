import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
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
  freightCarrierInvites,
  freightCarrierMembers,
  freightCarriers,
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
  redactLoadForRole,
  requireCarrierAccess,
  requireDriverAssigned,
  requireShipperOwnsLoad,
} from "@/server/freight/authz";
import { bookLoadExclusive } from "@/server/freight/booking";
import {
  generateInviteCode,
  INVITABLE_ROLES,
  INVITE_REFUSAL_MESSAGE,
  INVITE_TTL_MS,
  inviteRefusal,
  normalizeInviteCode,
  roleGrantLines,
} from "@/server/freight/invite";
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

/**
 * Rate visibility for a road-side caller: OWNER self-driving keeps it,
 * employee DRIVER does not.
 */
async function driverRateViewer(
  database: typeof import("@/server/db").db,
  userId: string,
) {
  const membership = await getCarrierMembership(database, userId);
  return {
    canSeeRate: membership
      ? capabilitiesForRole(membership.role).canSeeRate
      : false,
    isShipper: false,
  };
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

      // Shipper reads their own price only; the carrier rate is not theirs.
      return redactLoadForRole(load, { canSeeRate: false, isShipper: true });
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

      return {
        load: redactLoadForRole(quoted, { canSeeRate: false, isShipper: true }),
        quote,
      };
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

      return redactLoadForRole(published, {
        canSeeRate: false,
        isShipper: true,
      });
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
      return redactLoadForRole(published, {
        canSeeRate: false,
        isShipper: true,
      });
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
      return loads.map((l) =>
        redactLoadForRole(l, { canSeeRate: false, isShipper: true }),
      );
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

      if (load.shipperUserId === userId) {
        return redactLoadForRole(load, { canSeeRate: false, isShipper: true });
      }

      const membership = await getCarrierMembership(
        ctx.db,
        userId,
        load.carrierId ?? undefined,
      );
      const anyMembership =
        membership ?? (await getCarrierMembership(ctx.db, userId));
      // No carrier role reads no money. The branches below still decide
      // whether this viewer reads the load at all.
      const viewer = {
        canSeeRate: anyMembership
          ? capabilitiesForRole(anyMembership.role).canSeeRate
          : false,
        isShipper: false,
      };

      if (load.status === "AVAILABLE") {
        if (anyMembership) return redactLoadForRole(load, viewer);
      } else if (membership && load.carrierId === membership.carrierId) {
        return redactLoadForRole(load, viewer);
      } else if (load.assignedDriverUserId === userId) {
        return redactLoadForRole(load, viewer);
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
      const viewer = {
        canSeeRate: capabilitiesForRole(membership.role).canSeeRate,
        isShipper: false,
      };

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
        // A numeric filter over a hidden number is an oracle for it, so a
        // viewer without canSeeRate does not get to bisect the rate.
        if (
          viewer.canSeeRate &&
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
        if (viewer.canSeeRate && input.minRpm != null && rpm < input.minRpm) {
          continue;
        }

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
        // `r` carries the ranker's spread of the candidate — the rate, the
        // derived rpm, AND the raw nested load. All three are redacted here;
        // ranking still used the true rate, server-side.
        const { carrierRateMinor, rpmMinor, ...rest } = r;
        return {
          // `rest` still carries the ranker's spread of the raw nested load at
          // runtime (RankedLoad does not declare it); the redacted `load`
          // below is written after the spread and wins.
          ...rest,
          ...(viewer.canSeeRate ? { carrierRateMinor, rpmMinor } : {}),
          deadheadMeters: c.deadheadMeters,
          load: redactLoadForRole(c.load, viewer),
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
      return redactLoadForRole(result.load, {
        canSeeRate: caps.canSeeRate,
        isShipper: false,
      });
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

      const caps = capabilitiesForRole(membership.role);
      const rows = await ctx.db.query.freightLoads.findMany({
        where: input?.status
          ? and(
              eq(freightLoads.carrierId, membership.carrierId),
              eq(freightLoads.status, input.status as LoadStatus),
            )
          : eq(freightLoads.carrierId, membership.carrierId),
        with: { stops: true },
        orderBy: [desc(freightLoads.updatedAt), desc(freightLoads.createdAt)],
      });
      return rows.map((l) =>
        redactLoadForRole(l, { canSeeRate: caps.canSeeRate, isShipper: false }),
      );
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

      return redactLoadForRole(updated, {
        canSeeRate: capabilitiesForRole(membership.role).canSeeRate,
        isShipper: false,
      });
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
      const viewer = {
        canSeeRate: capabilitiesForRole(membership.role).canSeeRate,
        isShipper: false,
      };

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

      return available
        .filter((cand) => {
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
        })
        .map((cand) => redactLoadForRole(cand, viewer));
    }),

  driverCurrent: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const membership = await getCarrierMembership(ctx.db, userId);
    // An owner-operator driving their own load still reads the rate; an
    // employee DRIVER does not — the field is absent, never zero.
    const viewer = {
      canSeeRate: membership
        ? capabilitiesForRole(membership.role).canSeeRate
        : false,
      isShipper: false,
    };
    const rows = await ctx.db.query.freightLoads.findMany({
      where: and(
        eq(freightLoads.assignedDriverUserId, userId),
        sql`${freightLoads.status} NOT IN ('COMPLETED', 'CANCELED', 'REJECTED')`,
      ),
      with: { stops: true },
      orderBy: [desc(freightLoads.updatedAt)],
    });
    return rows.map((l) => redactLoadForRole(l, viewer));
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

      return redactLoadForRole(advanced, await driverRateViewer(ctx.db, userId));
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
      return redactLoadForRole(
        completed,
        await driverRateViewer(ctx.db, userId),
      );
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
  /* ------------------------------------------------------------------ */
  /* Fleet invites — the only door into carrier membership.             */
  /* ------------------------------------------------------------------ */

  createFleetInvite: protectedProcedure
    .input(
      z.object({
        role: z.enum(INVITABLE_ROLES),
        name: z.string().min(1).max(128).optional(),
        email: z.string().email().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const membership = await getCarrierMembership(ctx.db, ctx.session.user.id);
      if (!membership || !capabilitiesForRole(membership.role).canManageFleet) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only a fleet manager can invite members.",
        });
      }
      const carrier = await ctx.db.query.freightCarriers.findFirst({
        where: eq(freightCarriers.id, membership.carrierId),
      });
      if (!carrier) throw new TRPCError({ code: "NOT_FOUND" });

      const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
      // The unique index is the real collision check; three tries is plenty
      // against a 30^8 space. ponytail: no pre-read, no backoff.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const [row] = await ctx.db
            .insert(freightCarrierInvites)
            .values({
              carrierId: membership.carrierId,
              code: generateInviteCode(),
              role: input.role,
              invitedEmail: input.email ?? null,
              invitedName: input.name ?? null,
              createdByUserId: ctx.session.user.id,
              expiresAt,
            })
            .returning();
          if (row) {
            return {
              code: row.code,
              role: row.role,
              expiresAt: row.expiresAt,
              carrierName: carrier.name,
              grants: roleGrantLines(row.role),
            };
          }
        } catch {
          // code collision — draw another
        }
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not mint an invite code. Try again.",
      });
    }),

  /**
   * What am I accepting? Returns the refusal instead of throwing so the join
   * screen can name the specific cause rather than showing an error toast.
   */
  previewFleetInvite: protectedProcedure
    .input(z.object({ code: z.string().min(1).max(32) }))
    .query(async ({ ctx, input }) => {
      const invite = await ctx.db.query.freightCarrierInvites.findFirst({
        where: eq(freightCarrierInvites.code, normalizeInviteCode(input.code)),
      });
      if (!invite) {
        return {
          ok: false as const,
          reason: "unknown" as const,
          message: "No fleet invite matches that code. Check it and retry.",
        };
      }
      const carrier = await ctx.db.query.freightCarriers.findFirst({
        where: eq(freightCarriers.id, invite.carrierId),
      });
      const existing = await getCarrierMembership(
        ctx.db,
        ctx.session.user.id,
        invite.carrierId,
      );
      const refusal = inviteRefusal(invite, {
        now: new Date(),
        alreadyMember: Boolean(existing),
      });
      if (refusal) {
        return {
          ok: false as const,
          reason: refusal,
          message: INVITE_REFUSAL_MESSAGE[refusal],
        };
      }
      return {
        ok: true as const,
        code: invite.code,
        carrierName: carrier?.name ?? "This carrier",
        role: invite.role,
        grants: roleGrantLines(invite.role),
        expiresAt: invite.expiresAt,
        invitedName: invite.invitedName,
      };
    }),

  acceptFleetInvite: protectedProcedure
    .input(z.object({ code: z.string().min(1).max(32) }))
    .mutation(async ({ ctx, input }) => {
      const code = normalizeInviteCode(input.code);
      const invite = await ctx.db.query.freightCarrierInvites.findFirst({
        where: eq(freightCarrierInvites.code, code),
      });
      if (!invite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No fleet invite matches that code.",
        });
      }
      const existing = await getCarrierMembership(
        ctx.db,
        ctx.session.user.id,
        invite.carrierId,
      );
      const refusal = inviteRefusal(invite, {
        now: new Date(),
        alreadyMember: Boolean(existing),
      });
      if (refusal) {
        throw new TRPCError({
          code: refusal === "already_member" ? "CONFLICT" : "BAD_REQUEST",
          message: INVITE_REFUSAL_MESSAGE[refusal],
        });
      }

      // CAS: the WHERE is the lock, exactly as bookLoadExclusive claims a
      // load. Two concurrent accepts of one code — the loser updates 0 rows.
      const now = new Date();
      const [claimed] = await ctx.db
        .update(freightCarrierInvites)
        .set({ acceptedByUserId: ctx.session.user.id, acceptedAt: now })
        .where(
          and(
            eq(freightCarrierInvites.id, invite.id),
            isNull(freightCarrierInvites.acceptedByUserId),
            isNull(freightCarrierInvites.revokedAt),
            gt(freightCarrierInvites.expiresAt, now),
          ),
        )
        .returning();
      if (!claimed) {
        throw new TRPCError({
          code: "CONFLICT",
          message: INVITE_REFUSAL_MESSAGE.already_accepted,
        });
      }

      // ponytail: the claim above is the single-use gate, so a failure here
      // burns the code rather than unwinding into a transaction. Membership
      // already ruled out above; the unique index is the last word.
      const [member] = await ctx.db
        .insert(freightCarrierMembers)
        .values({
          carrierId: claimed.carrierId,
          userId: ctx.session.user.id,
          role: claimed.role,
        })
        .returning();
      if (!member) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const carrier = await ctx.db.query.freightCarriers.findFirst({
        where: eq(freightCarriers.id, claimed.carrierId),
      });
      return {
        carrierId: member.carrierId,
        carrierName: carrier?.name ?? "your fleet",
        role: member.role,
        grants: roleGrantLines(member.role),
      };
    }),
});
