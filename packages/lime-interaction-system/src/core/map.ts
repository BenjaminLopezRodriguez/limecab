/** Durable map state only. No nonces, no imperative residue — those are commands. */

export type MapMode =
  | "home" | "select_location" | "coverage"
  | "route_preview" | "provider_arrival" | "active_route" | "results";

export interface MapPoint {
  id: string;
  role: "origin" | "destination" | "subject" | "provider" | "facility" | "poi";
  latitude: number;
  longitude: number;
  label?: string;
}

/** Physical viewport-edge insets. NOT CSS logical (block/inline, writing-mode). */
export interface EdgeInsets { top: number; right: number; bottom: number; left: number }

/**
 * Occlusion is an INTENT. The renderer lays out, measures, and reports actual insets.
 * Scene authors never predict pixel values — that is what map-overlay.ts does today via
 * document.querySelector + window.innerHeight, and why it cannot run headless.
 * `explicit` is an escape hatch, not the ordinary path.
 */
export type OcclusionIntent =
  | { source: "surface-layout" }
  | { source: "safe-area" }
  | { source: "explicit"; insets: EdgeInsets };

export interface MapSceneState {
  mode: MapMode;
  points?: MapPoint[];
  route?: { originId: string; destinationId: string };
  camera?: { intent: "fit" | "follow" | "center" | "preserve" };
  occlusion?: OcclusionIntent;
}
