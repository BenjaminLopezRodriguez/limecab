import type { SurfaceLayout } from "./surface.ts";
import type { MapSceneState } from "./map.ts";

export type SceneId = string & { readonly __sceneId: unique symbol };
export const sceneId = (value: string): SceneId => value as SceneId;

/** What the world should look like now. Carries no transition and no shell. */
export interface SceneState {
  id: SceneId;
  surfaces: SurfaceLayout;
  map?: MapSceneState;
  /**
   * DIAGNOSTIC ONLY. Renderers MUST NOT branch on this —
   * `if (metadata.product === "freight")` rebuilds the <LimeScene type="freight">
   * god-component indirectly. Storybook and debug tooling only.
   */
  metadata?: { product?: string; state?: string; notes?: string };
}
