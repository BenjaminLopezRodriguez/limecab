import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLimeColors, radius, spacing, typography, typeStyle } from "@lime/ui";
import type { EdgeInsets, MapMode, MapPoint, MapSceneState } from "../core/map.ts";
import type { PresentationEnvironment } from "../policy/environment.ts";
import type { MapRenderer } from "../render/map-renderer.ts";
import { resolveCamera, toScreen, type Viewport } from "../render/camera.ts";
import { visibleMapRect } from "../policy/occlusion.ts";

/**
 * The world. A placeholder for Mapbox Native, occupying its exact architectural position:
 * it implements `MapRenderer<ReactNode>`, consumes the real `MapSceneState`, and frames itself
 * with the same `resolveCamera` / `toScreen` math the web renderer uses. Swapping in Mapbox
 * means replacing this file, not rewiring the scene contract.
 *
 * It draws nothing of its own invention — every marker comes from `scene.points`, the line
 * comes from `scene.route`, and the framing comes from `scene.camera.intent` evaluated against
 * the insets the surfaces occlude.
 */

/** What the world is *for* right now. Mode changes the treatment, never the geometry. */
const MODE_LABEL: Record<MapMode, string> = {
  home: "Nearby",
  select_location: "Choose a place",
  coverage: "Coverage",
  route_preview: "Route",
  provider_arrival: "Arriving",
  active_route: "On the move",
  results: "Trip summary",
};

export interface NativeMapProps {
  scene: MapSceneState;
  insets: EdgeInsets;
  env: PresentationEnvironment;
  previous?: Viewport;
  /** Draws the occluded region, for checking that surfaces and camera agree. */
  debugOcclusion?: boolean;
  /**
   * The mode chip belongs to a canvas that fills the screen. Inside a card the world is an
   * illustration of somewhere, not the surface you are working on, and the label is noise.
   */
  showMode?: boolean;
}

export function NativeMap({ scene, insets, env, previous, debugOcclusion, showMode = true }: NativeMapProps) {
  const c = useLimeColors();

  const view = useMemo(() => resolveCamera(scene, insets, env, previous), [scene, insets, env, previous]);
  const rect = useMemo(() => visibleMapRect(insets, env), [insets, env]);

  const placed = useMemo(
    () =>
      (scene.points ?? []).map((p) => ({ point: p, at: toScreen(p.latitude, p.longitude, view, insets, env) })),
    [scene.points, view, insets, env],
  );

  const leg = useMemo(() => {
    if (!scene.route) return null;
    const from = placed.find((p) => p.point.id === scene.route!.originId);
    const to = placed.find((p) => p.point.id === scene.route!.destinationId);
    if (!from || !to) return null;
    const dx = to.at.x - from.at.x;
    const dy = to.at.y - from.at.y;
    return {
      left: from.at.x,
      top: from.at.y,
      width: Math.hypot(dx, dy),
      angle: `${Math.atan2(dy, dx)}rad`,
    };
  }, [scene.route, placed]);

  // Following implies motion, so the world reads tighter and more attentive than when fitting.
  const following = scene.camera?.intent === "follow";

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.background, pointerEvents: "none" }]}>
      <Graticule color={c.border} spacing={following ? 48 : 72} />

      {debugOcclusion ? (
        <View
          style={{
            position: "absolute",
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            borderWidth: 1,
            borderColor: c.accent,
            opacity: 0.4,
          }}
        />
      ) : null}

      {leg ? (
        <View
          style={{
            position: "absolute",
            left: leg.left,
            top: leg.top - 2,
            width: leg.width,
            height: 4,
            borderRadius: radius.pill,
            backgroundColor: c.foreground,
            transform: [{ rotateZ: leg.angle }],
            transformOrigin: "left center",
          }}
        />
      ) : null}

      {placed.map(({ point, at }) => (
        <Marker key={point.id} point={point} x={at.x} y={at.y} />
      ))}

      {showMode ? (
      <View
        style={{
          position: "absolute",
          top: insets.top,
          left: spacing.xl,
          paddingHorizontal: spacing.md,
          paddingVertical: 6,
          borderRadius: radius.pill,
          backgroundColor: c.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.border,
        }}
      >
        <Text style={{ ...typeStyle(typography.eyebrow), textTransform: "uppercase", color: c.mutedForeground }}>
          {MODE_LABEL[scene.mode]}
        </Text>
      </View>
      ) : null}
    </View>
  );
}

/**
 * The subject — you, or the vehicle — is the one live thing in the world, so it carries the
 * accent. Everything else is a place, and places are neutral.
 */
function Marker({ point, x, y }: { point: MapPoint; x: number; y: number }) {
  const c = useLimeColors();
  const live = point.role === "subject" || point.role === "provider";
  const size = live ? 18 : 14;
  return (
    <View style={{ position: "absolute", left: x - size / 2, top: y - size / 2, alignItems: "center" }}>
      {live ? (
        <View
          style={{
            position: "absolute",
            width: size * 2.6,
            height: size * 2.6,
            left: -size * 0.8,
            top: -size * 0.8,
            borderRadius: radius.pill,
            backgroundColor: c.accent,
            opacity: 0.18,
          }}
        />
      ) : null}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: point.role === "destination" ? 3 : radius.pill,
          borderCurve: "continuous",
          backgroundColor: live ? c.accent : c.foreground,
          borderWidth: 2,
          borderColor: c.surface,
        }}
      />
    </View>
  );
}

/** A ground plane. Enough to read movement and scale against; deliberately not a fake city. */
function Graticule({ color, spacing: gap }: { color: string; spacing: number }) {
  const lines = useMemo(() => Array.from({ length: 24 }, (_, i) => i * gap), [gap]);
  return (
    <View style={StyleSheet.absoluteFill}>
      {lines.map((offset) => (
        <View key={`h${offset}`} style={{ position: "absolute", left: 0, right: 0, top: offset, height: StyleSheet.hairlineWidth, backgroundColor: color, opacity: 0.6 }} />
      ))}
      {lines.map((offset) => (
        <View key={`v${offset}`} style={{ position: "absolute", top: 0, bottom: 0, left: offset, width: StyleSheet.hairlineWidth, backgroundColor: color, opacity: 0.6 }} />
      ))}
    </View>
  );
}

/** The `MapRenderer` seam, so a Mapbox implementation can be swapped in by type. */
export const nativeMapRenderer: MapRenderer<ReactNode> = {
  render(scene, insets, env) {
    return <NativeMap scene={scene} insets={insets} env={env} />;
  },
};
