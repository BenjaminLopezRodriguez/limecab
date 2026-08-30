/**
 * Deterministic load ranking. No ML — weighted score from equipment match,
 * deadhead, rate-per-mile, and pickup timing.
 */

import { deadheadMiles, ratePerMile } from "./economics";
import type { EquipmentType } from "./types";

export type RankableLoad = {
  id: string;
  equipmentType: EquipmentType;
  carrierRateMinor: number;
  distanceMeters: number;
  pickupLat: number;
  pickupLng: number;
  pickupAt: Date;
};

export type RankContext = {
  vehicleEquipment: EquipmentType;
  vehicleLat: number;
  vehicleLng: number;
  now: Date;
};

export type RankedLoad = RankableLoad & {
  score: number;
  deadheadMiles: number;
  rpmMinor: number;
};

/** Higher = better. Same inputs → same order. */
export function rankLoads(
  loads: readonly RankableLoad[],
  ctx: RankContext,
): RankedLoad[] {
  const scored = loads.map((load) => {
    const dh = deadheadMiles(
      ctx.vehicleLat,
      ctx.vehicleLng,
      load.pickupLat,
      load.pickupLng,
    );
    const rpm = ratePerMile(load.carrierRateMinor, load.distanceMeters);
    const equipmentMatch = load.equipmentType === ctx.vehicleEquipment ? 1 : 0;
    // Prefer closer pickup: 0–100 decaying with deadhead.
    const deadheadScore = Math.max(0, 100 - dh);
    // Prefer higher RPM (cents/mi); normalize around ~200.
    const rpmScore = Math.min(100, rpm / 3);
    // Prefer sooner pickup within 72h; past pickup → 0.
    const hoursToPickup =
      (load.pickupAt.getTime() - ctx.now.getTime()) / 3_600_000;
    const timingScore =
      hoursToPickup < 0
        ? 0
        : hoursToPickup > 72
          ? 10
          : 100 - (hoursToPickup / 72) * 90;

    const score =
      equipmentMatch * 40 +
      deadheadScore * 0.25 +
      rpmScore * 0.2 +
      timingScore * 0.15;

    return { ...load, score, deadheadMiles: dh, rpmMinor: rpm };
  });

  return scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.id.localeCompare(b.id);
  });
}
