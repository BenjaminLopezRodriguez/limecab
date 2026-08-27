"use client";

/**
 * Sheet ↔ map contract.
 *
 * The sheet publishes *which snap it is on* — a known fraction — and the canvas
 * turns that into camera padding. Nothing here measures a translating drawer,
 * so a snap change costs one event instead of a resize storm, and the map box
 * itself never moves: the sheet floats over a full-bleed canvas.
 */

const EVENT = "limecab:overlay";

/** Destination bar (h-11 at top-3) plus breathing room. */
const TOP = 72;
const GUTTER = 32;
/** Desktop task panel: w-[min(100%,24rem)] inside a p-6 frame. */
const PANEL = 24 * 16 + 48;

function shell() {
  return document.querySelector<HTMLElement>("[data-service-app-shell]");
}

function overlayChanged() {
  window.dispatchEvent(new Event(EVENT));
}

export function onOverlayChange(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

/**
 * The sheet's rung, as a fraction of the viewport, or null when no sheet is
 * over the canvas. Returns its own cleanup.
 */
export function publishSheetSnap(fraction: number | null): () => void {
  const node = shell();
  const clear = () => {
    node?.style.setProperty("--sheet-snap", "0");
    overlayChanged();
  };
  if (!node || fraction === null) {
    clear();
    return clear;
  }
  node.style.setProperty("--sheet-snap", String(fraction));
  overlayChanged();
  return clear;
}

export function readMapPadding(): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  const node = shell();
  const snap = node
    ? Number.parseFloat(
        getComputedStyle(node).getPropertyValue("--sheet-snap"),
      ) || 0
    : 0;
  const mobile = window.matchMedia("(max-width: 767px)").matches;
  return {
    top: TOP,
    left: GUTTER,
    // The canvas runs under the sheet; padding — not a smaller map — keeps the
    // car and the route in the gap between the destination bar and the sheet.
    bottom: mobile ? Math.round(window.innerHeight * snap) + GUTTER : GUTTER,
    right: !mobile && snap > 0 ? PANEL : GUTTER,
  };
}
