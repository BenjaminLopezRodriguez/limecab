import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, isNull, notInArray } from "drizzle-orm";
import { z } from "zod";

import {
  courierCompleteAllowed,
  courierStartAllowed,
  isCourierProduct,
} from "@/lib/limecab/courier";
import { offerHeadsToward } from "@/lib/limecab/heading";
import { civilDateInZone, mondayCivilDateInZone } from "@/lib/limecab/week";
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
  pickupCode: z.string().max(8).optional(),
  submittedPin: z.string().max(8).optional(),
  leftAtDoor: z.boolean().optional(),
  signatureCaptured: z.boolean().optional(),
});

function takeFromCompleted(
  rows: { totalCents: number; completedAt: Date | null; requestedAt: Date }[],
  now = new Date(),
) {
  const today = civilDateInZone(now);
  const monday = mondayCivilDateInZone(now);
  let todayCents = 0;
  let weekCents = 0;
  for (const row of rows) {
    const key = civilDateInZone(row.completedAt ?? row.requestedAt);
    if (key === today) todayCents += row.totalCents;
    if (key >= monday && key <= today) weekCents += row.totalCents;
  }
  return { todayCents, weekCents };
}

function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ?? null;
}

type AppDb = typeof import("@/server/db").db;

async function completedForDriver(database: AppDb, driverId: string) {
  return database.query.trips.findMany({
    where: and(eq(trips.driverId, driverId), eq(trips.status, "complete")),
    columns: {
      id: true,
      productId: true,
      destinationAddress: true,
      totalCents: true,
      baseCents: true,
      distanceCents: true,
      timeCents: true,
      bookingCents: true,
      completedAt: true,
      requestedAt: true,
    },
    orderBy: [desc(trips.completedAt)],
    limit: 100,
  });
}

export const driverRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const driver = await ctx.db.query.drivers.findFirst({
      where: eq(drivers.userId, ctx.session.user.id),
    });
    if (!driver) return { driver: null, completedTrips: 0, todayCents: 0, weekCents: 0 };

    const [row] = await ctx.db
      .select({ n: count() })
      .from(trips)
      .where(and(eq(trips.driverId, driver.id), eq(trips.status, "complete")));

    const completed = await completedForDriver(ctx.db, driver.id);
    const take = takeFromCompleted(completed);

    return {
      driver,
      completedTrips: Number(row?.n ?? 0),
      todayCents: take.todayCents,
      weekCents: take.weekCents,
    };
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
    if (!driver) {
      return {
        driver: null,
        open: [],
        active: [],
        todayCents: 0,
        weekCents: 0,
      };
    }

    const heading =
      driver.headingLatitude != null && driver.headingLongitude != null
        ? {
            latitude: driver.headingLatitude,
            longitude: driver.headingLongitude,
          }
        : null;

    const [openAll, activeRows, completed] = await Promise.all([
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
        // The driver has to know who they are looking for at the curb.
        with: { user: { columns: { name: true, phone: true } } },
      }),
      completedForDriver(ctx.db, driver.id),
    ]);

    const open = openAll.filter((trip) => offerHeadsToward(trip, heading));
    const take = takeFromCompleted(completed);

    // First name only: it is what a driver reads at a glance, and the rest is
    // not theirs to have.
    const active = activeRows.map(({ user, ...trip }) => ({
      ...trip,
      riderName: firstName(user?.name),
      riderPhone: user?.phone ?? null,
    }));

    return {
      driver,
      open,
      active,
      todayCents: take.todayCents,
      weekCents: take.weekCents,
    };
  }),

  setHeading: protectedProcedure
    .input(
      z.object({
        address: z.string().trim().max(512).nullable(),
        latitude: z.number().nullable(),
        longitude: z.number().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const clear = !input.address;
      const [driver] = await ctx.db
        .update(drivers)
        .set({
          headingAddress: clear ? null : input.address,
          headingLatitude: clear ? null : input.latitude,
          headingLongitude: clear ? null : input.longitude,
        })
        .where(eq(drivers.userId, ctx.session.user.id))
        .returning();
      if (!driver) throw new TRPCError({ code: "NOT_FOUND" });
      return driver;
    }),

  earnings: protectedProcedure.query(async ({ ctx }) => {
    const driver = await ctx.db.query.drivers.findFirst({
      where: eq(drivers.userId, ctx.session.user.id),
    });
    if (!driver) throw new TRPCError({ code: "NOT_FOUND" });
    const completed = await completedForDriver(ctx.db, driver.id);
    const take = takeFromCompleted(completed);
    return {
      ...take,
      trips: completed,
    };
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

    // Ride PINs are shown so the driver can read them back. Courier codes
    // stay with the merchant and recipient — the driver types what they see.
    const courier = isCourierProduct(trip.productId);
    return {
      ...trip,
      pickupPin: isAssigned && !courier ? trip.pickupPin : null,
      deliveryPin: null,
    };
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

      const courier = isCourierProduct(trip.productId);
      if (courier && action === "start") {
        const gate = courierStartAllowed(input.pickupCode, trip.pickupPin);
        if (!gate.ok) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: gate.message,
          });
        }
      }
      if (courier && action === "complete") {
        const proof =
          trip.deliveryProof === "door" || trip.deliveryProof === "signature"
            ? trip.deliveryProof
            : "hand";
        const gate = courierCompleteAllowed({
          proof,
          deliveryPin: trip.deliveryPin,
          submittedPin: input.submittedPin,
          leftAtDoor: input.leftAtDoor,
          signatureCaptured: input.signatureCaptured,
        });
        if (!gate.ok) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: gate.message,
          });
        }
      }

      const now = new Date();
      const [advanced] = await ctx.db
        .update(trips)
        .set({
          status: to,
          ...(courier && to === "in_progress" ? { pickupVerifiedAt: now } : {}),
          ...(to === "complete"
            ? {
                completedAt: now,
                ...(courier ? { deliveryVerifiedAt: now } : {}),
              }
            : {}),
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
