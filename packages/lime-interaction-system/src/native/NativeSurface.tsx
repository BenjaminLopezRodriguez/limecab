import { useCallback, useMemo, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useLimeColors, radius, spacing, surface as surfaceTokens } from "@lime/ui";
import type { SurfaceState } from "../core/surface.ts";
import type { SurfaceProgressState } from "../core/surface-progress.ts";
import type { SurfaceMotionIntent } from "../core/transition.ts";
import type { PresentationEnvironment } from "../policy/environment.ts";
import { isAnchored, surfaceHeight } from "./extents.ts";
import { animate, motionFor } from "./motion.ts";
import { fractionOf, ladderFor, resolveSnap, type SnapDestination } from "./snap.ts";

/**
 * The surface engine. It understands surface *semantics* and nothing else — no product, no
 * scene, no workflow. What appears inside it arrives as children from the registry, which is
 * what keeps this from growing an `if (riderMatching)` ladder.
 *
 * Three independent axes, three independent physical consequences:
 *   presentation -> how much room it takes
 *   emphasis     -> where it sits in the stack and how present it looks
 *   interaction   -> whether it takes touches
 */

export type DragIntent = "dismiss" | "minimize" | "none";

export interface NativeSurfaceProps {
  state: SurfaceState;
  env: PresentationEnvironment;
  intent?: SurfaceMotionIntent;
  /**
   * What a full drag-down MEANS here. Draft work dismisses; live work minimizes. `none` also
   * removes the dismissal rung from the ladder, exactly as omitting web's `onDismiss` does.
   */
  dragIntent?: DragIntent;
  /** May this sheet be pulled up to fill the viewport? Web's `overlaySnap`. */
  allowOverlay?: boolean;
  /**
   * An async transition currently owning this surface. While one is running it, not the
   * layout, decides whether the surface is on screen: it leaves before the next content
   * arrives, so the canvas is what shows during the gap rather than a card swapping in place.
   * It also holds the lock, which is why the surface stops taking input.
   */
  progress?: SurfaceProgressState;
  /**
   * The rung the drag resolved to. The caller turns it into a shared semantic action — this
   * component never decides what a destination means, only which one was aimed at.
   */
  onSnapTo?: (destination: SnapDestination) => void;
  onMeasure?: (height: number) => void;
  actions?: ReactNode;
  children?: ReactNode;
}

/** How present the surface looks. Emphasis is about attention, not visibility alone. */
const PRESENCE: Record<SurfaceState["emphasis"], { opacity: number; scale: number; lift: number }> = {
  primary: { opacity: 1, scale: 1, lift: 0 },
  background: { opacity: 1, scale: 1, lift: 0 },
  // Held behind an interruption: pushed back in z, dimmed, explicitly not the subject.
  suspended: { opacity: 0.55, scale: 0.94, lift: 0 },
  interrupt: { opacity: 1, scale: 1, lift: 24 },
  hidden: { opacity: 0, scale: 1, lift: 0 },
};

/** Visible and readable at `passive`, but the container does not compete for the touch. */
const pointerFor = (interaction: SurfaceState["interaction"]) =>
  interaction === "active" ? "auto" : interaction === "passive" ? "box-none" : "none";

