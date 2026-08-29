/**
 * Sheet interaction model.
 *
 * Rest rungs stay on the ladder (peek / sheet / expanded). Overlay is not a
 * rest rung — it is the overflow destination. If the scene does not fit the
 * current snap, the next scroll/swipe grows the same drawer toward overlay.
 * Inner scrolling stays locked until that snap, so the gesture that would have
 * been a scroll is the expansion.
 *
 * The sheet does not measure content and spring to overlay on its own.
 */

export const SHEET_PEEK_SNAP = 0.22;
export const SHEET_SNAP = 0.4;
export const SHEET_EXPANDED_SNAP = 0.6;
export const SHEET_OVERLAY_SNAP = 1;
export const SHEET_DISMISS_SNAP = 0;

const OVERLAY_SLACK = 0.01;
const OVERFLOW_SLACK_PX = 8;

const REST_POINTS = [SHEET_PEEK_SNAP, SHEET_SNAP, SHEET_EXPANDED_SNAP] as const;

export function sheetContentOverflows(
  scrollHeight: number,
  clientHeight: number,
  slackPx = OVERFLOW_SLACK_PX,
): boolean {
  return scrollHeight > clientHeight + slackPx;
}

export function sheetInnerScrolls(fraction: number): boolean {
  return fraction >= SHEET_OVERLAY_SNAP - OVERLAY_SLACK;
}

export function sheetSnapPoints(input: {
  presentation: "peek" | "sheet" | "expanded" | "fullscreen" | "overlay";
  /** Content does not fit the current snap, or the caller opted into overlay. */
  overlay: boolean;
  dismiss?: boolean;
}): number[] {
  const points =
    input.presentation === "overlay"
      ? [SHEET_OVERLAY_SNAP]
      : input.overlay
        ? [...REST_POINTS, SHEET_OVERLAY_SNAP]
        : [...REST_POINTS];
  if (input.dismiss && input.presentation !== "peek") {
    return [SHEET_DISMISS_SNAP, ...points];
  }
  return points;
}
