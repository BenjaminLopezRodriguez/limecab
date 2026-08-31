import { surfaceId, sceneId } from "../core/index.ts";
import type { SurfaceLayout, SurfacePresentation, SurfaceEmphasis } from "../core/surface.ts";
import type { PresentationEnvironment } from "../policy/environment.ts";
import type { MapPoint } from "../core/map.ts";

/** Deterministic ids and demo-only money. No production data, no network. */
export const PRIMARY = surfaceId("primary");
export const INTERRUPT = surfaceId("interrupt");

export const phone = (over: Partial<PresentationEnvironment> = {}): PresentationEnvironment => ({
  safeArea: { top: 59, right: 0, bottom: 34, left: 0 },
  viewport: { width: 390, height: 844 },
  keyboard: { visible: false, height: 0 },
  reducedMotion: false,
  fontScale: 1,
  ...over,
});

export const layout = (
  presentation: SurfacePresentation | null,
  emphasis: SurfaceEmphasis = "primary",
): SurfaceLayout => ({
  [PRIMARY]: { emphasis, presentation, interaction: emphasis === "suspended" ? "inert" : "active" },
});

export const ONTARIO: MapPoint = { id: "o", role: "origin", latitude: 34.06, longitude: -117.6, label: "Ontario, CA" };
export const PHOENIX: MapPoint = { id: "d", role: "destination", latitude: 33.45, longitude: -112.07, label: "Phoenix, AZ" };
export const TRUCK: MapPoint = { id: "s", role: "subject", latitude: 33.8, longitude: -114.5, label: "Truck" };

/** Mock/demo freight load — not production data. */
export const LANE = {
  rateMinor: 184_000,
  equipment: "Dry van",
  weightLb: 34_000,
  distanceMi: 795,
} as const;

export const scenes = {
  riderHome: sceneId("rider.home"),
  riderRoute: sceneId("rider.route_preview"),
  freightLinehaul: sceneId("freight.linehaul"),
} as const;
