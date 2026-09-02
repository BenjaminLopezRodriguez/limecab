import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import type { ExperienceFrame } from "../core/frame.ts";
import type { SurfaceId, SurfaceState } from "../core/surface.ts";
import type { SurfaceProgressState } from "../core/surface-progress.ts";
import type { PresentationEnvironment } from "../policy/environment.ts";
import { resolveOcclusion } from "../policy/occlusion.ts";
import { resolveCamera, type Viewport } from "../render/camera.ts";
import { nativeExtents } from "./extents.ts";
import { NativeMapSurface } from "./NativeMapSurface.tsx";
import { NativeSurface, type DragIntent } from "./NativeSurface.tsx";
import { chromeOf, renderSurface, type NativeSceneRegistry } from "./registry.tsx";
import type { SnapDestination } from "./snap.ts";

/**
 * The native half of the architecture:
 *
 *     ExperienceFrame  ->  WebSceneRenderer     ->  DOM
 *                      ->  NativeSceneRenderer  ->  React Native
 *
 * It renders **every** surface the frame declares, simultaneously. Production composes four —
 * map, primary, secondary and interrupt — and changes several of them in one semantic
 * transition; a renderer that only drew the foreground could not express that, which is what
 * made pin-drop and search-over-a-suspended-task impossible.
 *
 * Layering, visibility and input all come from `role`, `emphasis`, `presentation` and
 * `interaction`. No product or scene name reaches this file.
 */
export interface NativeSceneRendererProps {
  frame: ExperienceFrame;
  env: PresentationEnvironment;
  /** Renderer-owned. Core never knows which component draws a surface. */
  registry: NativeSceneRegistry;
  /** Per-surface data handed to the registered component. */
  data?: Partial<Record<SurfaceId, unknown>>;
  actions?: Partial<Record<SurfaceId, ReactNode>>;
  dragIntent?: Partial<Record<SurfaceId, DragIntent>>;
  /**
   * Async transitions in flight, per surface. A surface running one leaves the screen before
   * its next content arrives, so the canvas below is visible through the gap. The renderer
   * neither starts nor names them — it only honours the phase it is handed.
   */
  progress?: Partial<Record<SurfaceId, SurfaceProgressState>>;
  onSnapTo?: (id: SurfaceId, destination: SnapDestination) => void;
  /** A coordinate indicated on a subject canvas. */
  onPick?: (id: SurfaceId, point: { latitude: number; longitude: number }) => void;
  debugOcclusion?: boolean;
}

/** Stacking order. A held task sits under the thing that is holding it. */
const DEPTH: Record<SurfaceState["emphasis"], number> = {
  hidden: 0,
  background: 1,
  suspended: 2,
  primary: 3,
  interrupt: 4,
};

export function NativeSceneRenderer({
  frame,
  env,
  registry,
  data = {},
  actions = {},
  dragIntent = {},
  progress = {},
  onSnapTo,
  onPick,
  debugOcclusion,
}: NativeSceneRendererProps) {
  const { scene, transition } = frame;

  // Native extents, not the web fractions — the same policy seam the web renderer uses.
  const insets = useMemo(
    () => resolveOcclusion(scene.map?.occlusion, scene.surfaces, env, nativeExtents),
    [scene.map?.occlusion, scene.surfaces, env],
  );

  // `preserve` needs somewhere to preserve *from*, and that is renderer state by definition.
  const lastView = useRef<Viewport | undefined>(undefined);
  if (scene.map) lastView.current = resolveCamera(scene.map, insets, env, lastView.current);

  // The announcement rides the transition, so a cold remount stays silent. eventId dedupes.
  // It fires in an effect rather than during render: React may render speculatively or discard
  // a render entirely, and an announcement is a side effect the user cannot un-hear.
  const announced = useRef<string | null>(null);
  const announcement = transition?.announcement;
  useEffect(() => {
    if (!announcement || announced.current === announcement.eventId) return;
    announced.current = announcement.eventId;
    AccessibilityInfo.announceForAccessibility(announcement.text);
  }, [announcement]);

  // Painter's order: shallowest first, so an interrupt lands over a task it suspended.
  const ordered = useMemo(
    () =>
      (Object.entries(scene.surfaces) as [SurfaceId, SurfaceState][])
        .slice()
        .sort((a, b) => DEPTH[a[1].emphasis] - DEPTH[b[1].emphasis]),
    [scene.surfaces],
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      {ordered.map(([id, state]) => {
        // A canvas surface draws the world the scene is carrying; there is no second map.
        if (chromeOf(registry, id) === "canvas") {
          if (!scene.map) return null;
          return (
            <NativeMapSurface
              key={id}
              state={state}
              scene={scene.map}
              env={env}
              insets={insets}
              previous={lastView.current}
              onPick={onPick ? (point) => onPick(id, point) : undefined}
              debugOcclusion={debugOcclusion}
            />
          );
        }
        return (
          <NativeSurface
            key={id}
            state={state}
            env={env}
            intent={transition?.intent}
            dragIntent={dragIntent[id] ?? "none"}
            progress={progress[id]}
            onSnapTo={(destination) => onSnapTo?.(id, destination)}
            actions={actions[id]}
          >
            {renderSurface(registry, id, data[id])}
          </NativeSurface>
        );
      })}
    </View>
  );
}
