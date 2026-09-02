import { Easing, withTiming, withSpring, type WithSpringConfig, type WithTimingConfig } from "react-native-reanimated";
import type { SurfaceMotionIntent } from "../core/transition.ts";

/**
 * How a semantic intent physically moves on native.
 *
 * The contract says *what* changed; this decides how it feels. Web's millisecond constants are
 * not reused — a duration copied from CSS lands as a curve nobody chose. What is preserved is
 * the ranking: an interruption arrives faster than a progression, and a return is quicker than
 * the move it undoes.
 *
 * Springs are specified with Apple's two designer parameters (`duration` + `dampingRatio`)
 * rather than mass/stiffness/damping, per Expo's animation guidance — the values below come
 * from its table rather than being tuned by eye.
 */
export type NativeMotion =
  | { kind: "spring"; config: WithSpringConfig }
  | { kind: "timing"; config: WithTimingConfig };

const spring = (duration: number, dampingRatio: number): NativeMotion => ({
  kind: "spring",
  config: { duration, dampingRatio },
});

const timing = (duration: number): NativeMotion => ({
  kind: "timing",
  config: { duration, easing: Easing.out(Easing.cubic) },
});

const MOTION: Record<SurfaceMotionIntent, NativeMotion> = {
  // Moving forward through a task: settled, no overshoot to distract from the new content.
  progress: spring(400, 1),
  // Something arrived unbidden. Sheet timing, so it lands before the eye finishes travelling.
  interrupt: spring(300, 0.8),
  // Undoing the interruption. Quicker than the arrival — nobody wants to wait to get back.
  return: timing(180),
  // Deliberate enlargement, so a little follow-through reads as physical.
  expand: spring(400, 0.8),
  collapse: timing(200),
};

export function motionFor(intent: SurfaceMotionIntent, reducedMotion: boolean): NativeMotion {
  // Reduced motion still changes state instantly and truthfully; it just stops travelling.
  if (reducedMotion) return { kind: "timing", config: { duration: 0 } };
  return MOTION[intent];
}

/**
 * Apply a resolved motion, optionally carrying the velocity a finger left behind.
 *
 * Handing velocity to the spring is what makes a released drag continue rather than restart —
 * the difference between a sheet that was thrown and one that merely decided to move.
 */
export function animate(toValue: number, motion: NativeMotion, velocity?: number) {
  "worklet";
  if (motion.kind === "timing") return withTiming(toValue, motion.config);
  return withSpring(
    toValue,
    velocity === undefined ? motion.config : { ...motion.config, velocity },
  );
}
