import type { SurfacePresentation } from "../core/surface.ts";
import { nativeExtents } from "./extents.ts";

/**
 * Where a drag lands, decided semantically.
 *
 * Web's sheet is a snap drawer over a fixed ladder (`service-sheet.tsx`):
 *
 *   SNAP_POINTS        = [peek .22, sheet .40, expanded .60, overlay 1]
 *   CAPPED_SNAP_POINTS = [peek, sheet, expanded]           // overlaySnap={false}
 *   OVERLAY_POINTS     = [overlay]                         // already at overlay: locked
 *   snapPoints         = onDismiss && presentation !== "peek" ? [0, ...points] : points
 *
 * Three product rules live in that last line, and they are the ones worth carrying over:
 *
 *   1. Any sheet can be dragged to any rung. A drag is not a binary yes/no — it is a move
 *      along a ladder, which is why the web sheet feels like a thing you position rather
 *      than a dialog you accept or reject.
 *   2. A peek never dismisses. It is already a thin strip, and a short flick downwards must
 *      not be enough to leave the task.
 *   3. Dismissal only exists where the caller supplied a meaning for it. What "all the way
 *      down" *means* — leave the draft, or minimize the live job — belongs to the caller,
 *      not to the sheet.
 *
 * The fractions themselves are native policy (see `extents.ts`) and deliberately differ from
 * web's. The rules above are product semantics and do not.
 */

export type SnapDestination = SurfacePresentation | "dismiss";

export interface SnapLadderOptions {
  presentation: SurfacePresentation | null;
  /** Whether "all the way down" means anything here. Web's `onDismiss`. */
  canDismiss: boolean;
  /** Web's `overlaySnap`: may this sheet be pulled up to fill the viewport? */
  allowOverlay?: boolean;
}

const RUNGS: readonly SurfacePresentation[] = ["peek", "sheet", "expanded", "overlay"];

/** Rungs this surface may be dragged between, low to high. */
export function ladderFor({
  presentation,
  canDismiss,
  allowOverlay = true,
}: SnapLadderOptions): readonly SnapDestination[] {
  if (presentation === null) return [];
  // An interrupt is a question, not a thing to resize. It has no ladder.
  if (presentation === "compact-interrupt") return [];
  // Already filling the screen: the drawer is locked to that rung on web too.
  if (presentation === "overlay") return canDismiss ? ["dismiss", "overlay"] : ["overlay"];
  // Fullscreen and launcher are separate chrome, not rungs — they do not participate.
  if (presentation === "fullscreen" || presentation === "launcher") return [];

  const rungs = allowOverlay ? RUNGS : RUNGS.filter((r) => r !== "overlay");
  return canDismiss && presentation !== "peek" ? ["dismiss", ...rungs] : rungs;
}

/** A destination's share of the viewport. Dismissal is the floor. */
export function fractionOf(destination: SnapDestination): number {
  return destination === "dismiss" ? 0 : (nativeExtents[destination] ?? 0);
}

export interface SnapGesture {
  /** Points travelled since the gesture began. Positive is downward. */
  translation: number;
  /** Points per second at release. Positive is downward. */
  velocity: number;
  viewportHeight: number;
}

/**
 * How far a fling carries past the finger, in seconds of travel. Tuned for iOS: below this
 * a deliberate flick fails to change rung and the sheet feels sticky; above it a slow drag
 * overshoots and the sheet feels like it is escaping.
 */
const PROJECTION_SECONDS = 0.18;

/**
 * Resolve a finished drag to the rung it meant.
 *
 * Projection first, nearest rung second — so a fast flick crosses rungs the finger never
 * reached, and a slow drag settles where it was let go. This is renderer policy: web gets
 * the same behaviour from Base UI's drawer, and neither implementation should try to match
 * the other's numbers.
 */
export function resolveSnap(options: SnapLadderOptions, gesture: SnapGesture): SnapDestination | null {
  const ladder = ladderFor(options);
  if (ladder.length < 2) return null;

  const current = options.presentation === null ? 0 : (nativeExtents[options.presentation] ?? 0);
  const travel = gesture.translation + gesture.velocity * PROJECTION_SECONDS;
  // Dragging down shrinks the surface, so downward travel lowers the fraction.
  const projected = current - travel / Math.max(1, gesture.viewportHeight);

  let best = ladder[0]!;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const rung of ladder) {
    const distance = Math.abs(fractionOf(rung) - projected);
    if (distance < bestDistance) {
      best = rung;
      bestDistance = distance;
    }
  }
  return best;
}
