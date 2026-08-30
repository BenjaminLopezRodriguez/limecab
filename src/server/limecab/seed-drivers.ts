/**
 * Seeds the mock DRIVER_POOL as real driver rows so the driver app has an
 * account to sign in as. Idempotent — placeholder users and drivers are keyed
 * by a stable id derived from the pool entry.
 */
import { DRIVER_POOL } from "@/lib/limecab/mock";
import { SEED_DRIVER_PREFIX } from "@/lib/limecab/simulate";
import { db } from "@/server/db";
import { drivers, users } from "@/server/db/schema";

async function main() {
  for (const d of DRIVER_POOL) {
    const userId = `${SEED_DRIVER_PREFIX}${d.id}`;
    await db
      .insert(users)
      .values({ id: userId, name: d.name, email: `${d.id}@drivers.limecab.test` })
      .onConflictDoNothing();

    await db
      .insert(drivers)
      .values({
        id: `${SEED_DRIVER_PREFIX}${d.id}`,
        userId,
        name: d.name,
        ratingHundredths: Math.round(d.rating * 100),
        vehicleMake: d.vehicle.make,
        vehicleModel: d.vehicle.model,
        vehicleColor: d.vehicle.color,
        vehiclePlate: d.vehicle.plate,
        available: true,
      })
      .onConflictDoNothing({ target: drivers.userId });
  }
  console.log(`seeded ${DRIVER_POOL.length} drivers`);
}

await main();
process.exit(0);
