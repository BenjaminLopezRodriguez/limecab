/**
 * Freight settlement — snapshot only for v1.
 *
 * Simulated loads MUST NEVER post ledger / Stripe. createSimulatedSettlement
 * inserts freightSettlements only — that IS the earnings record for simulated.
 * refuseLedgerPostIfSimulated is the hard gate if anyone later wires postTransaction.
 */

import { eq } from "drizzle-orm";

import type { db as appDb } from "../db/index.ts";
import { freightSettlements } from "../db/schema.ts";

type Db = typeof appDb;

export type SettlementLoad = {
  id: string;
  status: string;
  carrierId: string | null;
  carrierRateMinor: number;
  currency: string;
  simulated: boolean;
};

export function assertSettlementEligible(
  load: SettlementLoad,
  hasAcceptedPod: boolean,
): void {
  if (load.status !== "POD_PENDING" && load.status !== "COMPLETED") {
    throw new Error(
      `Settlement not eligible from status ${load.status}; need POD_PENDING.`,
    );
  }
  if (!hasAcceptedPod) {
    throw new Error("Settlement requires an accepted POD document.");
  }
  if (!load.carrierId) {
    throw new Error("Settlement requires a booked carrier.");
  }
  if (!Number.isInteger(load.carrierRateMinor) || load.carrierRateMinor < 0) {
    throw new Error("carrierRateMinor must be non-negative integer minor units.");
  }
}

/**
 * Hard refuse: simulated freight never creates real money via ledger.
 * Call before any postTransaction. createSimulatedSettlement must NOT call this
 * for the insert path — settlements table is the allowed simulated record.
 */
export function refuseLedgerPostIfSimulated(load: {
  simulated: boolean;
  id: string;
}): void {
  if (load.simulated) {
    throw new Error(
      `Refusing ledger post for simulated freight load ${load.id}. Use freightSettlements only.`,
    );
  }
}

export type SettlementRowShape = {
  loadId: string;
  carrierId: string;
  amountMinor: number;
  currency: string;
  simulated: boolean;
};

export function settlementRowFromLoad(load: SettlementLoad): SettlementRowShape {
  if (!load.carrierId) throw new Error("carrierId required");
  return {
    loadId: load.id,
    carrierId: load.carrierId,
    amountMinor: load.carrierRateMinor,
    currency: load.currency,
    simulated: load.simulated,
  };
}

/**
 * Insert settlement snapshot if missing.
 * NEVER posts ledger / Stripe — even when simulated===false (v1).
 */
export async function createSimulatedSettlement(
  database: Db,
  load: SettlementLoad,
  hasAcceptedPod: boolean,
): Promise<typeof freightSettlements.$inferSelect> {
  assertSettlementEligible(load, hasAcceptedPod);

  const existing = await database.query.freightSettlements.findFirst({
    where: eq(freightSettlements.loadId, load.id),
  });
  if (existing) return existing;

  const shape = settlementRowFromLoad(load);
  const [row] = await database
    .insert(freightSettlements)
    .values(shape)
    .onConflictDoNothing()
    .returning();

  if (row) return row;

  const again = await database.query.freightSettlements.findFirst({
    where: eq(freightSettlements.loadId, load.id),
  });
  if (!again) throw new Error("Settlement insert raced and vanished.");
  return again;
}
