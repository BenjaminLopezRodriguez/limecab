import { useMemo, type ReactNode } from "react";
import type { ExperienceFrame } from "../core/frame.ts";
import type { SurfaceId } from "../core/surface.ts";
import type { PresentationEnvironment } from "../policy/environment.ts";
import { resolveOcclusion } from "../policy/occlusion.ts";
import { createMockMapRenderer } from "../render/mock-map.ts";
import { SurfaceSheet, type DragIntent } from "./SurfaceSheet.tsx";
import { color } from "../tokens/index.ts";

/**
 * The whole architecture in one component:
 *
 *     ExperienceFrame  ->  WebSceneRenderer  ->  DOM
 *                      ->  (future) NativeSceneRenderer -> RN
 *
 * It takes a frame and renders it. It holds no product state, decides no transitions, and
 * knows no product names — `content` is supplied by a registry the renderer owns, keyed by
 * SurfaceId. Motion interpolates between truth states; it never becomes the truth.
 */
export interface SceneRendererProps {
  frame: ExperienceFrame;
  env: PresentationEnvironment;
  /** Renderer-owned registry. Core never knows which component draws a surface. */
  content?: Partial<Record<SurfaceId, ReactNode>>;
  actions?: Partial<Record<SurfaceId, ReactNode>>;
  dragIntent?: Partial<Record<SurfaceId, DragIntent>>;
  onDragIntent?: (id: SurfaceId, intent: Exclude<DragIntent, "none">) => void;
  showOcclusion?: boolean;
}

export function SceneRenderer({
  frame, env, content = {}, actions = {}, dragIntent = {},
  onDragIntent, showOcclusion = false,
}: SceneRendererProps) {
  const { scene, transition } = frame;

  const insets = useMemo(
    () => resolveOcclusion(scene.map?.occlusion, scene.surfaces, env),
    [scene.map?.occlusion, scene.surfaces, env],
  );

  const svg = useMemo(() => {
    if (!scene.map) return null;
    return createMockMapRenderer({ showOcclusion }).render(scene.map, insets, env);
  }, [scene.map, insets, env, showOcclusion]);

  return (
    <div
      style={{
        position: "relative", overflow: "hidden",
        width: env.viewport.width, height: env.viewport.height,
        background: color.canvas.light,
      }}
    >
      {svg ? <div aria-hidden dangerouslySetInnerHTML={{ __html: svg }} /> : null}

      {/* Announcement rides the transition, so a remount with no transition stays silent. */}
      <div aria-live={transition?.announcement?.urgency ?? "polite"} style={SR_ONLY}>
        {transition?.announcement?.text ?? ""}
      </div>

      {Object.entries(scene.surfaces).map(([rawId, state]) => {
        const id = rawId as SurfaceId;
        return (
          <SurfaceSheet
            key={rawId}
            state={state}
            env={env}
            intent={transition?.intent}
            dragIntent={dragIntent[id] ?? "none"}
            onDragIntent={(i) => onDragIntent?.(id, i)}
            actions={actions[id]}
          >
            {content[id]}
          </SurfaceSheet>
        );
      })}
    </div>
  );
}

const SR_ONLY: React.CSSProperties = {
  position: "absolute", width: 1, height: 1, overflow: "hidden",
  clip: "rect(0 0 0 0)", clipPath: "inset(50%)", whiteSpace: "nowrap",
};
