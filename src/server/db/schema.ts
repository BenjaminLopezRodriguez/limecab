import { relations, sql } from "drizzle-orm";
import {
  index,
  pgTableCreator,
  primaryKey,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type {
  AccessorialStatus,
  AccessorialType,
} from "@/lib/freight/accessorial-state";
import type { DocumentStatus, DocumentType } from "@/lib/freight/document-state";
import type { LoadStatus } from "@/lib/freight/load-state";
import type { QuoteStatus } from "@/lib/freight/quote-state";
import type {
  BookingMode,
  CarrierMemberRole,
  EquipmentType,
  FacilityType,
  LoadMode,
  StopType,
  VehicleStatus,
  WeightUnit,
} from "@/lib/freight/types";
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

/**
 * The ledger. Append-only, double-entry, and the only place that says why a
 * cent exists.
 *
 * Stripe processes money and is asked what it did; this records what Lime
 * believes happened, and the two are reconciled rather than conflated. A
 * balance is never a column somebody increments -- it is SUM over entries, so
 * there is no value that can drift away from its own history.
 *
 * Immutability and the balance rule are enforced by database triggers in
 * `drizzle/0011_ledger.sql`, not by TypeScript. Financial invariants that live
 * only in the application are invariants until the first script runs.
 */
export const ledgerAccounts = createTable(
  "ledger_account",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /**
     * `liability:provider_payable:<driverId>` and friends. Per-beneficiary
     * accounts are rows keyed by owner, never columns on `drivers` -- which is
     * what keeps "what is owed" derived rather than stored.
     */
    key: d.varchar({ length: 255 }).notNull(),
    type: d
      .varchar({ length: 16 })
      .$type<"asset" | "liability" | "revenue" | "expense">()
      .notNull(),
    ownerType: d
      .varchar({ length: 16 })
      .$type<"provider" | "carrier" | "merchant" | "platform">(),
    ownerId: d.varchar({ length: 255 }),
    currency: d.char({ length: 3 }).notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  }),
  (t) => [
    unique("limecab_ledger_account_key_unique").on(t.key),
    index("limecab_ledger_account_owner_idx").on(t.ownerType, t.ownerId),
  ],
);

export const ledgerTransactions = createTable(
  "ledger_transaction",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    kind: d.varchar({ length: 32 }).notNull(),
    /** The economic event. Nullable: a payout settles many services at once. */
    serviceId: d.varchar({ length: 255 }).references(() => trips.id),
    currency: d.char({ length: 3 }).notNull(),
    /**
     * The real guard against double-posting. Stripe prunes its own idempotency
     * keys after 24 hours, so a retry a day later is a fresh request there --
     * this constraint is what still holds.
     */
    idempotencyKey: d.varchar({ length: 255 }).notNull(),
    memo: d.varchar({ length: 512 }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  }),
  (t) => [
    unique("limecab_ledger_transaction_idem_unique").on(t.idempotencyKey),
    index("limecab_ledger_transaction_service_idx").on(t.serviceId),
    index("limecab_ledger_transaction_kind_idx").on(t.kind),
  ],
);

export const ledgerEntries = createTable(
  "ledger_entry",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    transactionId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => ledgerTransactions.id),
    accountId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => ledgerAccounts.id),
    direction: d.varchar({ length: 6 }).$type<"debit" | "credit">().notNull(),
    /**
     * Always positive; `direction` carries the sign. Storing signed amounts
     * would make "credit minus 500" and "debit 500" two spellings of one fact.
     */
    amountMinor: d.bigint({ mode: "number" }).notNull(),
    currency: d.char({ length: 3 }).notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  }),
  (t) => [
    index("limecab_ledger_entry_transaction_idx").on(t.transactionId),
    index("limecab_ledger_entry_account_idx").on(t.accountId),
  ],
);

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  transaction: one(ledgerTransactions, {
    fields: [ledgerEntries.transactionId],
    references: [ledgerTransactions.id],
  }),
  account: one(ledgerAccounts, {
    fields: [ledgerEntries.accountId],
    references: [ledgerAccounts.id],
  }),
}));

