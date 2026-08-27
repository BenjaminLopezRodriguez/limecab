import { relations } from "drizzle-orm";
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

    destinationAddress: d.varchar({ length: 512 }).notNull(),
    destinationLatitude: d.doublePrecision(),
    destinationLongitude: d.doublePrecision(),

    productId: d.varchar({ length: 64 }).notNull(),

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

    driverId: d.varchar({ length: 255 }).references(() => drivers.id),

    requestIdempotencyKey: d.varchar({ length: 255 }),

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
    unique("limecab_trip_request_idempotency_unique").on(t.requestIdempotencyKey),
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
    headingAddress: d.varchar({ length: 512 }),
    headingLatitude: d.doublePrecision(),
    headingLongitude: d.doublePrecision(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  }),
  (t) => [
    unique("limecab_driver_user_id_unique").on(t.userId),
    index("limecab_driver_available_idx").on(t.available),
  ],
);

export const tripsRelations = relations(trips, ({ one, many }) => ({
  user: one(users, { fields: [trips.userId], references: [users.id] }),
  driver: one(drivers, { fields: [trips.driverId], references: [drivers.id] }),
  supportTickets: many(supportTickets),
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
