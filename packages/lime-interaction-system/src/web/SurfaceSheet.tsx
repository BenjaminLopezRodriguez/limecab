import { useCallback, useRef, useState, type ReactNode } from "react";
import type { SurfaceState } from "../core/surface.ts";
import type { SurfaceMotionIntent } from "../core/transition.ts";
import type { PresentationEnvironment } from "../policy/environment.ts";
import { extentFor, webSheetChromePx } from "../recipes/web-mobile/surface-extents.ts";
import { motionFor } from "../recipes/web/motion.ts";
import { radius, surface, color, elevation } from "../tokens/index.ts";

/**
 * Derived from: src/components/service-app/service-sheet.tsx
 *
 * Preserved: the snap ladder as viewport fractions; drag-down intent (draft dismisses,
 *            live work minimizes); the grabber; CTA dock; motion keyed by intent.
 *
 * Removed:   Base UI Drawer, `calc(f * 100dvh - 13px)` inline, env(safe-area-inset-*),
 *            publishSheetSnap()'s CSS-variable + window-CustomEvent side channel.
 *            Height comes from the extent policy; occlusion is reported upward as a value.
 *
 * Platform status: web renderer. Native reimplements with Reanimated + Gesture Handler
 * against the same SurfaceState + extent policy.
 */

export type DragIntent = "dismiss" | "minimize" | "none";

export interface SurfaceSheetProps {
  state: SurfaceState;
  env: PresentationEnvironment;
  intent?: SurfaceMotionIntent;
  /** What a full drag-down MEANS here. Draft work dismisses; live work minimizes. */
  dragIntent?: DragIntent;
  onDragIntent?: (intent: Exclude<DragIntent, "none">) => void;
  actions?: ReactNode;
  children?: ReactNode;
}

export function SurfaceSheet({
  state, env, intent = "progress", dragIntent = "none",
  onDragIntent, actions, children,
}: SurfaceSheetProps) {
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const motion = motionFor(intent, env.reducedMotion);

  const fraction = extentFor(state.presentation);
  const height = Math.max(0, env.viewport.height * fraction - webSheetChromePx);
  const hidden = state.emphasis === "hidden" || state.presentation === null;

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (dragIntent === "none") return;
    start.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [dragIntent]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (start.current === null) return;
    setDrag(Math.max(0, e.clientY - start.current));
  }, []);

  const onPointerUp = useCallback(() => {
    if (start.current === null) return;
    const travelled = drag;
    start.current = null;
    setDrag(0);
    // Past a third of its own height, the gesture means what dragIntent says it means.
    if (travelled > height / 3 && dragIntent !== "none") onDragIntent?.(dragIntent);
  }, [drag, height, dragIntent, onDragIntent]);

  return (
    <section
      aria-hidden={hidden || undefined}
      // Core's SurfaceInteraction drives it — same mapping production already uses.
      {...(state.interaction === "inert" ? { inert: "" as unknown as boolean } : {})}
      style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        height: hidden ? 0 : height,
        transform: `translateY(${hidden ? "100%" : `${drag}px`})`,
        transition: drag > 0 ? "none"
          : `height ${motion.duration}ms cubic-bezier(${motion.easing.join(",")}) ${motion.delay}ms,
             transform ${motion.duration}ms cubic-bezier(${motion.easing.join(",")}) ${motion.delay}ms,
             opacity ${motion.duration}ms linear`,
        opacity: state.emphasis === "suspended" ? 0.55 : 1,
        background: color.panel.light,
        borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
        boxShadow: `0 ${elevation.drawer.y}px ${elevation.drawer.blur}px ${elevation.drawer.color}`,
        display: "flex", flexDirection: "column", overflow: "hidden",
        paddingBottom: env.safeArea.bottom,
      }}
    >
      <div
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        style={{
          height: surface.grabber.trackHeight, display: "grid", placeItems: "center",
          flex: "none", touchAction: "none",
          cursor: dragIntent === "none" ? "default" : "grab",
        }}
      >
        <div style={{
          width: surface.grabber.width, height: surface.grabber.height,
          borderRadius: radius.pill, background: color.mutedForeground.light, opacity: 0.35,
        }} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: `0 20px` }}>{children}</div>
      {actions ? (
        <div style={{
          flex: "none", padding: `10px 20px 12px`,
          maxHeight: surface.actionsMaxHeight, borderTop: `1px solid ${color.border.light}`,
        }}>{actions}</div>
      ) : null}
    </section>
  );
}