export function NativeSurface({
  state,
  env,
  intent = "progress",
  dragIntent = "none",
  allowOverlay = true,
  progress,
  onSnapTo,
  onMeasure,
  actions,
  children,
}: NativeSurfaceProps) {
  const c = useLimeColors();
  const motion = useMemo(() => motionFor(intent, env.reducedMotion), [intent, env.reducedMotion]);

  const height = surfaceHeight(state.presentation, env);
  const anchored = isAnchored(state.presentation);
  // A surface that owns the whole screen is a page, not a drawer resting on one — square at
  // the top, and it clears the status bar itself.
  const fills = state.presentation === "fullscreen" || state.presentation === "launcher";
  // A transition in flight overrides the layout's visibility for its duration only.
  const choreographed = progress !== undefined && progress.phase !== "idle";
  const locked = progress?.locked ?? false;
  const hidden =
    state.emphasis === "hidden" ||
    state.presentation === null ||
    (choreographed && !progress.sheetOpen);
  const presence = PRESENCE[state.emphasis];
  const unreachable = hidden || state.interaction === "inert" || locked;

  // Drag is a live finger offset, kept out of React so the gesture never waits on a render.
  const drag = useSharedValue(0);

  const ladderOptions = useMemo(
    () => ({ presentation: state.presentation, canDismiss: dragIntent !== "none", allowOverlay }),
    [state.presentation, dragIntent, allowOverlay],
  );
  // Fewer than two rungs means there is nowhere to go, so there is no gesture to offer.
  const draggable = ladderFor(ladderOptions).length > 1 && !locked;

  // Travel available upward before the sheet is at the top of its ladder. Dragging past it
  // rubber-bands rather than stopping dead, which is what makes the ceiling feel physical.
  const headroom =
    Math.max(0, 1 - (nativeFraction(state.presentation) ?? 0)) * env.viewport.height;

  // How far the body has scrolled, read on the UI thread so the arbitration below never has
  // to wait on a render to know whether the content still has somewhere to go.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  /**
   * Snap resolution runs on the JS thread, not in the worklet.
   *
   * `resolveSnap` is an ordinary pure function — deliberately, so it stays testable headlessly
   * — and the UI runtime cannot call one synchronously. It also does not need to be on the UI
   * thread: it runs once per gesture, at release, long after the frames that mattered.
   */
  const resolveAndEmit = useCallback(
    (translation: number, velocity: number) => {
      const destination = resolveSnap(ladderOptions, {
        translation,
        velocity,
        viewportHeight: env.viewport.height,
      });
      if (destination && destination !== state.presentation) onSnapTo?.(destination);
    },
    [ladderOptions, env.viewport.height, state.presentation, onSnapTo],
  );

  const settle = useCallback(
    (velocity: number) => {
      "worklet";
      const translation = drag.value;
      // Release the finger offset immediately, carrying the throw into the settle so the sheet
      // continues rather than restarting. The surface then settles to whatever height the new
      // SurfaceState gives it, so the drag never becomes a second source of truth.
      drag.value = animate(0, motion, velocity);
      runOnJS(resolveAndEmit)(translation, velocity);
    },
    [drag, motion, resolveAndEmit],
  );

  const move = useCallback(
    (changeY: number) => {
      "worklet";
      const next = drag.value + changeY;
      // Downward is free travel; upward resists once past the top rung.
      drag.value = next < -headroom ? -headroom + (next + headroom) * 0.25 : next;
    },
    [drag, headroom],
  );

  /** The grabber is unambiguous: it only ever moves the sheet, in either direction. */
  const handlePan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(draggable)
        .onChange((e) => move(e.changeY))
        .onEnd((e) => settle(e.velocityY))
        // `onEnd` does not fire when a gesture is cancelled — an incoming call, a system
        // sheet, a competing recogniser — and the finger offset would stay applied forever.
        .onFinalize((_, success) => {
          if (!success) drag.value = animate(0, motion);
        }),
    [draggable, move, settle, drag, motion],
  );

  /**
   * The body is shared between two gestures, so the rule has to be one a thumb can predict:
   * the content scrolls until it has nothing left to give, and only then does the sheet move.
   *
   * Concretely — pulling down while the content is already at its top hands the gesture to the
   * sheet; anything else is a scroll. Once the sheet has taken the gesture it keeps it until
   * the finger lifts, so a drag never stutters back and forth between the two.
   */
  const bodyPan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(draggable)
        // Claim the gesture only once it is clearly a downward pull, so a scroll that happens
        // to start with a pixel of jitter is never stolen from the list.
        .activeOffsetY([-9999, 8])
        .onChange((e) => {
          const engaged = drag.value !== 0;
          const contentAtTop = scrollY.value <= 0;
          if (!engaged && !(e.changeY > 0 && contentAtTop)) return;
          // Never drag the sheet above its rung from the body — that is the grabber's job.
          move(engaged ? e.changeY : Math.max(0, e.changeY));
          if (drag.value < 0) drag.value = 0;
        })
        .onEnd((e) => {
          if (drag.value === 0) return;
          settle(e.velocityY);
        })
        .onFinalize((_, success) => {
          if (!success && drag.value !== 0) drag.value = animate(0, motion);
        }),
    [draggable, scrollY, drag, move, settle, motion],
  );

  /**
   * The list's own scrolling, expressed as a gesture so the two can be composed rather than
   * race. Simultaneous recognition is what lets the pan observe every frame of the drag while
   * the list keeps handling the frames that belong to it.
   */
  const bodyGesture = useMemo(
    () => Gesture.Simultaneous(bodyPan, Gesture.Native()),
    [bodyPan],
  );

  const animatedStyle = useAnimatedStyle(() => {
    // Hidden slides out rather than unmounting, so returning to it is a move, not a redraw.
    const resting = hidden ? height + 64 : 0;
    return {
      height: animate(height, motion),
      opacity: animate(presence.opacity, motion),
      transform: [
        // Two entries, not a sum: `animate` returns an animation descriptor inside the
        // worklet, so adding the drag to it stringifies into "[object Object]0" and React
        // Native rejects the transform. Transforms compose, so the settle and the live finger
        // offset stack correctly as separate translations.
        { translateY: animate(resting, motion) },
        { translateY: drag.value },
        { scale: animate(presence.scale, motion) },
      ],
    };
  }, [hidden, height, presence.opacity, presence.scale, motion]);

  const measure = (e: LayoutChangeEvent) => onMeasure?.(e.nativeEvent.layout.height);

  return (
    <Animated.View
      // Blocking touch is not blocking activation: a screen reader can still fire a control on
      // a surface that is held, locked or off screen unless it leaves the accessibility tree.
      accessibilityElementsHidden={unreachable}
      importantForAccessibility={unreachable ? "no-hide-descendants" : "auto"}
      onLayout={measure}
      style={[
        styles.base,
        { pointerEvents: locked ? "none" : pointerFor(state.interaction) },
        anchored ? styles.anchored : styles.floating,
        {
          backgroundColor: c.surfaceElevated,
          borderColor: c.border,
          borderTopLeftRadius: fills ? 0 : radius.sheet,
          borderTopRightRadius: fills ? 0 : radius.sheet,
          paddingTop: fills ? env.safeArea.top : 0,
          borderBottomLeftRadius: anchored ? 0 : radius.sheet,
          borderBottomRightRadius: anchored ? 0 : radius.sheet,
          paddingBottom: anchored ? env.safeArea.bottom + spacing.md : spacing.lg,
          // The interrupt is the only surface allowed to cast a shadow: it is the only one
          // that is genuinely floating above the rest of the composition.
          boxShadow: presence.lift
            ? `0px -${presence.lift / 3}px ${presence.lift}px rgba(0,0,0,0.18)`
            : undefined,
          zIndex: state.emphasis === "interrupt" ? 30 : state.emphasis === "primary" ? 20 : 10,
        },
        animatedStyle,
      ]}
    >
      <GestureDetector gesture={handlePan}>
        <View style={styles.grabArea}>
          {draggable ? (
            <View
              accessibilityElementsHidden
              style={[styles.grabber, { backgroundColor: c.border }]}
            />
          ) : (
            <View style={styles.grabberSpacer} />
          )}
        </View>
      </GestureDetector>

      {/* A peek sheet is deliberately short, so its content has to be reachable rather than
          clipped. The dock below stays put — the primary action never scrolls away. */}
      <GestureDetector gesture={bodyGesture}>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={state.interaction === "active" && !locked}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </Animated.ScrollView>
      </GestureDetector>
      {actions ? (
        <View style={[styles.actions, { borderTopColor: c.border }]}>{actions}</View>
      ) : null}
    </Animated.View>
  );
}

/** The fraction a presentation occupies, for headroom maths. */
function nativeFraction(presentation: SurfaceState["presentation"]): number | undefined {
  return presentation === null ? 0 : fractionOf(presentation);
}

const styles = StyleSheet.create({
  base: {
    position: "absolute",
    left: 0,
    right: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  anchored: { bottom: 0 },
  floating: { bottom: spacing.xl, marginHorizontal: spacing.md },
  grabArea: { paddingTop: spacing.sm, paddingBottom: spacing.xs, alignItems: "center" },
  grabber: {
    width: surfaceTokens.grabber.width,
    height: surfaceTokens.grabber.height,
    borderRadius: radius.pill,
  },
  grabberSpacer: { height: surfaceTokens.grabber.height },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  actions: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