export const ledgerTransactionsRelations = relations(
  ledgerTransactions,
  ({ many }) => ({ entries: many(ledgerEntries) }),
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

/* -------------------------------------------------------------------------- */
/* Lime Freight — Load tables (NOT trips). Simulated money only.              */
/* -------------------------------------------------------------------------- */

export const freightCarriers = createTable("freight_carrier", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.varchar({ length: 255 }).notNull(),
  organizationName: d.varchar({ length: 255 }),
  simulated: d.boolean().default(false).notNull(),
  createdAt: d
    .timestamp({ withTimezone: true })
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
}));

export const freightCarrierMembers = createTable(
  "freight_carrier_member",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    carrierId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => freightCarriers.id),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    role: d.varchar({ length: 16 }).$type<CarrierMemberRole>().notNull(),
  }),
  (t) => [
    unique("limecab_freight_carrier_member_unique").on(t.carrierId, t.userId),
    index("limecab_freight_carrier_member_user_idx").on(t.userId),
  ],
);

export const freightCarrierInvites = createTable(
  "freight_carrier_invite",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    carrierId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => freightCarriers.id),
    /** Short, human-typable. Unique so acceptance can CAS on one row. */
    code: d.varchar({ length: 32 }).notNull(),
    role: d.varchar({ length: 16 }).$type<CarrierMemberRole>().notNull(),
    invitedEmail: d.varchar({ length: 255 }),
    invitedName: d.varchar({ length: 128 }),
    createdByUserId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    expiresAt: d.timestamp({ withTimezone: true }).notNull(),
    /** Set once. The single-use gate — acceptance CASes on this being null. */
    acceptedByUserId: d.varchar({ length: 255 }).references(() => users.id),
    acceptedAt: d.timestamp({ withTimezone: true }),
    revokedAt: d.timestamp({ withTimezone: true }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  }),
  (t) => [
    unique("limecab_freight_carrier_invite_code_unique").on(t.code),
    index("limecab_freight_carrier_invite_carrier_idx").on(t.carrierId),
  ],
);

export const freightVehicles = createTable(
  "freight_vehicle",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    carrierId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => freightCarriers.id),
    unitNumber: d.varchar({ length: 64 }).notNull(),
    equipmentType: d.varchar({ length: 16 }).$type<EquipmentType>().notNull(),
    status: d
      .varchar({ length: 16 })
      .$type<VehicleStatus>()
      .default("AVAILABLE")
      .notNull(),
  }),
  (t) => [
    index("limecab_freight_vehicle_carrier_idx").on(t.carrierId),
    unique("limecab_freight_vehicle_unit_unique").on(t.carrierId, t.unitNumber),
  ],
);

export const freightFacilities = createTable(
  "freight_facility",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: d.varchar({ length: 255 }).notNull(),
    type: d.varchar({ length: 32 }).$type<FacilityType>().notNull(),
    address: d.varchar({ length: 512 }).notNull(),
    city: d.varchar({ length: 128 }).notNull(),
    region: d.varchar({ length: 64 }).notNull(),
    lat: d.doublePrecision().notNull(),
    lng: d.doublePrecision().notNull(),
    placeId: d.varchar({ length: 255 }),
    h3: d.varchar({ length: 16 }),
    notes: d.text(),
    parking: d.boolean().default(false).notNull(),
    restroom: d.boolean().default(false).notNull(),
    scale: d.boolean().default(false).notNull(),
    appointmentRequired: d.boolean().default(false).notNull(),
  }),
  (t) => [index("limecab_freight_facility_h3_idx").on(t.h3)],
);

export const freightFacilityRatings = createTable(
  "freight_facility_rating",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    facilityId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => freightFacilities.id),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    rating: d.integer().notNull(),
    tags: d.text(),
    comment: d.varchar({ length: 1000 }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  }),
  (t) => [
    index("limecab_freight_facility_rating_facility_idx").on(t.facilityId),
  ],
);

