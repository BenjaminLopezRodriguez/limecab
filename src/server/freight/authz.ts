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
};

export function capabilitiesForRole(
  role: CarrierMemberRole,
): CarrierCapabilities {
  const dispatch = role === "OWNER" || role === "DISPATCHER";
  return {
    canBook: dispatch || role === "DRIVER",
    canAssign: dispatch,
    canDrive: role === "DRIVER" || role === "OWNER",
    canManageFleet: role === "OWNER",
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
