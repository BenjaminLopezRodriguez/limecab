/**
 * TEMPORARY MIGRATION ADAPTER — delete this package when native burn-down completes.
 */

export { LegacyWebSurface, resolveLimeWebBaseUrl } from "./LegacyWebSurface.tsx";
export type { LegacyWebSurfaceProps, WebBridgeEvent, WebBridgeProduct } from "./types.ts";
export {
  DRIVER_NATIVE_STEPS,
  DRIVER_WEB_FALLBACKS,
  driverFallbackPath,
  isDriverNativeStep,
} from "./driver-fallbacks.ts";
export {
  RIDER_NATIVE_STEPS,
  RIDER_WEB_FALLBACKS,
  isRiderNativeStep,
  riderFallbackPath,
} from "./rider-fallbacks.ts";
