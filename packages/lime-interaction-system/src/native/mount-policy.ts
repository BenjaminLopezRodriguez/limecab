import type { SurfaceState } from "../core/surface.ts";

/**
 * Whether a surface's scene content should be in the React tree.
 *
 * `hidden` is off the tree — mounting it would run effects such as `autoFocus` on a search field
 * that is not on screen. `suspended` stays mounted so an interruption can return to untouched
 * task state behind it.
 */
export function shouldMountSurface(state: SurfaceState): boolean {
  return state.emphasis !== "hidden";
}
