import { TRPCError } from "@trpc/server";
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  notInArray,
  or,
} from "drizzle-orm";
import { z } from "zod";

import {
  courierCompleteAllowed,
  courierStartAllowed,
  isCourierProduct,
} from "@/lib/limecab/courier";
import {
  careAckCurrent,
  CARE_RULES,
  CARE_RULES_VERSION,
  isCareProduct,
  isHelpProduct,
} from "@/lib/limecab/help";
import { RIDER_SAFETY } from "@/lib/limecab/mock";
import {
  redactTripPins,
  ridePinRequired,
  rideStartAllowed,
} from "@/lib/limecab/pickup-pin";
import { distanceMiles } from "@/lib/limecab/domain";
import {
  cellCenter,
  cellDisk,
  isCell,
  toDriverCell,
  viewportCells,
} from "@/lib/limecab/h3";
import { currentJob } from "@/lib/limecab/driver-state";
import { offerHeadsToward } from "@/lib/limecab/heading";
import { rankOpenOffers } from "@/lib/limecab/pool-match";
import { splitAddress } from "@/lib/service-app/services";
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

/**
 * How long a fix is worth trusting. A driver who has not pinged inside this
 * window is not "somewhere else" — they are unknown, and the inbox falls back
 * to the global list rather than going quiet on them.
 */
const FIX_FRESH_MS = 45_000;

/** k=2 at res 8 is roughly a 1.5 km radius. That is the marketplace. */
const MARKETPLACE_K = 2;

/**
 * The lattice a driver reads off a dash mount: k=3 at res 8 is 37 cells, a
 * glanceable neighbourhood. The cap is where a grid stops being a grid — past
 * it the honest thing is to draw nothing.
 */
const LATTICE_K = 3;
const DEMAND_CELL_CAP = 80;

/** Past this, a job is an airport run or an out-of-area haul, not a hop. */
const LONG_TRIP_MILES = 15;

/** How far back a trends chart looks, and how many areas it will draw. */
const TRENDS_DAYS = 28;
const TRENDS_CELL_CAP = 8;

