import { TRPCError } from "@trpc/server";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { z } from "zod";

import {
  distanceMiles as computeDistanceMiles,
  estimateFare,
  tripMinutes as computeTripMinutes,
} from "@/lib/limecab/domain";
import {
  findBookableProduct,
  isCourierProduct,
} from "@/lib/limecab/courier";
import { RIDE_PRODUCTS } from "@/lib/limecab/mock";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { trips, supportTickets } from "@/server/db/schema";
import { maybeSimulateTrip } from "@/server/limecab/simulate-driver";
import {
  riderMay,
  TERMINAL_TRIP_STATUSES,
} from "@/server/limecab/state";

const locationInput = z.object({
  address: z.string().min(1).max(512),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

const courierInput = z.object({
  recipientName: z.string().min(1).max(80),
  recipientPhone: z.string().min(7).max(20),
  packageCount: z.number().int().min(1).max(8),
  proof: z.enum(["hand", "door", "signature"]),
});

const requestInput = z.object({
  pickup: locationInput.extend({
    meetingPoint: z.string().max(256).optional(),
  }),
  destination: locationInput,
  productId: z.string().min(1).max(64),
  /** Client-supplied so a retried request cannot book two rides. */
  idempotencyKey: z.string().min(8).max(255),
  courier: courierInput.optional(),
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

const riderTripWhere = (userId: string, tripId: string) =>
  and(eq(trips.id, tripId), eq(trips.userId, userId));

async function loadRiderTrip(
  ctx: { db: typeof import("@/server/db").db; session: { user: { id: string } } },
  tripId: string,
) {
  const trip = await ctx.db.query.trips.findFirst({
    where: riderTripWhere(ctx.session.user.id, tripId),
    with: { driver: driverColumns },
  });
  if (!trip) return null;
  const next = await maybeSimulateTrip(ctx.db, trip);
  if (next.status === trip.status && next.driverId === trip.driverId) {
    return trip;
  }
  return (
    (await ctx.db.query.trips.findFirst({
      where: riderTripWhere(ctx.session.user.id, tripId),
      with: { driver: driverColumns },
    })) ?? { ...trip, ...next }
  );
}

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

      const product = findBookableProduct(input.productId, RIDE_PRODUCTS);
      if (product?.status !== "available") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That option is not bookable.",
        });
      }

      const courier = isCourierProduct(product.id);
      if (courier && !input.courier) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Courier trips need a recipient.",
        });
      }

      // Price is computed here, from the same functions the quote uses. A
      // client-sent total is never read.
      const miles = computeDistanceMiles(input.pickup, input.destination);
      const minutes = computeTripMinutes(miles);
      const fare = estimateFare(product, miles, minutes);
      const proof = courier ? (input.courier?.proof ?? "hand") : null;

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
          recipientName: input.courier?.recipientName ?? null,
          recipientPhone: input.courier?.recipientPhone ?? null,
          packageCount: input.courier?.packageCount ?? 1,
          deliveryProof: proof,
          deliveryPin: proof === "hand" ? pickupPin() : null,
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
      const trip = await loadRiderTrip(ctx, input.id);
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
    if (!trip) return null;
    return loadRiderTrip(ctx, trip.id);
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

  openTicket: protectedProcedure
    .input(
      z.object({
        tripId: z.string().min(1).max(255),
        topic: z.enum(["fare", "lost_item", "driver", "other"]),
        message: z.string().trim().min(8).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const trip = await ctx.db.query.trips.findFirst({
        where: and(
          eq(trips.id, input.tripId),
          eq(trips.userId, ctx.session.user.id),
        ),
        columns: { id: true },
      });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });

      const [ticket] = await ctx.db
        .insert(supportTickets)
        .values({
          userId: ctx.session.user.id,
          tripId: trip.id,
          topic: input.topic,
          message: input.message,
        })
        .returning();
      if (!ticket) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return ticket;
    }),

  tickets: protectedProcedure
    .input(z.object({ tripId: z.string().min(1).max(255) }))
    .query(async ({ ctx, input }) => {
      const trip = await ctx.db.query.trips.findFirst({
        where: and(
          eq(trips.id, input.tripId),
          eq(trips.userId, ctx.session.user.id),
        ),
        columns: { id: true },
      });
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.query.supportTickets.findMany({
        where: and(
          eq(supportTickets.tripId, trip.id),
          eq(supportTickets.userId, ctx.session.user.id),
        ),
        orderBy: [desc(supportTickets.createdAt)],
      });
    }),
});
