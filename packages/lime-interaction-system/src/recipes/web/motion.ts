import type { SurfaceMotionIntent } from "../../core/transition.ts";

/**
 * Timing is renderer POLICY. Same intent, different feel per platform: touch latency,
 * compositor behaviour, 120Hz, gesture velocity, continuous vs discrete sheets.
 *
 * There are NO springs in Lime today — motion is intent -> duration + delay + bezier.
 * A spring system would be new design surface, not extracted behaviour.
 *
 * Source: src/lib/service-app/surface-manager.ts:98-107 (durations)
 *         src/components/ui/drawer.tsx:125 (bezier)
 */
export interface MotionSpec {
  duration: number;
  delay: number;
  easing: readonly [number, number, number, number];
}

const LIME_EASE = [0.22, 1, 0.36, 1] as const;

export const webMotion: Record<SurfaceMotionIntent, MotionSpec> = {
  progress: { duration: 220, delay: 40, easing: LIME_EASE },
  interrupt: { duration: 180, delay: 0, easing: LIME_EASE },
  return: { duration: 180, delay: 0, easing: LIME_EASE },
  expand: { duration: 260, delay: 60, easing: LIME_EASE },
  collapse: { duration: 200, delay: 40, easing: LIME_EASE },
};

/** Reduced motion is honoured in production (mapbox-canvas.tsx:254, adaptive-surface.tsx:148). */
export function motionFor(intent: SurfaceMotionIntent, reducedMotion: boolean): MotionSpec {
  const spec = webMotion[intent];
  return reducedMotion ? { ...spec, duration: 0, delay: 0 } : spec;
}