export const freightLoads = createTable(
  "freight_load",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    shipperUserId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    carrierId: d
      .varchar({ length: 255 })
      .references(() => freightCarriers.id),
    assignedDriverUserId: d
      .varchar({ length: 255 })
      .references(() => users.id),
    assignedVehicleId: d
      .varchar({ length: 255 })
      .references(() => freightVehicles.id),
    status: d
      .varchar({ length: 32 })
      .$type<LoadStatus>()
      .default("DRAFT")
      .notNull(),
    mode: d.varchar({ length: 8 }).$type<LoadMode>().default("FTL").notNull(),
    equipmentType: d.varchar({ length: 16 }).$type<EquipmentType>().notNull(),
    commodity: d.varchar({ length: 255 }),
    totalWeight: d.integer().notNull(),
    weightUnit: d
      .varchar({ length: 8 })
      .$type<WeightUnit>()
      .default("LB")
      .notNull(),
    pallets: d.integer(),
    pieces: d.integer(),
    distanceMeters: d.integer().notNull(),
    estimatedDurationSec: d.integer(),
    shipperPriceMinor: d.integer().notNull(),
    carrierRateMinor: d.integer().notNull(),
    currency: d.char({ length: 3 }).notNull().default("USD"),
    bookingMode: d
      .varchar({ length: 16 })
      .$type<BookingMode>()
      .default("INSTANT")
      .notNull(),
    specialRequirements: d.text(),
    simulated: d.boolean().notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    quotedAt: d.timestamp({ withTimezone: true }),
    bookedAt: d.timestamp({ withTimezone: true }),
    pickedUpAt: d.timestamp({ withTimezone: true }),
    deliveredAt: d.timestamp({ withTimezone: true }),
    completedAt: d.timestamp({ withTimezone: true }),
    canceledAt: d.timestamp({ withTimezone: true }),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("limecab_freight_load_shipper_idx").on(t.shipperUserId),
    index("limecab_freight_load_carrier_idx").on(t.carrierId),
    index("limecab_freight_load_status_idx").on(t.status),
    // Partial: AVAILABLE set is the booking race window; CAS books against it.
    index("limecab_freight_load_available_idx")
      .on(t.status)
      .where(sql`${t.status} = 'AVAILABLE'`),
    index("limecab_freight_load_simulated_idx")
      .on(t.simulated)
      .where(sql`${t.simulated}`),
  ],
);

export const freightStops = createTable(
  "freight_stop",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    loadId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => freightLoads.id),
    sequence: d.integer().notNull(),
    type: d.varchar({ length: 16 }).$type<StopType>().notNull(),
    facilityId: d
      .varchar({ length: 255 })
      .references(() => freightFacilities.id),
    address: d.varchar({ length: 512 }).notNull(),
    city: d.varchar({ length: 128 }).notNull(),
    region: d.varchar({ length: 64 }).notNull(),
    lat: d.doublePrecision().notNull(),
    lng: d.doublePrecision().notNull(),
    h3: d.varchar({ length: 16 }),
    appointmentStart: d.timestamp({ withTimezone: true }),
    appointmentEnd: d.timestamp({ withTimezone: true }),
    instructions: d.text(),
    arrivalAt: d.timestamp({ withTimezone: true }),
    checkInAt: d.timestamp({ withTimezone: true }),
    loadingStartedAt: d.timestamp({ withTimezone: true }),
    loadingFinishedAt: d.timestamp({ withTimezone: true }),
    departedAt: d.timestamp({ withTimezone: true }),
  }),
  (t) => [
    index("limecab_freight_stop_load_idx").on(t.loadId),
    unique("limecab_freight_stop_load_seq_unique").on(t.loadId, t.sequence),
  ],
);

