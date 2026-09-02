import type { DriverStep } from "@lime/interaction-system/scenarios";

/**
 * TEMPORARY MIGRATION ADAPTER — burn-down list for driver steps still served by production web.
 * Delete an entry when the native cluster ships; when a key disappears, that step is native-only.
 *
 * Production driver product lives at `/driver`.
 */
export const DRIVER_WEB_FALLBACKS = {
  enRoute: "/driver",
  arrived: "/driver",
  inTrip: "/driver",
  complete: "/driver",
  earnings: "/driver",
} satisfies Partial<Record<DriverStep, string>>;

/** Documents steps already implemented natively — set difference is remaining migration surface. */
export const DRIVER_NATIVE_STEPS = new Set<DriverStep>(["offline", "online", "offer"]);

export function driverFallbackPath(step: DriverStep): string | undefined {
  return DRIVER_WEB_FALLBACKS[step as keyof typeof DRIVER_WEB_FALLBACKS];
}

export function isDriverNativeStep(step: DriverStep): boolean {
  return DRIVER_NATIVE_STEPS.has(step);
}
