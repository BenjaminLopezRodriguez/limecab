import type { EdgeInsets } from "../core/map.ts";

/**
 * Feeds the PRESENTATION-POLICY evaluator, never the semantic core.
 *
 *   semantic core  (SurfaceManager · back semantics · scene state · interrupt precedence)
 *          |
 *   policy / presentation evaluation   <-- PresentationEnvironment enters HERE
 *          |
 *   renderer
 *
 * Keyboard height must never influence "what job am I doing", "which surface is primary", or
 * "what does Back mean". It MAY influence which extent recipe applies, how the map is padded,
 * whether a search panel goes fullscreen.
 *
 * INVARIANT: no semantic reducer imports this type. `if (env.keyboard.visible)` inside a
 * reducer is web-era coupling returning through the side door — treat it as a review failure.
 * Enforced by tests/boundaries.test.ts.
 */
export interface PresentationEnvironment {
  safeArea: EdgeInsets;
  viewport: { width: number; height: number };
  keyboard: { visible: boolean; height: number };
  reducedMotion: boolean;
  /** Native Dynamic Type; web ~1. At 1.5+ a peek sheet may become an impossible layout. */
  fontScale: number;
}
