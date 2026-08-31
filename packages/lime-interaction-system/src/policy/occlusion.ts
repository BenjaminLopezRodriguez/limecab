import type { EdgeInsets, OcclusionIntent } from "../core/map.ts";
import type { SurfaceLayout, SurfaceState } from "../core/surface.ts";
import type { PresentationEnvironment } from "./environment.ts";
import { chrome, breakpointMd } from "../tokens/chrome.ts";
import {
  extentFor,
  webMobileExtents,
  type SurfaceExtentPolicy,
} from "../recipes/web-mobile/surface-extents.ts";

/**
 * Derived from: src/components/service-app/map-overlay.ts:52-73 (readMapPadding)
 *
 * Preserved: the semantic relationship — a visible surface occludes the bottom of the map,
 *            so the camera pads rather than shrinking; desktop reserves a side panel instead.
 *
 * Removed:   document.querySelector("[data-service-app-shell]")
 *            getComputedStyle(node).getPropertyValue("--sheet-snap")
 *            window.matchMedia("(max-width: 767px)")
 *            window.innerHeight
 *            the "limecab:overlay" global CustomEvent bus
 *
 * That module was flagged accidental-not-real abstraction: single-use, undocumented global
 * event name, a panel width hardcoded as 24*16+48, and impossible to run headless. This is a
 * redesign, not a port — the whole point of stop condition G-1.
 *
 * Platform status: renderer-neutral. Native supplies PresentationEnvironment and gets the
 * same insets back; no DOM anywhere in the path.
 */

/** The surface actually occluding the map: highest-emphasis visible one. */
export function occludingSurface(layout: SurfaceLayout): SurfaceState | null {
  const visible = Object.values(layout).filter(
    (s) => s.emphasis !== "hidden" && s.presentation !== null,
  );
  if (visible.length === 0) return null;
  const rank: Record<string, number> = {
    interrupt: 4, primary: 3, suspended: 2, background: 1, hidden: 0,
  };
  return visible.reduce((a, b) => ((rank[b.emphasis] ?? 0) > (rank[a.emphasis] ?? 0) ? b : a));
}

/**
 * posture -> estimated occlusion -> camera padding.
 * Keyboard counts as occlusion: it steals the same screen the sheet does.
 */
export function resolveOcclusion(
  intent: OcclusionIntent | undefined,
  layout: SurfaceLayout,
  env: PresentationEnvironment,
  policy: SurfaceExtentPolicy = webMobileExtents,
): EdgeInsets {
  if (intent?.source === "explicit") return intent.insets;

  const { top, gutter, desktopPanel } = chrome.mapPadding;
  const safeTop = top + env.safeArea.top;

  if (intent?.source === "safe-area") {
    return {
      top: safeTop,
      right: gutter + env.safeArea.right,
      bottom: gutter + env.safeArea.bottom,
      left: gutter + env.safeArea.left,
    };
  }

  const surface = occludingSurface(layout);
  const fraction = extentFor(surface?.presentation ?? null, policy);
  const mobile = env.viewport.width < breakpointMd;

  const occluded = mobile
    ? Math.round(env.viewport.height * fraction) +
      (env.keyboard.visible ? env.keyboard.height : 0)
    : 0;

  return {
    top: safeTop,
    right: !mobile && fraction > 0 ? desktopPanel : gutter + env.safeArea.right,
    bottom: occluded + gutter + env.safeArea.bottom,
    left: gutter + env.safeArea.left,
  };
}

/** Usable map rect after occlusion — what the camera must fit content into. */
export function visibleMapRect(insets: EdgeInsets, env: PresentationEnvironment) {
  return {
    x: insets.left,
    y: insets.top,
    width: Math.max(0, env.viewport.width - insets.left - insets.right),
    height: Math.max(0, env.viewport.height - insets.top - insets.bottom),
  };
}
