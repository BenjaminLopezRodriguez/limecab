import type { RiderStep } from "@lime/interaction-system/scenarios";

/**
 * TEMPORARY MIGRATION ADAPTER — burn-down list for rider steps still served by production web.
 * Delete an entry when the native cluster ships; when a key disappears, that step is native-only.
 *
 * Production web is a stateful SPA at `/`. Paths are entry points, not per-scene routes.
 */
export const RIDER_WEB_FALLBACKS = {
  matching: "/",
  assigned: "/",
  complete: "/",
} satisfies Partial<Record<RiderStep, string>>;

/** Documents steps already implemented natively — set difference is remaining migration surface. */
export const RIDER_NATIVE_STEPS = new Set<RiderStep>([
  "home",
  "rideSelect",
  "confirmPickup",
  "quote",
]);

export function riderFallbackPath(step: RiderStep): string | undefined {
  return RIDER_WEB_FALLBACKS[step as keyof typeof RIDER_WEB_FALLBACKS];
}

export function isRiderNativeStep(step: RiderStep): boolean {
  return RIDER_NATIVE_STEPS.has(step);
}
