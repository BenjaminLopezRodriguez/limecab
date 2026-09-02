import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import type { EdgeInsets, MapSceneState } from "../core/map.ts";
import type { SurfaceState } from "../core/surface.ts";
import type { PresentationEnvironment } from "../policy/environment.ts";
import { fromScreen, resolveCamera, type Viewport } from "../render/camera.ts";
import { NativeMap } from "./NativeMapRenderer.tsx";

/**
 * The world, as a surface.
 *
 * The map is not scenery. When the composition says
 *
 *     map: { emphasis: "primary", interaction: "active" }
 *
 * the canvas *is* the subject — that is how production expresses "set the pickup with a pin" —
 * and it has to accept touches. A renderer that draws the map behind `pointerEvents: none`
 * cannot express that composition at all, which is why this is a surface component rather
 * than a backdrop inside the scene renderer.
 *
 * Interaction follows the contract and nothing else: `active` takes gestures, `passive` shows
 * without taking them, `inert` and `hidden` take nothing. No product state reaches this file.
 */
export interface NativeMapSurfaceProps {
  state: SurfaceState;
  scene: MapSceneState;
  env: PresentationEnvironment;
  insets: EdgeInsets;
  previous?: Viewport;
  /** A coordinate the user indicated on the canvas. The host turns it into a semantic action. */
  onPick?: (point: { latitude: number; longitude: number }) => void;
  debugOcclusion?: boolean;
}

export function NativeMapSurface({
  state,
  scene,
  env,
  insets,
  previous,
  onPick,
  debugOcclusion,
}: NativeMapSurfaceProps) {
  const active = state.interaction === "active" && state.emphasis !== "hidden";

  const view = useMemo(
    () => resolveCamera(scene, insets, env, previous),
    [scene, insets, env, previous],
  );

  /**
   * Unprojection happens on the JS thread. `fromScreen` is an ordinary pure function — kept
   * that way so the camera maths stays headlessly testable — and the UI runtime cannot call
   * one synchronously. It runs once per tap, so it has no business being on the UI thread.
   */
  const unproject = useCallback(
    (x: number, y: number) => onPick?.(fromScreen({ x, y }, view, insets, env)),
    [onPick, view, insets, env],
  );

  const pick = useMemo(
    () =>
      Gesture.Tap()
        .enabled(active && Boolean(onPick))
        .onEnd((e) => {
          runOnJS(unproject)(e.absoluteX, e.absoluteY);
        }),
    [active, onPick, unproject],
  );

  return (
    <GestureDetector gesture={pick}>
      <View
        style={[StyleSheet.absoluteFill, { opacity: state.emphasis === "hidden" ? 0 : 1 }]}
        // `passive` is the ordinary posture: the world is legible context that does not
        // compete for the touch. Only a subject map takes it.
        pointerEvents={active ? "auto" : "none"}
      >
        <NativeMap
          scene={scene}
          insets={insets}
          env={env}
          previous={previous}
          debugOcclusion={debugOcclusion}
        />
        {/* The reticle promises that a tap places a point, so it appears only where one does.
            A subject map that merely accepts panning must not claim otherwise. */}
        {active && onPick ? <Reticle env={env} insets={insets} /> : null}
      </View>
    </GestureDetector>
  );
}

/** The fixed centre mark of a pin-drop. It never moves; the world moves under it. */
function Reticle({ env, insets }: { env: PresentationEnvironment; insets: EdgeInsets }) {
  const cx = insets.left + (env.viewport.width - insets.left - insets.right) / 2;
  const cy = insets.top + (env.viewport.height - insets.top - insets.bottom) / 2;
  return (
    <View aria-hidden pointerEvents="none" style={{ position: "absolute", left: cx - 11, top: cy - 22 }}>
      <View style={styles.pin} />
      <View style={styles.needle} />
    </View>
  );
}

const styles = StyleSheet.create({
  pin: { width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: "#151A16", backgroundColor: "transparent" },
  needle: { width: 2, height: 12, marginLeft: 10, backgroundColor: "#151A16" },
});