export const freightQuotes = createTable(
  "freight_quote",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    loadId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => freightLoads.id),
    amountMinor: d.integer().notNull(),
    currency: d.char({ length: 3 }).notNull().default("USD"),
    equipmentType: d.varchar({ length: 16 }).$type<EquipmentType>().notNull(),
    expiresAt: d.timestamp({ withTimezone: true }).notNull(),
    pricingVersion: d.varchar({ length: 32 }).notNull(),
    distanceComponent: d.integer().notNull(),
    equipmentComponent: d.integer().notNull(),
    marketAdjustment: d.integer(),
    accessorialEstimate: d.integer(),
    status: d
      .varchar({ length: 16 })
      .$type<QuoteStatus>()
      .default("PENDING")
      .notNull(),
  }),
  (t) => [index("limecab_freight_quote_load_idx").on(t.loadId)],
);

export const freightBids = createTable(
  "freight_bid",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    loadId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => freightLoads.id),
    carrierId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => freightCarriers.id),
    amountMinor: d.integer().notNull(),
    currency: d.char({ length: 3 }).notNull().default("USD"),
    status: d
      .varchar({ length: 16 })
      .$type<"OPEN" | "ACCEPTED" | "REJECTED" | "WITHDRAWN">()
      .default("OPEN")
      .notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  }),
  (t) => [
    index("limecab_freight_bid_load_idx").on(t.loadId),
    index("limecab_freight_bid_carrier_idx").on(t.carrierId),
  ],
);

export const freightSavedLanes = createTable(
  "freight_saved_lane",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    carrierId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => freightCarriers.id),
    originLabel: d.varchar({ length: 255 }).notNull(),
    destLabel: d.varchar({ length: 255 }).notNull(),
    originLat: d.doublePrecision().notNull(),
    originLng: d.doublePrecision().notNull(),
    destLat: d.doublePrecision().notNull(),
    destLng: d.doublePrecision().notNull(),
    equipmentTypes: d.text().notNull(),
    radiusMeters: d.integer().notNull(),
    active: d.boolean().default(true).notNull(),
  }),
  (t) => [index("limecab_freight_saved_lane_carrier_idx").on(t.carrierId)],
);

export const freightDocuments = createTable(
  "freight_document",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    loadId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => freightLoads.id),
    type: d.varchar({ length: 32 }).$type<DocumentType>().notNull(),
    uploadedByUserId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    storageReference: d.varchar({ length: 512 }).notNull(),
    status: d
      .varchar({ length: 16 })
      .$type<DocumentStatus>()
      .default("PENDING")
      .notNull(),
    verifiedAt: d.timestamp({ withTimezone: true }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  }),
  (t) => [index("limecab_freight_document_load_idx").on(t.loadId)],
);

export const freightAccessorialRequests = createTable(
  "freight_accessorial_request",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    loadId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => freightLoads.id),
    carrierId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => freightCarriers.id),
    type: d.varchar({ length: 32 }).$type<AccessorialType>().notNull(),
    amountMinor: d.integer(),
    notes: d.text(),
    documentId: d
      .varchar({ length: 255 })
      .references(() => freightDocuments.id),
    status: d
      .varchar({ length: 16 })
      .$type<AccessorialStatus>()
      .default("REQUESTED")
      .notNull(),
  }),
  (t) => [index("limecab_freight_accessorial_load_idx").on(t.loadId)],
);

export const freightExceptions = createTable(
  "freight_exception",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    loadId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => freightLoads.id),
    type: d.varchar({ length: 64 }).notNull(),
    reportedByUserId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    notes: d.text(),
    status: d
      .varchar({ length: 16 })
      .$type<"OPEN" | "RESOLVED">()
      .default("OPEN")
      .notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  }),
  (t) => [index("limecab_freight_exception_load_idx").on(t.loadId)],
);

