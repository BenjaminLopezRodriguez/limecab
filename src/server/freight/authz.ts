import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import type { CarrierMemberRole } from "../../lib/freight/types.ts";
import type { db as appDb } from "../db/index.ts";
import { freightCarrierMembers, freightLoads } from "../db/schema.ts";

type Db = typeof appDb;

export type CarrierMembership = {
  id: string;
  carrierId: string;
  userId: string;
  role: CarrierMemberRole;
};

export type CarrierCapabilities = {
  canBook: boolean;
  canAssign: boolean;
  /** DRIVER (and OWNER for self-drive) may run the load. */
  canDrive: boolean;
  canManageFleet: boolean;
  /** Money. Dispatch prices lanes; drivers are not paid the load rate. */
  canSeeRate: boolean;
};

export function capabilitiesForRole(
  role: CarrierMemberRole,
): CarrierCapabilities {
  const dispatch = role === "OWNER" || role === "DISPATCHER";
  return {
    // Booking binds the carrier to a lane — that is dispatch, not driving
    // (freeze A). An owner-operator still books, via OWNER.
    canBook: dispatch,
    canAssign: dispatch,
    canDrive: role === "DRIVER" || role === "OWNER",
    canManageFleet: role === "OWNER",
    canSeeRate: dispatch,
  };
}

export async function getCarrierMembership(
  database: Db,
  userId: string,
  carrierId?: string,
): Promise<CarrierMembership | null> {
  const rows = await database.query.freightCarrierMembers.findMany({
    where: eq(freightCarrierMembers.userId, userId),
  });
  if (rows.length === 0) return null;
  if (carrierId) {
    const hit = rows.find((r) => r.carrierId === carrierId);
    return hit ? (hit as CarrierMembership) : null;
  }
  return rows[0] as CarrierMembership;
}

export async function getAllCarrierMemberships(
  database: Db,
  userId: string,
): Promise<CarrierMembership[]> {
  const rows = await database.query.freightCarrierMembers.findMany({
    where: eq(freightCarrierMembers.userId, userId),
  });
  return rows as CarrierMembership[];
}

export function requireShipperOwnsLoad(
  load: { shipperUserId: string },
  userId: string,
): void {
  if (load.shipperUserId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not your shipment." });
  }
}

/**
 * Marketplace AVAILABLE: any carrier member.
 * Booked+ : only members of the load's carrier.
 */
export function requireCarrierAccess(
  load: { status: string; carrierId: string | null },
  membership: CarrierMembership | null,
): CarrierMembership {
  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Carrier membership required.",
    });
  }
  if (load.status === "AVAILABLE") return membership;
  if (load.carrierId && load.carrierId === membership.carrierId) {
    return membership;
  }
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Load not visible to this carrier.",
  });
}

export function requireDriverAssigned(
  load: { assignedDriverUserId: string | null },
  userId: string,
): void {
  if (load.assignedDriverUserId !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Not the assigned driver.",
    });
  }
}

export async function loadById(database: Db, loadId: string) {
  const load = await database.query.freightLoads.findFirst({
    where: eq(freightLoads.id, loadId),
  });
  if (!load) throw new TRPCError({ code: "NOT_FOUND", message: "Load not found." });
  return load;
}

/**
 * Strip the money the viewer has no business reading, on the server.
 *
 * - Shipper keeps `shipperPriceMinor` — it is the price they agreed to — and
 *   never sees `carrierRateMinor`, which is the carrier's side of the spread.
 * - Carrier dispatch keeps `carrierRateMinor` and never sees the shipper
 *   price: no carrier role has a reason to read the broker margin.
 * - Everyone else (a DRIVER, or an assigned driver with no dispatch
 *   capability) gets neither. An employee driver is not paid the load rate.
 *
 * Redacted fields are ABSENT, not zero: `$0.00` on a sheet is a lie, while a
 * missing value lets the surface say nothing.
 *
 * ponytail: one helper, applied at the read sites. Not a field-level
 * permission framework — there are two fields.
 */
export type RedactedLoad<T> = Omit<
  T,
  "shipperPriceMinor" | "carrierRateMinor"
> & {
  shipperPriceMinor?: number;
  carrierRateMinor?: number;
};

export function redactLoadForRole<
  T extends { shipperPriceMinor: number; carrierRateMinor: number },
>(
  load: T,
  viewer: { canSeeRate: boolean; isShipper: boolean },
): RedactedLoad<T> {
  const { shipperPriceMinor, carrierRateMinor, ...rest } = load;
  // The return type is optional on purpose rather than cast back to `T`. A
  // type that still promises `number` is how this redaction regresses: the
  // next surface reads `load.carrierRateMinor`, tsc says fine, and a driver
  // sees `$0.00` — or worse, the field is quietly put back to satisfy it.
  // Making the absence visible in the type forces every reader to say what
  // it shows when there is nothing to show.
  return {
    ...rest,
    ...(viewer.isShipper ? { shipperPriceMinor } : {}),
    ...(viewer.canSeeRate && !viewer.isShipper ? { carrierRateMinor } : {}),
  };
}
