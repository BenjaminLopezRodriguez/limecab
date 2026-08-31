/**
 * Surface vocabulary — four independent axes.
 * Derived from src/lib/service-app/surface-manager.ts + components/service-app/adaptive-surface.tsx
 */

export type SurfaceRole = "background" | "primary" | "secondary" | "interrupt" | "overlay";
export type SurfaceEmphasis = "primary" | "background" | "suspended" | "interrupt" | "hidden";
export type SurfaceInteraction = "active" | "passive" | "inert";

/**
 * Extracted Lime interaction vocabulary. NOT a rendering guarantee.
 * "sheet" does not oblige a renderer to draw a bottom sheet — a tablet renderer may use a side
 * panel, native a system sheet or full screen, for the same semantic condition. These are
 * semantic names INHERITED FROM LIME, not an immutable cross-platform layout ontology.
 * "sheet" and "compact-interrupt" especially may render very differently natively.
 */
export type SurfacePresentation =
  | "peek" | "sheet" | "expanded" | "overlay" | "fullscreen" | "compact-interrupt";

/** Branded — stops arbitrary string keys becoming a horizontal god-object. */
export type SurfaceId = string & { readonly __surfaceId: unique symbol };
export const surfaceId = (value: string): SurfaceId => value as SurfaceId;

export interface SurfaceState {
  emphasis: SurfaceEmphasis;
  presentation: SurfacePresentation | null;
  interaction: SurfaceInteraction;
}

export type SurfaceLayout = Record<SurfaceId, SurfaceState>;

/**
 * Core knows surfaces exist and their orchestration state.
 * Core does NOT know which component renders an id — renderers own that registry:
 *   web:    registry["ride-status"] = RideStatusScene
 *   native: registry["ride-status"] = NativeRideStatusScene
 */
