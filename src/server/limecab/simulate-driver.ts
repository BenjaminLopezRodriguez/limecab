import { and, eq, isNull } from "drizzle-orm";

import { env } from "@/env";
import { DRIVER_POOL } from "@/lib/limecab/mock";
import {
  dueSimulatedStatus,
  isSimulatedDriverId,
  SIM_DRIVER_PREFIX,
} from "@/lib/limecab/simulate";
import { db } from "@/server/db";
import { drivers, trips, users } from "@/server/db/schema";
import { canTransition } from "@/server/limecab/state";

type Db = typeof db;

type TripRow = typeof trips.$inferSelect;

/**
 * Mint a fake driver and walk the trip through matching → on the way →
 * in progress → done. Used so a single browser can demo the rider flow
 * without a second signed-in driver account.
 *
 * Off in production unless SIMULATE_DRIVERS=true. A real driver who accepts
 * first always wins — simulation never overwrites a human assignment.
 */
export function simulationEnabled(): boolean {
  const flag = env.SIMULATE_DRIVERS;
  if (flag === "false") return false;
  if (flag === "true") return true;
  return env.NODE_ENV !== "production";
}

export async function maybeSimulateTrip<T extends TripRow>(
  database: Db,
  trip: T,
): Promise<T> {
  if (!simulationEnabled()) return trip;
  if (trip.status === "complete" || trip.status === "cancelled") return trip;
  if (trip.driverId && !isSimulatedDriverId(trip.driverId)) return trip;

  const since =
    trip.status === "requested"
      ? trip.requestedAt
      : (trip.updatedAt ?? trip.requestedAt);
  const next = dueSimulatedStatus(
    trip.status,
    Date.now() - since.getTime(),
  );
  if (!next) return trip;
  if (!canTransition(trip.status, next)) return trip;

  if (trip.status === "requested" && next === "matched") {
    return (await assignSimulatedDriver(database, trip)) ?? trip;
  }

  const now = new Date();
  const [advanced] = await database
    .update(trips)
    .set({
      status: next,
      updatedAt: now,
      ...(next === "in_progress" ? { pickupVerifiedAt: now } : {}),
      ...(next === "complete" ? { completedAt: now } : {}),
    })
    .where(and(eq(trips.id, trip.id), eq(trips.status, trip.status)))
    .returning();

  return (advanced as T | undefined) ?? trip;
}

async function assignSimulatedDriver<T extends TripRow>(
  database: Db,
  trip: T,
): Promise<T | null> {
  const fleet = DRIVER_POOL[hashIndex(trip.id, DRIVER_POOL.length)]!;
  const userId = `${SIM_DRIVER_PREFIX}user-${trip.id}`;
  const driverId = `${SIM_DRIVER_PREFIX}${trip.id}`;

  await database
    .insert(users)
    .values({
      id: userId,
      name: fleet.name,
      email: `${driverId}@drivers.limecab.test`,
    })
    .onConflictDoNothing();

  await database
    .insert(drivers)
    .values({
      id: driverId,
      userId,
      name: fleet.name,
      ratingHundredths: Math.round(fleet.rating * 100),
      vehicleMake: fleet.vehicle.make,
      vehicleModel: fleet.vehicle.model,
      vehicleColor: fleet.vehicle.color,
      vehiclePlate: fleet.vehicle.plate,
      available: false,
    })
    .onConflictDoNothing();

  const [assigned] = await database
    .update(trips)
    .set({
      driverId,
      status: "matched",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(trips.id, trip.id),
        eq(trips.status, "requested"),
        isNull(trips.driverId),
      ),
    )
    .returning();

  return (assigned as T | undefined) ?? null;
}

function hashIndex(seed: string, modulo: number): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return modulo === 0 ? 0 : (hash >>> 0) % modulo;
}
