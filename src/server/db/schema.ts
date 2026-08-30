import { relations, sql } from "drizzle-orm";
import { index, pgTableCreator, primaryKey, unique } from "drizzle-orm/pg-core";

import type { TripStatus } from "@/server/limecab/state";
import type { AdapterAccount } from "next-auth/adapters";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `limecab_${name}`);

export const posts = createTable(
  "post",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 256 }),
    createdById: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("limecab_created_by_idx").on(t.createdById),
    index("limecab_name_idx").on(t.name),
  ],
);

export const users = createTable(
  "user",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: d.varchar({ length: 255 }),
    email: d.varchar({ length: 255 }).notNull(),
    emailVerified: d
      .timestamp({
        mode: "date",
        withTimezone: true,
      })
      .$defaultFn(() => /* @__PURE__ */ new Date()),
    image: d.varchar({ length: 255 }),
    phone: d.varchar({ length: 20 }),
    phoneVerifiedAt: d.timestamp({ withTimezone: true }),
    identityStatus: d
      .varchar({ length: 16 })
      .$type<"unverified" | "pending" | "verified">()
      .default("unverified")
      .notNull(),
    identityLegalName: d.varchar({ length: 128 }),
    identitySubmittedAt: d.timestamp({ withTimezone: true }),
  }),
  (t) => [unique("limecab_user_phone_unique").on(t.phone)],
);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  supportTickets: many(supportTickets),
  tripMessages: many(tripMessages),
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("limecab_account_user_id_idx").on(t.userId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [index("limecab_t_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/**
 * LimeCab trips. One row per ride request. Money is integer cents — never
 * float. Fare columns mirror `Fare` in `@/lib/limecab/domain` and are computed
 * server-side at request time so quote and receipt are the same number.
 */
export const trips = createTable(
  "trip",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    status: d
      .varchar({ length: 16 })
      .$type<TripStatus>()
      .default("requested")
      .notNull(),

    pickupAddress: d.varchar({ length: 512 }).notNull(),
    pickupLatitude: d.doublePrecision(),
    pickupLongitude: d.doublePrecision(),
    pickupMeetingPoint: d.varchar({ length: 256 }),
    /** Res-8 cell of the pickup. Null on rows written before this column. */
    pickupH3: d.varchar({ length: 16 }),

    destinationAddress: d.varchar({ length: 512 }).notNull(),
    destinationLatitude: d.doublePrecision(),
    destinationLongitude: d.doublePrecision(),

    productId: d.varchar({ length: 64 }).notNull(),

    /**
     * When the rider asked for the provider to arrive. Lime Help requires it —
     * a visit *is* its clock. Reserve may write the same instant. Null on an
     * immediate ride.
     */
    scheduledAt: d.timestamp({ withTimezone: true }),

    baseCents: d.integer().notNull(),
    distanceCents: d.integer().notNull(),
    timeCents: d.integer().notNull(),
    bookingCents: d.integer().notNull(),
    totalCents: d.integer().notNull(),

    distanceMiles: d.doublePrecision().notNull(),
    tripMinutes: d.integer().notNull(),
    arrivalMinutes: d.integer().notNull(),
    pickupPin: d.varchar({ length: 8 }).notNull(),

    /** Courier extras. Null on a ride — LimeCab still owns the same trip row. */
    recipientName: d.varchar({ length: 80 }),
    recipientPhone: d.varchar({ length: 20 }),
    packageCount: d.integer().default(1).notNull(),
    deliveryProof: d.varchar({ length: 16 }),
    deliveryPin: d.varchar({ length: 8 }),
    pickupVerifiedAt: d.timestamp({ withTimezone: true }),
    deliveryVerifiedAt: d.timestamp({ withTimezone: true }),

    /**
     * Lime Shop's list: a JSON array of `{label, note?}`, validated in
     * `trip.request`. Null on every other trip — a courier row with a list is
     * a Shop trip, which is why Shop needs neither a product id nor a table.
     */
    itemList: d.text(),

    driverId: d.varchar({ length: 255 }).references(() => drivers.id),

    requestIdempotencyKey: d.varchar({ length: 255 }),

    /**
     * Play money. Decided once, at creation, from whether auto-advance was
     * running — never re-derived from a driver id later, because a trip that
     * was demo when it started is demo forever.
     *
     * Nothing financial may reference a row where this is true. It is the gate,
     * and it is a column precisely so that renaming a driver id cannot move it.
     */
    simulated: d.boolean().default(false).notNull(),

    requestedAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    cancelledAt: d.timestamp({ withTimezone: true }),
    completedAt: d.timestamp({ withTimezone: true }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("limecab_trip_user_id_idx").on(t.userId),
    index("limecab_trip_status_idx").on(t.status),
    index("limecab_trip_requested_at_idx").on(t.requestedAt),
    index("limecab_trip_pickup_h3_idx").on(t.pickupH3),
    unique("limecab_trip_request_idempotency_unique").on(t.requestIdempotencyKey),
    // Partial: the interesting set is the small one, and money queries read it.
    index("limecab_trip_simulated_idx").on(t.simulated).where(sql`${t.simulated}`),
  ],
);

/** The driver side of a trip. A driver is a user who accepts rides. */
export const drivers = createTable(
  "driver",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    name: d.varchar({ length: 128 }).notNull(),
    /** Stars ×100 so ratings stay integral, like money. */
    ratingHundredths: d.integer().default(500).notNull(),
    vehicleMake: d.varchar({ length: 64 }).notNull(),
    vehicleModel: d.varchar({ length: 64 }).notNull(),
    vehicleColor: d.varchar({ length: 32 }).notNull(),
    vehiclePlate: d.varchar({ length: 16 }).notNull(),
    available: d.boolean().default(false).notNull(),
    /**
     * Which offers this driver wants. Three booleans rather than a JSON blob:
     * they are queried (`courierJobs` filters the inbox), and a column that is
     * filtered on should be a column.
     */
    acceptXl: d.boolean().default(true).notNull(),
    longTrips: d.boolean().default(true).notNull(),
    courierJobs: d.boolean().default(true).notNull(),
    /**
     * Lime Help is opt-in and defaults off: a driver signed up to drive has
     * not agreed to walk into someone's home. The timestamp records that they
     * read the explainer, and turning the card off clears it.
     */
    helpJobs: d.boolean().default(false).notNull(),
    helpAcknowledgedAt: d.timestamp({ withTimezone: true }),
    /**
     * Care is Help plus a rule list the driver walked one rule at a time. The
     * version is what makes the acknowledgement expire: when the rules change,
     * `careRulesVersion` no longer matches and the inbox stops offering Care
     * until they walk the new list.
     */
    careJobs: d.boolean().default(false).notNull(),
    careRulesVersion: d.varchar({ length: 16 }),
    careAcknowledgedAt: d.timestamp({ withTimezone: true }),
    headingAddress: d.varchar({ length: 512 }),
    headingLatitude: d.doublePrecision(),
    headingLongitude: d.doublePrecision(),
    /**
     * Last known fix. A different thing from the heading columns above: that
     * is where the driver wants to end up, this is where they are standing.
     */
    lastLatitude: d.doublePrecision(),
    lastLongitude: d.doublePrecision(),
    /** Res-8 cell of the fix, so matching is an equality and not a bbox. */
    lastH3: d.varchar({ length: 16 }),
    lastSeenAt: d.timestamp({ withTimezone: true }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  }),
  (t) => [
    unique("limecab_driver_user_id_unique").on(t.userId),
    index("limecab_driver_available_idx").on(t.available),
    index("limecab_driver_last_h3_idx").on(t.lastH3),
  ],
);

/**
 * A user's own places. Home and Work are *slots* — one each, upserted by
 * kind — and `custom` is a list, so there is deliberately no unique on
 * `(userId, kind)`: it would block a second custom spot.
 *
 * `h3` is `SEARCH_H3_RES` and is a query filter only. It is never drawn and
 * never leaves the server.
 */
export const savedPlaces = createTable(
  "saved_place",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    kind: d
      .varchar({ length: 16 })
      .$type<"home" | "work" | "custom">()
      .notNull(),
    label: d.varchar({ length: 64 }).notNull(),
    address: d.varchar({ length: 512 }).notNull(),
    latitude: d.doublePrecision().notNull(),
    longitude: d.doublePrecision().notNull(),
    h3: d.varchar({ length: 16 }).notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("limecab_saved_place_user_idx").on(t.userId),
    index("limecab_saved_place_h3_idx").on(t.h3),
  ],
);

export const savedPlacesRelations = relations(savedPlaces, ({ one }) => ({
  user: one(users, { fields: [savedPlaces.userId], references: [users.id] }),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  user: one(users, { fields: [trips.userId], references: [users.id] }),
  driver: one(drivers, { fields: [trips.driverId], references: [drivers.id] }),
  supportTickets: many(supportTickets),
  messages: many(tripMessages),
}));

/**
 * In-trip chat. One thread per trip; rider and assigned driver only.
 * Support tickets stay a separate table — those go to LimeCab, not the car.
 */
export const tripMessages = createTable(
  "trip_message",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tripId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => trips.id),
    senderUserId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    senderRole: d.varchar({ length: 8 }).$type<"rider" | "driver">().notNull(),
    body: d.varchar({ length: 500 }).notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  }),
  (t) => [
    index("limecab_trip_message_trip_id_idx").on(t.tripId),
    index("limecab_trip_message_trip_created_idx").on(t.tripId, t.createdAt),
  ],
);

export const tripMessagesRelations = relations(tripMessages, ({ one }) => ({
  trip: one(trips, {
    fields: [tripMessages.tripId],
    references: [trips.id],
  }),
  sender: one(users, {
    fields: [tripMessages.senderUserId],
    references: [users.id],
  }),
}));

export const supportTickets = createTable(
  "support_ticket",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    tripId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => trips.id),
    topic: d.varchar({ length: 32 }).notNull(),
    message: d.varchar({ length: 2000 }).notNull(),
    status: d
      .varchar({ length: 16 })
      .$type<"open" | "closed">()
      .default("open")
      .notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  }),
  (t) => [
    index("limecab_support_user_id_idx").on(t.userId),
    index("limecab_support_trip_id_idx").on(t.tripId),
  ],
);

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  user: one(users, {
    fields: [supportTickets.userId],
    references: [users.id],
  }),
  trip: one(trips, {
    fields: [supportTickets.tripId],
    references: [trips.id],
  }),
}));
