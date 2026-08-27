import type { MapPoint } from "@/lib/service-app/map-adapter";

/**
 * Demo dispatch timings. The server auto-advances simulated trips on this
 * cadence; the client clock and car track use the same numbers so the timer,
 * the map, and the status stay in lockstep.
 */
export const SIM_PHASE_MS = {
  requested: 5_000,
  matched: 4_000,
  arriving: 18_000,
  in_progress: 20_000,
} as const;

export const SIM_DRIVER_PREFIX = "sim-driver-";

export function isSimulatedDriverId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith(SIM_DRIVER_PREFIX));
}

type SimulatableStatus = keyof typeof SIM_PHASE_MS;

const NEXT_STATUS = {
  requested: "matched",
  matched: "arriving",
  arriving: "in_progress",
  in_progress: "complete",
} as const;

/** Null until the current simulated phase has run its course. */
export function dueSimulatedStatus(
  status: string,
  elapsedMs: number,
): (typeof NEXT_STATUS)[SimulatableStatus] | null {
  if (!(status in SIM_PHASE_MS)) return null;
  const wait = SIM_PHASE_MS[status as SimulatableStatus];
  if (elapsedMs < wait) return null;
  return NEXT_STATUS[status as SimulatableStatus];
}

/** Stable offset near `origin`, so the approach path does not jump on poll. */
export function simulatedApproachStart(
  origin: MapPoint,
  seed: string,
): MapPoint {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const unsigned = hash >>> 0;
  const angle = (unsigned % 360) * (Math.PI / 180);
  const meters = 450 + ((unsigned >>> 8) % 550);
  const cos = Math.max(0.2, Math.cos((origin.latitude * Math.PI) / 180));
  return {
    latitude: origin.latitude + (meters * Math.cos(angle)) / 111_320,
    longitude: origin.longitude + (meters * Math.sin(angle)) / (111_320 * cos),
    kind: "provider",
  };
}
