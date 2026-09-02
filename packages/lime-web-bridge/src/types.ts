/**
 * TEMPORARY MIGRATION ADAPTER — tiny postMessage bridge between LegacyWebSurface and
 * production web. Not a domain protocol; delete when native burn-down completes.
 */

export type WebBridgeEvent =
  | { type: "navigation"; path: string }
  | { type: "ride.requested" }
  | { type: "driver.offerAccepted" }
  | { type: "close" };

export type WebBridgeProduct = "rider" | "driver";

export interface LegacyWebSurfaceProps {
  /** Path appended to EXPO_PUBLIC_LIME_WEB_BASE_URL (leading slash required). */
  path: string;
  product: WebBridgeProduct;
  onEvent?: (event: WebBridgeEvent) => void;
}
