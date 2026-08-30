import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { tripMessages, trips } from "@/server/db/schema";
import {
  chatMayRead,
  chatMaySend,
  firstName,
  resolveChatAccess,
  type ChatAccess,
} from "@/server/limecab/trip-chat";
const tripIdInput = z.object({
  tripId: z.string().min(1).max(255),
});

function throwAccess(access: Extract<ChatAccess, { ok: false }>): never {
  if (access.code === "NOT_FOUND") {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  if (access.code === "FORBIDDEN") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Chat opens once a driver is assigned.",
  });
}

async function loadChatTrip(
  ctx: {
    db: typeof import("@/server/db").db;
    session: { user: { id: string } };
  },
  tripId: string,
) {
  const trip = await ctx.db.query.trips.findFirst({
    where: eq(trips.id, tripId),
    columns: {
      id: true,
      userId: true,
      driverId: true,
      status: true,
    },
    with: {
      user: { columns: { name: true } },
      driver: { columns: { id: true, userId: true, name: true } },
    },
  });

  const assignedDriverUserId = trip?.driver?.userId ?? null;
  const access = resolveChatAccess({
    userId: ctx.session.user.id,
    trip: trip
      ? {
          userId: trip.userId,
          driverId: trip.driverId,
          status: trip.status,
        }
      : null,
    assignedDriverUserId,
  });

  return { trip, access };
}

export const tripChatRouter = createTRPCRouter({
  list: protectedProcedure.input(tripIdInput).query(async ({ ctx, input }) => {
    const { trip, access } = await loadChatTrip(ctx, input.tripId);
    if (!access.ok) throwAccess(access);
    if (!trip || !chatMayRead(trip.status)) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Chat opens once a driver is assigned.",
      });
    }

    const rows = await ctx.db.query.tripMessages.findMany({
      where: eq(tripMessages.tripId, trip.id),
      orderBy: [asc(tripMessages.createdAt)],
      columns: {
        id: true,
        body: true,
        senderRole: true,
        createdAt: true,
      },
    });

    return {
      me: access.role,
      canSend: chatMaySend(trip.status),
      counterpartName:
        access.role === "rider"
          ? (trip.driver?.name ?? "your driver")
          : (firstName(trip.user?.name) ?? "the rider"),
      messages: rows,
    };
  }),

  send: protectedProcedure
    .input(
      tripIdInput.extend({
        body: z.string().trim().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { trip, access } = await loadChatTrip(ctx, input.tripId);
      if (!access.ok) throwAccess(access);
      if (!trip || !chatMaySend(trip.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            trip?.status === "cancelled"
              ? "This ride was cancelled."
              : "Chat opens once a driver is assigned.",
        });
      }

      const [row] = await ctx.db
        .insert(tripMessages)
        .values({
          tripId: trip.id,
          senderUserId: ctx.session.user.id,
          senderRole: access.role,
          body: input.body,
        })
        .returning({
          id: tripMessages.id,
          body: tripMessages.body,
          senderRole: tripMessages.senderRole,
          createdAt: tripMessages.createdAt,
        });

      if (!row) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
      return row;
    }),
});
