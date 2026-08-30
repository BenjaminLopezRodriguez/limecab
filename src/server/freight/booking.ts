/**
 * CAS book for AVAILABLE loads. WHERE is the lock — loser updates 0 rows.
 */

import { and, eq, isNull } from "drizzle-orm";

import {
  ACTION_TARGET,
  carrierMay,
  canTransition,
} from "../../lib/freight/load-state.ts";
import type { db as appDb } from "../db/index.ts";
import { freightLoads } from "../db/schema.ts";

type Db = typeof appDb;

export type BookClaimState = {
  status: string;
  carrierId: string | null;
};

/**
 * Pure race simulator: two claimants see same AVAILABLE row; only first wins.
 */
export function tryClaimAvailableLoad(
  state: BookClaimState,
  carrierId: string,
): { ok: true; next: BookClaimState } | { ok: false; reason: "not_available" } {
  if (state.status !== "AVAILABLE" || state.carrierId !== null) {
    return { ok: false, reason: "not_available" };
  }
  if (!carrierMay("AVAILABLE", "book")) {
    return { ok: false, reason: "not_available" };
  }
  if (!canTransition("AVAILABLE", ACTION_TARGET.book)) {
    return { ok: false, reason: "not_available" };
  }
  return {
    ok: true,
    next: { status: ACTION_TARGET.book, carrierId },
  };
}

/**
 * Simulate two concurrent claims against one in-memory AVAILABLE load.
 * Second claim always loses after first mutates shared state.
 */
export function simulateBookRace(
  shared: BookClaimState,
  firstCarrierId: string,
  secondCarrierId: string,
): { winner: string; loser: string } {
  const a = tryClaimAvailableLoad(shared, firstCarrierId);
  if (!a.ok) throw new Error("first claim should win");
  Object.assign(shared, a.next);
  const b = tryClaimAvailableLoad(shared, secondCarrierId);
  if (b.ok) throw new Error("second claim must lose");
  return { winner: firstCarrierId, loser: secondCarrierId };
}

export async function bookLoadExclusive(
  database: Db,
  loadId: string,
  carrierId: string,
): Promise<
  | { ok: true; load: typeof freightLoads.$inferSelect }
  | { ok: false }
> {
  const now = new Date();
  const [row] = await database
    .update(freightLoads)
    .set({
      carrierId,
      status: ACTION_TARGET.book,
      bookedAt: now,
    })
    .where(
      and(
        eq(freightLoads.id, loadId),
        eq(freightLoads.status, "AVAILABLE"),
        isNull(freightLoads.carrierId),
      ),
    )
    .returning();

  if (!row) return { ok: false };
  return { ok: true, load: row };
}
