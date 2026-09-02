import type { SurfacePresentation } from "../core/surface.ts";
import type { PresentationEnvironment } from "../policy/environment.ts";
import type { SurfaceExtentPolicy } from "../recipes/web-mobile/surface-extents.ts";

/**
 * Viewport-layout policy for the NATIVE renderer family.
 *
 * These are deliberately not the web numbers. A phone held one-handed wants a taller peek than
 * a browser does — the CTA has to sit inside thumb reach above a home indicator — and a native
 * sheet can go further up before it stops feeling like a sheet. Sharing 0.22/0.40/0.60 with web
 * would mean native inherited a desktop-browser measurement by accident.
 *
 * Source of the semantic names is core; the numbers are ours.
 */
export const nativeExtents: SurfaceExtentPolicy = {
  peek: 0.26,
  sheet: 0.46,
  expanded: 0.78,
  overlay: 1,
  fullscreen: 1,
  "compact-interrupt": 0.38,
  // The surface *is* the page: everything below the status bar belongs to it.
  launcher: 1,
};

/** Presentations that read as a bottom sheet rather than a free-floating card. */
const ANCHORED = new Set<SurfacePresentation>(["peek", "sheet", "expanded", "overlay", "fullscreen", "launcher"]);

export function isAnchored(presentation: SurfacePresentation | null): boolean {
  return presentation !== null && ANCHORED.has(presentation);
}

/**
 * Physical height in points.
 *
 * The keyboard is treated as occlusion of the same screen the sheet wants, so an open keyboard
 * lifts the sheet rather than letting the field disappear behind it. Large Dynamic Type pushes
 * a peek sheet up too, because at 150% the header and CTA alone no longer fit in 26%.
 */
export function surfaceHeight(
  presentation: SurfacePresentation | null,
  env: PresentationEnvironment,
): number {
  if (presentation === null) return 0;
  const fraction = nativeExtents[presentation] ?? 0;
  const typeRelief = presentation === "peek" ? Math.max(0, env.fontScale - 1) * 0.10 : 0;
  const raw = env.viewport.height * Math.min(1, fraction + typeRelief);
  const ceiling = presentation === "fullscreen" || presentation === "overlay"
    ? env.viewport.height
    : env.viewport.height - env.safeArea.top - 24;
  return Math.max(0, Math.min(raw, ceiling));
}
