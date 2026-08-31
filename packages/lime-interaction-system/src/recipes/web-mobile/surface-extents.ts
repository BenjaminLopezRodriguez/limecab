import type { SurfacePresentation } from "../../core/surface.ts";

/**
 * Viewport-layout POLICY for one renderer family — not shared truth.
 *
 * Landscape, tablet, foldable, split-screen, keyboard-open and 150% Dynamic Type all want
 * different numbers for the SAME semantic presentation. Canonizing these in core would mean
 * the first native implementation inherits 0.22/0.40/0.60 by accident.
 *
 * Source: src/components/service-app/service-sheet.tsx:49-52
 */
export type SurfaceExtentPolicy = Partial<Record<SurfacePresentation, number>> & {
  peek: number;
  sheet: number;
  expanded: number;
  overlay: number;
};

export const webMobileExtents: SurfaceExtentPolicy = {
  peek: 0.22,
  sheet: 0.40,
  expanded: 0.60,
  overlay: 1,
};

/** Chrome reserved above the sheet body. Source: service-sheet.tsx:78 (SHEET_CHROME_PX). */
export const webSheetChromePx = 13;

/** Fraction of viewport a presentation occludes from the bottom. Feeds OcclusionIntent. */
export function extentFor(
  presentation: SurfacePresentation | null,
  policy: SurfaceExtentPolicy = webMobileExtents,
): number {
  if (presentation === null) return 0;
  return policy[presentation] ?? 0;
}
