import { TRPCError } from "@trpc/server";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { z } from "zod";

import {
  distanceMiles as computeDistanceMiles,
  estimateFare,
  tripMinutes as computeTripMinutes,
} from "@/lib/limecab/domain";
import { RIDE_PRODUCTS } from "@/lib/limecab/mock";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { trips } from "@/server/db/schema";
import {
  riderMay,
  TERMINAL_TRIP_STATUSES,
} from "@/server/limecab/state";

const locationInput = z.object({
  address: z.string().min(1).max(512),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

const requestInput = z.object({
  pickup: locationInput.extend({
    meetingPoint: z.string().max(256).optional(),
  }),
  destination: locationInput,
  productId: z.string().min(1).max(64),
  /** Client-supplied so a retried request cannot book two rides. */
  idempotencyKey: z.string().min(8).max(255),
});

/** Spoken to the driver at the curb; never accepted from the client. */
function pickupPin(): string {
  return String(Math.floor(Math.random() * 10_000)).padStart(4, "0");
}

/** Public driver details the rider is shown: "Slate Toyota Prius - 8XKR112". */
const driverColumns = {
  columns: {
    id: true,
    name: true,
    ratingHundredths: true,
    vehicleMake: true,
    vehicleModel: true,
    vehicleColor: true,
    vehiclePlate: true,
  },
} as const;

export const tripRouter = createTRPCRouter({
  request: protectedProcedure
    .input(requestInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.trips.findFirst({
        where: eq(trips.requestIdempotencyKey, input.idempotencyKey),
      });
      if (existing) {
        if (existing.userId !== ctx.session.user.id) {
          throw new TRPCError({ code: "CONFLICT" });
        }
        return existing;
      }

      const product = RIDE_PRODUCTS.find((p) => p.id === input.productId);
      if (product?.status !== "available") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That ride option is not bookable.",
        });
      }

      // Price is computed here, from the same functions the quote uses. A
      // client-sent total is never read.
      const miles = computeDistanceMiles(input.pickup, input.destination);
      const minutes = computeTripMinutes(miles);
      const fare = estimateFare(product, miles, minutes);

      const [trip] = await ctx.db
        .insert(trips)
        .values({
          userId: ctx.session.user.id,
          status: "requested",
          pickupAddress: input.pickup.address,
          pickupLatitude: input.pickup.latitude,
          pickupLongitude: input.pickup.longitude,
          pickupMeetingPoint: input.pickup.meetingPoint,
          destinationAddress: input.destination.address,
          destinationLatitude: input.destination.latitude,
          destinationLongitude: input.destination.longitude,
          productId: product.id,
          baseCents: fare.baseCents,
          distanceCents: fare.distanceCents,
          timeCents: fare.timeCents,
          bookingCents: fare.bookingCents,
          totalCents: fare.totalCents,
          distanceMiles: miles,
          tripMinutes: minutes,
          arrivalMinutes: product.etaMinutes,
          pickupPin: pickupPin(),
          requestIdempotencyKey: input.idempotencyKey,
        })
        .returning();

      if (!trip) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
      return trip;
    }),

  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.query.trips.findMany({
      where: eq(trips.userId, ctx.session.user.id),
      orderBy: [desc(trips.requestedAt)],
    }),
  ),

  get: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(255) }))
    .query(async ({ ctx, input }) => {
      // Scoped by userId in the query itself — another user's id 404s.
      const trip = await ctx.db.query.trips.findFirst({
        where: and(
          eq(trips.id, input.id),
          eq(trips.userId, ctx.session.user.id),
        ),
        with: { driver: driverColumns },
      });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      return trip;
    }),

  /** The ride in progress, so a refresh resumes it. Null when there is none. */
  active: protectedProcedure.query(async ({ ctx }) => {
    const trip = await ctx.db.query.trips.findFirst({
      where: and(
        eq(trips.userId, ctx.session.user.id),
        notInArray(trips.status, [...TERMINAL_TRIP_STATUSES]),
      ),
      orderBy: [desc(trips.requestedAt)],
      with: { driver: driverColumns },
    });
    return trip ?? null;
  }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const trip = await ctx.db.query.trips.findFirst({
        where: and(
          eq(trips.id, input.id),
          eq(trips.userId, ctx.session.user.id),
        ),
      });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });

      if (!riderMay(trip.status, "cancel")) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `A ${trip.status} trip cannot be cancelled.`,
        });
      }

      // Compare-and-set on status so two concurrent cancels cannot both win.
      const [cancelled] = await ctx.db
        .update(trips)
        .set({ status: "cancelled", cancelledAt: new Date() })
        .where(and(eq(trips.id, trip.id), eq(trips.status, trip.status)))
        .returning();

      if (!cancelled) {
        throw new TRPCError({ code: "CONFLICT", message: "Trip changed." });
      }
      return cancelled;
    }),
});