function daysAgo(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * The city a pickup address names — "Rosemead", not the whole tail with the
 * state and the ZIP on it. Never invented: an address with no locality gives
 * the cell no label at all.
 */
function localityName(address: string): string | null {
  const locality = splitAddress(address).locality.split(",")[0]?.trim();
  if (!locality) return null;
  return locality;
}

/** The name a cell's pickups actually use most. No majority, no label. */
function commonest(names: Map<string, number>): string | null {
  let best: string | null = null;
  let seen = 0;
  for (const [name, n] of names) {
    if (n > seen) {
      best = name;
      seen = n;
    }
  }
  return best;
}

function freshFixSince(now = new Date()) {
  return new Date(now.getTime() - FIX_FRESH_MS);
}

function hasFreshFix(driver: {
  lastH3: string | null;
  lastSeenAt: Date | null;
}): boolean {
  return (
    isCell(driver.lastH3) &&
    driver.lastSeenAt !== null &&
    driver.lastSeenAt >= freshFixSince()
  );
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
    if (!driver)
      return { driver: null, completedTrips: 0, todayCents: 0, weekCents: 0 };

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

    /**
     * The open set, by cell first and heading second.
     *
     * A stale or missing fix is not an empty marketplace: Chrome denying
     * location, or a simulator with no geolocation at all, keeps today's
     * global list. Only a driver who is actually reporting a position gets
     * narrowed to their own disk.
     */
    const disk = hasFreshFix(driver)
      ? cellDisk(driver.lastH3!, MARKETPLACE_K)
      : null;
    const openWhere = disk?.length
      ? and(
          eq(trips.status, "requested"),
          isNull(trips.driverId),
          // ponytail: rollout clause, added 2026-08-27. Trips requested
          // before `pickupH3` existed have none; drop the `isNull` leg once
          // no null-pickupH3 `requested` rows remain.
          or(inArray(trips.pickupH3, disk), isNull(trips.pickupH3)),
        )
      : and(eq(trips.status, "requested"), isNull(trips.driverId));

    const [openAll, activeRows, completed] = await Promise.all([
      ctx.db.query.trips.findMany({
        where: openWhere,
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

    // The driver's own filters, applied where the offers are chosen. A switch
    // that does not reach this line has no business being on the screen.
    const open = rankOpenOffers(
      openAll.filter((trip) => {
        // A visit is not a ride: it has no XL class and no distance to be
        // long, so the ride filters do not decide whether it is offered.
        if (isHelpProduct(trip.productId)) {
          if (!driver.helpJobs) return false;
          // Care needs a current acknowledgement, not just the Help flag: a
          // driver whose rules went stale stops seeing Care immediately.
          if (isCareProduct(trip.productId) && !careAckCurrent(driver)) {
            return false;
          }
          return offerHeadsToward(trip, heading);
        }
        return (
          offerHeadsToward(trip, heading) &&
          (driver.courierJobs || !isCourierProduct(trip.productId)) &&
          (driver.acceptXl || trip.productId !== "lime-xl") &&
          (driver.longTrips || trip.distanceMiles <= LONG_TRIP_MILES)
        );
      }),
      currentJob(activeRows),
    ).map((trip) => redactTripPins(trip, false, RIDER_SAFETY.pickupPin));
    const take = takeFromCompleted(completed);

    // First name only: it is what a driver reads at a glance, and the rest is
    // not theirs to have. The PIN digits stay on the server.
    const active = activeRows.map(({ user, ...trip }) => ({
      ...redactTripPins(trip, true, RIDER_SAFETY.pickupPin),
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

  /**
   * Where the driver is standing, right now. Deliberately outside the trip
   * state machine: a fix is not a lifecycle event, and a failed ping must
   * never be able to lock the GO button.
   */
  pingLocation: protectedProcedure
    .input(
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [driver] = await ctx.db
        .update(drivers)
        .set({
          lastLatitude: input.latitude,
          lastLongitude: input.longitude,
          lastH3: toDriverCell(input.latitude, input.longitude),
          lastSeenAt: new Date(),
        })
        .where(eq(drivers.userId, ctx.session.user.id))
        .returning({ lastSeenAt: drivers.lastSeenAt });
      if (!driver) throw new TRPCError({ code: "NOT_FOUND" });
      return { at: driver.lastSeenAt };
    }),

  /**
   * Cars near a pickup, for the rider's canvas. Positions are cell centroids,
   * never the raw fix — a rider does not get to follow a driver around a block
   * before there is a match. No names, no plates, no ids, no cell strings.
   */
  nearby: protectedProcedure
    .input(
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      }),
    )
    .query(async ({ ctx, input }) => {
      const disk = cellDisk(
        toDriverCell(input.latitude, input.longitude),
        MARKETPLACE_K,
      );
      if (!disk.length) return [];

      const rows = await ctx.db.query.drivers.findMany({
        where: and(
          eq(drivers.available, true),
          inArray(drivers.lastH3, disk),
          gte(drivers.lastSeenAt, freshFixSince()),
        ),
        columns: { lastH3: true },
        limit: 8,
      });

      // One glyph per occupied cell. Positions are centroids, so two drivers
      // in the same cell would otherwise stack into one marker anyway — this
      // just says so rather than piling identical points on the canvas.
      const cells = new Set(
        rows.flatMap((row) => (isCell(row.lastH3) ? [row.lastH3] : [])),
      );
      return [...cells].map((cell) => cellCenter(cell));
    }),

  /**
   * How busy each visible cell has been. This is the *lattice weight*, and it
   * is occupancy: an open request standing in a cell, plus how many trips
   * actually started there in the last week. Not price, not a multiplier, not
   * a forecast — there is nothing here to bid against.
   *
   * `label` is the locality the pickups in that cell actually name. A cell
   * with no history has no label; it does not borrow its neighbour's.
   */
  demand: protectedProcedure
    .input(
      z.union([
        z.object({
          west: z.number().min(-180).max(180),
          south: z.number().min(-90).max(90),
          east: z.number().min(-180).max(180),
          north: z.number().min(-90).max(90),
        }),
        z.object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        }),
      ]),
    )
    .query(async ({ ctx, input }) => {
      const cells =
        "latitude" in input
          ? cellDisk(toDriverCell(input.latitude, input.longitude), LATTICE_K)
          : viewportCells(input.west, input.south, input.east, input.north);
      // Zoomed out far enough that the lattice stops being a lattice: draw
      // nothing rather than paint a whole state one colour.
      if (!cells.length || cells.length > DEMAND_CELL_CAP) return [];

      const [openRows, recentRows] = await Promise.all([
        ctx.db.query.trips.findMany({
          where: and(
            eq(trips.status, "requested"),
            isNull(trips.driverId),
            inArray(trips.pickupH3, cells),
          ),
          columns: { pickupH3: true, pickupAddress: true },
          limit: 200,
        }),
        ctx.db.query.trips.findMany({
          where: and(
            eq(trips.status, "complete"),
            inArray(trips.pickupH3, cells),
            gte(trips.requestedAt, daysAgo(7)),
          ),
          columns: { pickupH3: true, pickupAddress: true },
          limit: 500,
        }),
      ]);

      const cellsByIndex = new Map<
        string,
        { openCount: number; weekCount: number; names: Map<string, number> }
      >();
      const bump = (
        h3: string | null,
        address: string,
        key: "openCount" | "weekCount",
      ) => {
        if (!isCell(h3)) return;
        const entry = cellsByIndex.get(h3) ?? {
          openCount: 0,
          weekCount: 0,
          names: new Map<string, number>(),
        };
        entry[key] += 1;
        const city = localityName(address);
        if (city) entry.names.set(city, (entry.names.get(city) ?? 0) + 1);
        cellsByIndex.set(h3, entry);
      };
      for (const row of openRows)
        bump(row.pickupH3, row.pickupAddress, "openCount");
      for (const row of recentRows)
        bump(row.pickupH3, row.pickupAddress, "weekCount");

      return cells.map((h3) => {
        const entry = cellsByIndex.get(h3);
        return {
          h3,
          openCount: entry?.openCount ?? 0,
          weekCount: entry?.weekCount ?? 0,
          label: entry ? commonest(entry.names) : null,
        };
      });
    }),

  /**
   * The driver's own completed trips, bucketed by pickup cell, weekday, and
   * hour. Deliberately theirs and not the market's: a chart built from other
   * people's work would be a forecast, and this build does not have one.
   *
   * A driver with no completed trips gets an empty list — the scene says
   * "trends fill in as you complete trips" rather than drawing a flat week
   * and calling it data.
   */
  trends: protectedProcedure
    .input(
      z
        .object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        })
        .nullish(),
    )
    .query(async ({ ctx, input }) => {
      const driver = await ctx.db.query.drivers.findFirst({
        where: eq(drivers.userId, ctx.session.user.id),
      });
      if (!driver) throw new TRPCError({ code: "NOT_FOUND" });

      const rows = await ctx.db.query.trips.findMany({
        where: and(
          eq(trips.driverId, driver.id),
          eq(trips.status, "complete"),
          gte(trips.requestedAt, daysAgo(TRENDS_DAYS)),
        ),
        columns: {
          pickupH3: true,
          pickupAddress: true,
          pickupLatitude: true,
          pickupLongitude: true,
          completedAt: true,
          requestedAt: true,
        },
        limit: 1000,
      });

      const byCell = new Map<
        string,
        { buckets: number[][]; names: Map<string, number> }
      >();
      for (const row of rows) {
        // Trips predating `pickupH3` still have coordinates; index them here
        // rather than dropping a driver's own history out of their chart.
        const cell = isCell(row.pickupH3)
          ? row.pickupH3
          : row.pickupLatitude != null && row.pickupLongitude != null
            ? toDriverCell(row.pickupLatitude, row.pickupLongitude)
            : null;
        if (!cell) continue;
        const entry =
          byCell.get(cell) ??
          ({
            // 7 weekdays × 24 hours. Small enough to send whole, so the day
            // chips are a filter and not a round trip.
            buckets: Array.from({ length: 7 }, () =>
              new Array<number>(24).fill(0),
            ),
            names: new Map<string, number>(),
          } satisfies { buckets: number[][]; names: Map<string, number> });
        const at = row.completedAt ?? row.requestedAt;
        entry.buckets[at.getDay()]![at.getHours()]! += 1;
        const city = localityName(row.pickupAddress);
        if (city) entry.names.set(city, (entry.names.get(city) ?? 0) + 1);
        byCell.set(cell, entry);
      }

      const here =
        input ??
        (driver.lastLatitude != null && driver.lastLongitude != null
          ? { latitude: driver.lastLatitude, longitude: driver.lastLongitude }
          : null);
      const currentCell = here
        ? toDriverCell(here.latitude, here.longitude)
        : null;

      return {
        currentCell,
        cells: [...byCell.entries()]
          .map(([h3, entry]) => {
            const center = cellCenter(h3);
            return {
              h3,
              label: commonest(entry.names),
              ...center,
              miles: here
                ? distanceMiles(
                    { address: "", ...here },
                    { address: "", ...center },
                  )
                : null,
              current: h3 === currentCell,
              buckets: entry.buckets,
              total: entry.buckets.flat().reduce((sum, n) => sum + n, 0),
            };
          })
          // Where they are first, then where they work most.
          .sort(
            (a, b) =>
              Number(b.current) - Number(a.current) || b.total - a.total,
          )
          .slice(0, TRENDS_CELL_CAP),
      };
    }),

  /**
   * Which offers this driver wants to see. Only the flags that actually do
   * something live here — there is no switch on this route that the inbox
   * does not read.
   */
  setPreferences: protectedProcedure
    .input(
      z.object({
        acceptXl: z.boolean().optional(),
        longTrips: z.boolean().optional(),
        courierJobs: z.boolean().optional(),
        /**
         * Help is consent, not a filter. Turning it on stamps the moment the
         * driver read what Help is; turning it off clears that stamp, so
         * re-enabling walks the explainer again.
         */
        helpJobs: z.boolean().optional(),
        /**
         * Only ever `false` here. Enabling Care is `acknowledgeCareRules`,
         * which is the only path that can write a rules version — a lone
         * `careJobs: true` from a client is not consent and is refused.
         */
        careJobs: z.literal(false).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const helpOff = input.helpJobs === false;
      const [driver] = await ctx.db
        .update(drivers)
        .set({
          ...input,
          ...(input.helpJobs === undefined
            ? {}
            : { helpAcknowledgedAt: input.helpJobs ? new Date() : null }),
          // Care lives inside Help: dropping Help drops Care with it, and the
          // acknowledgement goes with the flag rather than lingering.
          ...(input.careJobs === false || helpOff
            ? {
                careJobs: false,
                careRulesVersion: null,
                careAcknowledgedAt: null,
              }
            : {}),
        })
        .where(eq(drivers.userId, ctx.session.user.id))
        .returning();
      if (!driver) throw new TRPCError({ code: "NOT_FOUND" });
      return driver;
    }),

  /**
   * Care, enabled. The rider-facing product does not gate on this — the
   * *driver* gate is the inbox — so this is the only writer of the three
   * columns, and it writes them together or not at all.
   *
   * The client sends which rules it showed. A stale build cannot enable Care
   * against rules its driver never read.
   */
  acknowledgeCareRules: protectedProcedure
    .input(
      z.object({
        version: z.string().min(1).max(16),
        /** How many rules the driver acknowledged, one at a time. */
        acknowledged: z.number().int().min(0).max(64),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.version !== CARE_RULES_VERSION) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "The Care rules have changed. Read them again to continue.",
        });
      }
      if (input.acknowledged < CARE_RULES.length) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Every Care rule has to be acknowledged.",
        });
      }

      const current = await ctx.db.query.drivers.findFirst({
        where: eq(drivers.userId, ctx.session.user.id),
        columns: { helpJobs: true },
      });
      if (!current) throw new TRPCError({ code: "NOT_FOUND" });
      if (!current.helpJobs) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Enable Help before Care.",
        });
      }

      const [driver] = await ctx.db
        .update(drivers)
        .set({
          careJobs: true,
          careRulesVersion: CARE_RULES_VERSION,
          careAcknowledgedAt: new Date(),
        })
        .where(eq(drivers.userId, ctx.session.user.id))
        .returning();
      if (!driver) throw new TRPCError({ code: "NOT_FOUND" });
      return driver;
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

    // The PIN digits stay on the server. Assigned rides only learn that a
    // PIN is required — never what it is.
    return redactTripPins(trip, isAssigned, RIDER_SAFETY.pickupPin);
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
      // Shop has no sealed package to take custody of: the courier bought the
      // list themselves, so there is no merchant code to read back.
      const shop = courier && Boolean(trip.itemList);
      if (courier && !shop && action === "start") {
        const gate = courierStartAllowed(input.pickupCode, trip.pickupPin);
        if (!gate.ok) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: gate.message,
          });
        }
      }
      if (!courier && action === "start") {
        const required = ridePinRequired({
          productId: trip.productId,
          pickupPin: trip.pickupPin,
          enabled: RIDER_SAFETY.pickupPin,
        });
        const gate = rideStartAllowed(
          input.pickupCode,
          trip.pickupPin,
          required,
        );
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
