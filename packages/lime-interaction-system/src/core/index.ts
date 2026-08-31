// New platform-neutral contract — canonical.
export * from "./surface.ts";
export * from "./scene.ts";
export * from "./shell.ts";
export * from "./frame.ts";
export * from "./transition.ts";
export * from "./map.ts";
export * from "./commands.ts";
export * from "./accessibility.ts";
export * from "./back.ts";

/**
 * Extracted reducers. Their own SurfaceRole/Emphasis/Interaction/MotionIntent/State/Layout
 * are deliberately NOT re-exported — the contract versions above supersede them:
 *   contract SurfaceState.presentation is the real union, production's is `string | null`
 *   contract SurfaceLayout is keyed by branded SurfaceId, production's by bare string
 * Recorded as a tracked divergence in docs/CONVERGENCE.md. Production stays authoritative
 * for behaviour; the lab is authoritative for type precision.
 */
export {
  SURFACE_MOTION_MS,
  createSurfaceManager,
  initialLayout,
  initialSurfaceManagerState,
  reduceSurfaceManager,
  surfaceLayoutViolations,
  describeSurfaceLayout,
} from "./surface-manager.ts";
export type {
  SurfaceDefinition,
  SurfaceTarget,
  SurfaceRecipe,
  SurfaceAction,
  SurfaceManagerConfig,
  SurfaceManagerState,
  SurfaceManagerEvent,
} from "./surface-manager.ts";
export * from "./surface-progress.ts";