export const freightTrackingPings = createTable(
  "freight_tracking_ping",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    loadId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => freightLoads.id),
    lat: d.doublePrecision().notNull(),
    lng: d.doublePrecision().notNull(),
    timestamp: d.timestamp({ withTimezone: true }).notNull(),
    source: d
      .varchar({ length: 16 })
      .$type<"DRIVER_APP" | "ELD" | "CARRIER_API" | "MANUAL">()
      .notNull(),
  }),
  (t) => [
    index("limecab_freight_tracking_load_idx").on(t.loadId),
    index("limecab_freight_tracking_load_ts_idx").on(t.loadId, t.timestamp),
  ],
);

export const freightDriverAssignments = createTable(
  "freight_driver_assignment",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    loadId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => freightLoads.id),
    driverUserId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    vehicleId: d
      .varchar({ length: 255 })
      .references(() => freightVehicles.id),
    assignedAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    releasedAt: d.timestamp({ withTimezone: true }),
  }),
  (t) => [
    index("limecab_freight_driver_assignment_load_idx").on(t.loadId),
    index("limecab_freight_driver_assignment_driver_idx").on(t.driverUserId),
    // One active assignment per load (releasedAt IS NULL).
    uniqueIndex("limecab_freight_driver_assignment_active_load_unique")
      .on(t.loadId)
      .where(sql`${t.releasedAt} is null`),
  ],
);

/**
 * Freight settlement snapshot — NOT ledger, NOT Stripe.
 * Simulated loads record earnings here only. Never call postTransaction for
 * simulated===true; real payout path is out of scope for v1.
 */
export const freightSettlements = createTable(
  "freight_settlement",
  (d) => ({
    id: d
      .varchar({ length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    loadId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => freightLoads.id),
    carrierId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => freightCarriers.id),
    amountMinor: d.integer().notNull(),
    currency: d.char({ length: 3 }).notNull().default("USD"),
    simulated: d.boolean().notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  }),
  (t) => [
    unique("limecab_freight_settlement_load_unique").on(t.loadId),
    index("limecab_freight_settlement_carrier_idx").on(t.carrierId),
  ],
);

export const freightCarriersRelations = relations(
  freightCarriers,
  ({ many }) => ({
    members: many(freightCarrierMembers),
    invites: many(freightCarrierInvites),
    vehicles: many(freightVehicles),
    loads: many(freightLoads),
    savedLanes: many(freightSavedLanes),
  }),
);

export const freightCarrierMembersRelations = relations(
  freightCarrierMembers,
  ({ one }) => ({
    carrier: one(freightCarriers, {
      fields: [freightCarrierMembers.carrierId],
      references: [freightCarriers.id],
    }),
    user: one(users, {
      fields: [freightCarrierMembers.userId],
      references: [users.id],
    }),
  }),
);

export const freightCarrierInvitesRelations = relations(
  freightCarrierInvites,
  ({ one }) => ({
    carrier: one(freightCarriers, {
      fields: [freightCarrierInvites.carrierId],
      references: [freightCarriers.id],
    }),
  }),
);

export const freightVehiclesRelations = relations(
  freightVehicles,
  ({ one }) => ({
    carrier: one(freightCarriers, {
      fields: [freightVehicles.carrierId],
      references: [freightCarriers.id],
    }),
  }),
);

export const freightLoadsRelations = relations(
  freightLoads,
  ({ one, many }) => ({
    shipper: one(users, {
      fields: [freightLoads.shipperUserId],
      references: [users.id],
    }),
    carrier: one(freightCarriers, {
      fields: [freightLoads.carrierId],
      references: [freightCarriers.id],
    }),
    assignedDriver: one(users, {
      fields: [freightLoads.assignedDriverUserId],
      references: [users.id],
    }),
    assignedVehicle: one(freightVehicles, {
      fields: [freightLoads.assignedVehicleId],
      references: [freightVehicles.id],
    }),
    stops: many(freightStops),
    quotes: many(freightQuotes),
    bids: many(freightBids),
    documents: many(freightDocuments),
    accessorials: many(freightAccessorialRequests),
    exceptions: many(freightExceptions),
    trackingPings: many(freightTrackingPings),
    driverAssignments: many(freightDriverAssignments),
    settlements: many(freightSettlements),
  }),
);

