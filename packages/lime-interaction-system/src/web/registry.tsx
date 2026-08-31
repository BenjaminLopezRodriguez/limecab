import type { ComponentType } from "react";
import type { SurfaceId } from "../core/surface.ts";
import { surfaceId } from "../core/index.ts";

/**
 * Renderer-owned registry. SceneState carries IDs only — this map decides what draws.
 * Storybook flow scenarios should exercise this registry.
 */
export type SceneContentProps = Record<string, never>;

export type SceneRegistryEntry = ComponentType<SceneContentProps>;

const registry = new Map<SurfaceId, SceneRegistryEntry>();

export function registerScene(id: SurfaceId, component: SceneRegistryEntry): void {
  registry.set(id, component);
}

export function resolveScene(id: SurfaceId): SceneRegistryEntry | undefined {
  return registry.get(id);
}

export function getRegistry(): ReadonlyMap<SurfaceId, SceneRegistryEntry> {
  return registry;
}

/** Lab surface IDs for rider flow. */
export const SURFACE_IDS = {
  riderHome: surfaceId("rider.home"),
  riderRideSelect: surfaceId("rider.ride_select"),
  riderQuote: surfaceId("rider.quote"),
  riderStatus: surfaceId("rider.status"),
  riderComplete: surfaceId("rider.complete"),
  driverOffer: surfaceId("driver.offer"),
  driverJob: surfaceId("driver.job"),
  freightQuote: surfaceId("freight.quote"),
  freightLinehaul: surfaceId("freight.linehaul"),
} as const;

/** Placeholder scene components registered for harness use. */
export function ScenePlaceholder({ label }: { label: string }) {
  return <div data-scene={label}>{label}</div>;
}

// Register placeholders — story scenes render via content prop; registry proves the pattern.
for (const [key, id] of Object.entries(SURFACE_IDS)) {
  registerScene(id, () => <ScenePlaceholder label={key} />);
}
