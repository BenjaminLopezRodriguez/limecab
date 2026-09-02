import type { ComponentType, ReactNode } from "react";
import type { SurfaceId } from "../core/surface.ts";

/**
 * Renderer-owned registry. `SceneState` carries surface IDs only; this decides what draws them.
 *
 * It also decides *how* a surface is chrome'd. That is what keeps the scene renderer free of
 * surface names: it never asks "is this the map?", it asks the registry what kind of thing a
 * surface is and composes accordingly.
 */

/** `canvas` fills the frame and owns its own gestures; `surface` gets sheet mechanics. */
export type SurfaceChrome = "surface" | "canvas";

export interface SceneContentProps<Data = unknown> {
  data: Data;
}

export type NativeSceneComponent<Data = never> = ComponentType<SceneContentProps<Data>>;

export interface NativeSceneEntry {
  component: NativeSceneComponent<never>;
  chrome?: SurfaceChrome;
}

export type NativeSceneRegistry = ReadonlyMap<SurfaceId, NativeSceneEntry>;

export function createRegistry(
  entries: Iterable<readonly [SurfaceId, NativeSceneComponent<never> | NativeSceneEntry]>,
): NativeSceneRegistry {
  return new Map(
    [...entries].map(([id, value]) => [
      id,
      typeof value === "function" ? { component: value, chrome: "surface" as const } : value,
    ]),
  );
}

export const chromeOf = (registry: NativeSceneRegistry, id: SurfaceId): SurfaceChrome =>
  registry.get(id)?.chrome ?? "surface";

/** Resolve a surface to rendered content, or nothing when the registry has no entry. */
export function renderSurface(
  registry: NativeSceneRegistry,
  id: SurfaceId,
  data: unknown,
): ReactNode {
  const entry = registry.get(id);
  if (!entry) return null;
  const Typed = entry.component as ComponentType<SceneContentProps<unknown>>;
  return <Typed data={data} />;
}
