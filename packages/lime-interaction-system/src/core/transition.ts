import type { AccessibilityUrgency } from "./accessibility.ts";
import type { SceneId } from "./scene.ts";

/**
 * Intent belongs to the TRANSITION, not the scene.
 * LINEHAUL entered by progression, by restore-from-minimize, by deep link, or by cold
 * relaunch is the same scene each time.
 *
 * Extracted from src/lib/service-app/surface-manager.ts:43 (SurfaceMotionIntent).
 * NO durations here — timing is renderer policy, see recipes/web/motion.ts.
 */
export type SurfaceMotionIntent = "progress" | "interrupt" | "return" | "expand" | "collapse";

export interface Transition {
  /** null = cold entry / reconstruction. A frame with no transition stands alone. */
  from: SceneId | null;
  to: SceneId;
  intent: SurfaceMotionIntent;
  /**
   * Announcement rides the TRANSITION, not the scene — so a cold remount does not
   * re-announce "Loaded!" merely because a component mounted. eventId dedupes.
   */
  announcement?: { text: string; urgency: AccessibilityUrgency; eventId: string };
}
