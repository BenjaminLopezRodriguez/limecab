import type { MapSceneState, EdgeInsets } from "../core/map.ts";
import type { PresentationEnvironment } from "../policy/environment.ts";

/**
 * The renderer seam. Production already proves this is a real abstraction, not aspirational:
 * `MapAdapter` (src/lib/service-app/map-adapter.ts:89) has two live implementations —
 * an SVG placeholder and Mapbox GL.
 *
 * Generic over output so the same contract serves an SVG string, a React element, or a
 * native view. Nothing here mentions React or the DOM.
 */
export interface MapRenderer<Output> {
  render(scene: MapSceneState, insets: EdgeInsets, env: PresentationEnvironment): Output;
}
