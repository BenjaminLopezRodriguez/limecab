import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { z } from "zod";

import { distanceMiles } from "@/lib/limecab/domain";
import { cellDisk, toSearchCell } from "@/lib/limecab/h3";
import { placesFromHistory, type Place } from "@/lib/service-app/services";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { savedPlaces, trips } from "@/server/db/schema";

/**
 * The rider's own places.
 *
 * Home and Work are *slots* — one each, upserted by kind, and they keep the
 * stable ids "home" and "work" so the icon rules and the voice parser have
 * something to key on. Custom spots are an ordinary list. Recents are not a
 * table: they are derived from the user's own trips, so nobody is ever shown
 * a place they did not go to.
 *
 * `h3` is written at `SEARCH_H3_RES` and used by `nearby` only. It is a query
 * filter, never drawn, and never returned to the client.
 */

type PlaceRow = typeof savedPlaces.$inferSelect;

const SLOT_LABEL = { home: "Home", work: "Work" } as const;

/** Slots keep a stable id; a custom spot is its row. */
function toPlace(row: PlaceRow, hint?: string): Place {
  return {
    id: row.kind === "custom" ? row.id : row.kind,
    label: row.label,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    source: "saved",
    hint,
  };
}

const setInput = z.object({
  kind: z.enum(["home", "work", "custom"]),
  label: z.string().trim().min(1).max(64),
  address: z.string().trim().min(1).max(512),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

async function loadSaved(
  db: typeof import("@/server/db").db,
  userId: string,
): Promise<PlaceRow[]> {
  return db.query.savedPlaces.findMany({
    where: eq(savedPlaces.userId, userId),
    orderBy: [desc(savedPlaces.createdAt)],
  });
}

/**
 * Where the rider has actually been. Cancelled-before-match trips are not a
 * place they went, so only matched-or-later rows count.
 */
async function loadRecents(
  db: typeof import("@/server/db").db,
  userId: string,
): Promise<Place[]> {
  const rows = await db.query.trips.findMany({
    where: and(
      eq(trips.userId, userId),
      ne(trips.status, "requested"),
      isNotNull(trips.destinationAddress),
    ),
    columns: {
      id: true,
      destinationAddress: true,
      destinationLatitude: true,
      destinationLongitude: true,
      completedAt: true,
      requestedAt: true,
    },
    orderBy: [desc(trips.requestedAt)],
    limit: 24,
  });

  return placesFromHistory(
    rows.map((row) => ({
      id: row.id,
      address: row.destinationAddress,
      latitude: row.destinationLatitude,
      longitude: row.destinationLongitude,
      at: row.completedAt ?? row.requestedAt,
    })),
    { limit: 8 },
  );
}

export const placesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const [rows, recents] = await Promise.all([
      loadSaved(ctx.db, ctx.session.user.id),
      loadRecents(ctx.db, ctx.session.user.id),
    ]);

    const slot = (kind: "home" | "work") => {
      const row = rows.find((entry) => entry.kind === kind);
      return row ? toPlace(row) : null;
    };

    return {
      home: slot("home"),
      work: slot("work"),
      custom: rows
        .filter((row) => row.kind === "custom")
        .map((row) => toPlace(row)),
      recents,
    };
  }),

  set: protectedProcedure.input(setInput).mutation(async ({ ctx, input }) => {
    const values = {
      userId: ctx.session.user.id,
      kind: input.kind,
      // A slot is named by what it is. Only a custom spot gets a free label.
      label: input.kind === "custom" ? input.label : SLOT_LABEL[input.kind],
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      h3: toSearchCell(input.latitude, input.longitude),
    };

    // One Home, one Work — enforced here rather than by a unique on
    // (userId, kind), which would also forbid a second custom spot.
    if (input.kind !== "custom") {
      await ctx.db
        .delete(savedPlaces)
        .where(
          and(
            eq(savedPlaces.userId, ctx.session.user.id),
            eq(savedPlaces.kind, input.kind),
          ),
        );
    }

    const [row] = await ctx.db.insert(savedPlaces).values(values).returning();
    if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return toPlace(row);
  }),

  /** "home" / "work" clear the slot; anything else is a custom row id. */
  remove: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const slot = input.id === "home" || input.id === "work";
      const deleted = await ctx.db
        .delete(savedPlaces)
        .where(
          and(
            eq(savedPlaces.userId, ctx.session.user.id),
            slot
              ? eq(savedPlaces.kind, input.id as "home" | "work")
              : eq(savedPlaces.id, input.id),
          ),
        )
        .returning({ id: savedPlaces.id });
      return { removed: deleted.length };
    }),

  /**
   * The only search path that touches H3: custom spots a few blocks from
   * where the rider is standing, ranked above recents on an empty query.
   * Home and Work are slots and stay pinned regardless of cell, so they are
   * not returned here. No Mapbox, no cell ids on the wire.
   */
  nearby: protectedProcedure
    .input(
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        k: z.number().int().min(0).max(2).default(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const disk = cellDisk(
        toSearchCell(input.latitude, input.longitude),
        input.k,
      );
      if (!disk.length) return [];

      const rows = await ctx.db.query.savedPlaces.findMany({
        where: and(
          eq(savedPlaces.userId, ctx.session.user.id),
          eq(savedPlaces.kind, "custom"),
          inArray(savedPlaces.h3, disk),
        ),
        limit: 6,
      });

      return rows.map((row) => {
        const miles = distanceMiles({ address: "", ...input }, row);
        return toPlace(row, miles < 0.1 ? "here" : `${miles.toFixed(1)} mi`);
      });
    }),
});
