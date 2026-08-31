/**
 * Surface metrics. Source: service-sheet.tsx, ui/button.tsx, ui/drawer.tsx:92.
 * Snap fractions deliberately live in recipes/web-mobile/surface-extents.ts, NOT here —
 * they are renderer policy, not shared truth.
 */
export const surface = {
  /** Grabber pill. drawer.tsx:92 */
  grabber: { width: 40, height: 6, trackHeight: 12 },
  /** CTA sizes. ui/button.tsx:24-31 */
  cta: { sm: 40, default: 48, lg: 56 },
  /** Minimum touch target — 44 is the floor used throughout (size-11). */
  minHitTarget: 44,
  /** Desktop bounded sheet. shell:152, adaptive-surface:410 */
  desktopMaxWidth: 384,
  /** SheetActions dock. service-sheet.tsx:98 */
  actionsMaxHeight: 152,
} as const;
