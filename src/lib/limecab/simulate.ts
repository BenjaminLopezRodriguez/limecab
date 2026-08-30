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
/** `seed-drivers.ts` mints these so the driver app has an account to sign in as. */
export const SEED_DRIVER_PREFIX = "seed-driver-";

/**
 * Auto-advance only ever drives its *own* drivers. A seeded driver is a person
 * signing in and tapping buttons, so their trips must not move underneath them.
 */
export function isSimulatedDriverId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith(SIM_DRIVER_PREFIX));
}

/**
 * The money question, which is a wider net than the dispatch question: seeded
 * drivers are fake too, and a fare they "completed" is not a fare anyone owes.
 * Anything financial asks this, never `isSimulatedDriverId`.
 */
export function isSyntheticDriverId(id: string | null | undefined): boolean {
  return isSimulatedDriverId(id) || Boolean(id?.startsWith(SEED_DRIVER_PREFIX));
}

/**
 * Whether a trip is play money, decided once at creation and never inferred
 * again. Auto-advance running at all is enough to taint a trip: it can claim
 * any unmatched row, so a trip born into a simulating environment can never be
 * trusted as real, whoever ends up driving it.
 *
 * A string prefix decided this before, which meant a renamed id would have
 * silently turned demo rides into payable ones.
 */
export function tripIsSimulated(input: {
  simulationEnabled: boolean;
  driverId?: string | null;
}): boolean {
  return input.simulationEnabled || isSyntheticDriverId(input.driverId);
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
