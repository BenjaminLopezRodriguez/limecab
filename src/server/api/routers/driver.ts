import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, notInArray } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { drivers, trips } from "@/server/db/schema";
import {
  canTransition,
  driverMay,
  DRIVER_ACTION_TARGET,
  TERMINAL_TRIP_STATUSES,
  type DriverAction,
} from "@/server/limecab/state";

const registerInput = z.object({
  name: z.string().min(1).max(128),
  vehicleMake: z.string().min(1).max(64),
  vehicleModel: z.string().min(1).max(64),
  vehicleColor: z.string().min(1).max(32),
  vehiclePlate: z.string().min(1).max(16),
});

const tripIdInput = z.object({ tripId: z.string().min(1).max(255) });

const advanceInput = tripIdInput.extend({
  action: z.enum(["arrive", "start", "complete"]),
});

export const driverRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const driver = await ctx.db.query.drivers.findFirst({
      where: eq(drivers.userId, ctx.session.user.id),
    });
    return { driver: driver ?? null };
  }),

  register: protectedProcedure
    .input(registerInput)
    .mutation(async ({ ctx, input }) => {
      // Upsert on userId — re-registering edits the profile instead of erroring.
      const [driver] = await ctx.db
        .insert(drivers)
        .values({ userId: ctx.session.user.id, ...input })
        .onConflictDoUpdate({ target: drivers.userId, set: input })
        .returning();

      if (!driver) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return driver;
    }),

  setAvailable: protectedProcedure
    .input(z.object({ available: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [driver] = await ctx.db
        .update(drivers)
        .set({ available: input.available })
        .where(eq(drivers.userId, ctx.session.user.id))
        .returning();

      if (!driver) throw new TRPCError({ code: "NOT_FOUND" });
      return driver;
    }),

  inbox: protectedProcedure.query(async ({ ctx }) => {
    const driver = await ctx.db.query.drivers.findFirst({
      where: eq(drivers.userId, ctx.session.user.id),
    });
    // Not a driver yet: the UI renders a registration form off this.
    if (!driver) return { driver: null, open: [], active: [] };

    const [open, active] = await Promise.all([
      ctx.db.query.trips.findMany({
        where: and(eq(trips.status, "requested"), isNull(trips.driverId)),
        orderBy: [desc(trips.requestedAt)],
      }),
      ctx.db.query.trips.findMany({
        where: and(
          eq(trips.driverId, driver.id),
          notInArray(trips.status, [...TERMINAL_TRIP_STATUSES]),
        ),
        orderBy: [desc(trips.requestedAt)],
      }),
    ]);

    return { driver, open, active };
  }),

  get: protectedProcedure.input(tripIdInput).query(async ({ ctx, input }) => {
    const driver = await ctx.db.query.drivers.findFirst({
      where: eq(drivers.userId, ctx.session.user.id),
    });
    if (!driver) throw new TRPCError({ code: "NOT_FOUND" });

    const trip = await ctx.db.query.trips.findFirst({
      where: eq(trips.id, input.tripId),
    });
    // Existence never leaks: anything not ours and not an open offer 404s.
    if (!trip) throw new TRPCError({ code: "NOT_FOUND" });

    const isAssigned = trip.driverId === driver.id;
    const isOpenOffer = trip.status === "requested" && trip.driverId === null;
    if (!isAssigned && !isOpenOffer) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    // The PIN belongs to the rider until this driver actually owns the ride.
    return { ...trip, pickupPin: isAssigned ? trip.pickupPin : null };
  }),

  accept: protectedProcedure
    .input(tripIdInput)
    .mutation(async ({ ctx, input }) => {
      const driver = await ctx.db.query.drivers.findFirst({
        where: eq(drivers.userId, ctx.session.user.id),
      });
      if (!driver) throw new TRPCError({ code: "NOT_FOUND" });
      if (!driver.available) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Go on duty before accepting a ride.",
        });
      }

      // Compare-and-set: the WHERE is the lock. Two drivers racing for one
      // ride cannot both win — the loser updates zero rows.
      const [accepted] = await ctx.db
        .update(trips)
        .set({ driverId: driver.id, status: DRIVER_ACTION_TARGET.accept })
        .where(
          and(
            eq(trips.id, input.tripId),
            eq(trips.status, "requested"),
            isNull(trips.driverId),
          ),
        )
        .returning();

      if (!accepted) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That ride is no longer available.",
        });
      }
      return accepted;
    }),

  advance: protectedProcedure
    .input(advanceInput)
    .mutation(async ({ ctx, input }) => {
      const driver = await ctx.db.query.drivers.findFirst({
        where: eq(drivers.userId, ctx.session.user.id),
      });
      if (!driver) throw new TRPCError({ code: "NOT_FOUND" });

      // Scoped to the assigned driver in the query itself.
      const trip = await ctx.db.query.trips.findFirst({
        where: and(eq(trips.id, input.tripId), eq(trips.driverId, driver.id)),
      });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });

      const action: DriverAction = input.action;
      const to = DRIVER_ACTION_TARGET[action];
      if (!driverMay(trip.status, action) || !canTransition(trip.status, to)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `A ${trip.status} trip cannot ${action}.`,
        });
      }

      const [advanced] = await ctx.db
        .update(trips)
        .set({
          status: to,
          ...(to === "complete" ? { completedAt: new Date() } : {}),
        })
        .where(
          and(
            eq(trips.id, trip.id),
            eq(trips.driverId, driver.id),
            eq(trips.status, trip.status),
          ),
        )
        .returning();

      if (!advanced) {
        throw new TRPCError({ code: "CONFLICT", message: "Trip changed." });
      }
      return advanced;
    }),
});