export const freightStopsRelations = relations(freightStops, ({ one }) => ({
  load: one(freightLoads, {
    fields: [freightStops.loadId],
    references: [freightLoads.id],
  }),
  facility: one(freightFacilities, {
    fields: [freightStops.facilityId],
    references: [freightFacilities.id],
  }),
}));

export const freightFacilitiesRelations = relations(
  freightFacilities,
  ({ many }) => ({
    ratings: many(freightFacilityRatings),
    stops: many(freightStops),
  }),
);

export const freightFacilityRatingsRelations = relations(
  freightFacilityRatings,
  ({ one }) => ({
    facility: one(freightFacilities, {
      fields: [freightFacilityRatings.facilityId],
      references: [freightFacilities.id],
    }),
    user: one(users, {
      fields: [freightFacilityRatings.userId],
      references: [users.id],
    }),
  }),
);

export const freightQuotesRelations = relations(freightQuotes, ({ one }) => ({
  load: one(freightLoads, {
    fields: [freightQuotes.loadId],
    references: [freightLoads.id],
  }),
}));

export const freightBidsRelations = relations(freightBids, ({ one }) => ({
  load: one(freightLoads, {
    fields: [freightBids.loadId],
    references: [freightLoads.id],
  }),
  carrier: one(freightCarriers, {
    fields: [freightBids.carrierId],
    references: [freightCarriers.id],
  }),
}));

export const freightSavedLanesRelations = relations(
  freightSavedLanes,
  ({ one }) => ({
    carrier: one(freightCarriers, {
      fields: [freightSavedLanes.carrierId],
      references: [freightCarriers.id],
    }),
  }),
);

export const freightDocumentsRelations = relations(
  freightDocuments,
  ({ one }) => ({
    load: one(freightLoads, {
      fields: [freightDocuments.loadId],
      references: [freightLoads.id],
    }),
    uploadedBy: one(users, {
      fields: [freightDocuments.uploadedByUserId],
      references: [users.id],
    }),
  }),
);

export const freightAccessorialRequestsRelations = relations(
  freightAccessorialRequests,
  ({ one }) => ({
    load: one(freightLoads, {
      fields: [freightAccessorialRequests.loadId],
      references: [freightLoads.id],
    }),
    carrier: one(freightCarriers, {
      fields: [freightAccessorialRequests.carrierId],
      references: [freightCarriers.id],
    }),
    document: one(freightDocuments, {
      fields: [freightAccessorialRequests.documentId],
      references: [freightDocuments.id],
    }),
  }),
);

export const freightExceptionsRelations = relations(
  freightExceptions,
  ({ one }) => ({
    load: one(freightLoads, {
      fields: [freightExceptions.loadId],
      references: [freightLoads.id],
    }),
    reportedBy: one(users, {
      fields: [freightExceptions.reportedByUserId],
      references: [users.id],
    }),
  }),
);

export const freightTrackingPingsRelations = relations(
  freightTrackingPings,
  ({ one }) => ({
    load: one(freightLoads, {
      fields: [freightTrackingPings.loadId],
      references: [freightLoads.id],
    }),
  }),
);

export const freightDriverAssignmentsRelations = relations(
  freightDriverAssignments,
  ({ one }) => ({
    load: one(freightLoads, {
      fields: [freightDriverAssignments.loadId],
      references: [freightLoads.id],
    }),
    driver: one(users, {
      fields: [freightDriverAssignments.driverUserId],
      references: [users.id],
    }),
    vehicle: one(freightVehicles, {
      fields: [freightDriverAssignments.vehicleId],
      references: [freightVehicles.id],
    }),
  }),
);

export const freightSettlementsRelations = relations(
  freightSettlements,
  ({ one }) => ({
    load: one(freightLoads, {
      fields: [freightSettlements.loadId],
      references: [freightLoads.id],
    }),
    carrier: one(freightCarriers, {
      fields: [freightSettlements.carrierId],
      references: [freightCarriers.id],
    }),
  }),
);
