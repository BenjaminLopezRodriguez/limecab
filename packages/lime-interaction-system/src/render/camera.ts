import type { EdgeInsets, MapPoint, MapSceneState } from "../core/map.ts";
import type { PresentationEnvironment } from "../policy/environment.ts";
import { visibleMapRect } from "../policy/occlusion.ts";

/**
 * Camera geometry. Renderer-neutral: takes an intent plus occlusion, returns a viewport.
 * Mapbox GL JS and Mapbox Native disagree on fitBounds/padding/animation-interruption, so
 * the contract specifies camera INTENT and this computes the framing — never a command
 * sequence for one SDK.
 */

export interface Viewport { centerLat: number; centerLng: number; zoom: number }
export interface ScreenPoint { x: number; y: number }

const TILE = 512;
const clampLat = (lat: number) => Math.max(-85.05112878, Math.min(85.05112878, lat));

/** Web Mercator, normalized 0..1. */
export function project(lat: number, lng: number): ScreenPoint {
  const s = Math.sin((clampLat(lat) * Math.PI) / 180);
  return {
    x: (lng + 180) / 360,
    y: 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI),
  };
}

/** Frame points inside the rect left visible by occlusion. */
export function fit(
  points: readonly MapPoint[],
  insets: EdgeInsets,
  env: PresentationEnvironment,
  maxZoom = 16,
): Viewport {
  if (points.length === 0) return { centerLat: 0, centerLng: 0, zoom: 1 };

  const projected = points.map((p) => project(p.latitude, p.longitude));
  const minX = Math.min(...projected.map((p) => p.x));
  const maxX = Math.max(...projected.map((p) => p.x));
  const minY = Math.min(...projected.map((p) => p.y));
  const maxY = Math.max(...projected.map((p) => p.y));

  const rect = visibleMapRect(insets, env);
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);

  const zoom = Math.min(
    maxZoom,
    Math.log2(Math.min(rect.width / (spanX * TILE), rect.height / (spanY * TILE))),
  );

  // Unproject the centre of the projected bounds back to lat/lng.
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    centerLng: cx * 360 - 180,
    centerLat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * cy))) * 180) / Math.PI,
    zoom: Math.max(0, zoom),
  };
}

/** Where a point lands on screen, accounting for occlusion offset. */
export function toScreen(
  lat: number, lng: number, view: Viewport, insets: EdgeInsets, env: PresentationEnvironment,
): ScreenPoint {
  const scale = TILE * Math.pow(2, view.zoom);
  const p = project(lat, lng);
  const c = project(view.centerLat, view.centerLng);
  const rect = visibleMapRect(insets, env);
  return {
    x: rect.x + rect.width / 2 + (p.x - c.x) * scale,
    y: rect.y + rect.height / 2 + (p.y - c.y) * scale,
  };
}

/** Screen point back to a coordinate — the inverse of `toScreen`, for taps on the canvas. */
export function fromScreen(
  point: ScreenPoint, view: Viewport, insets: EdgeInsets, env: PresentationEnvironment,
): { latitude: number; longitude: number } {
  const scale = TILE * Math.pow(2, view.zoom);
  const c = project(view.centerLat, view.centerLng);
  const rect = visibleMapRect(insets, env);
  const x = c.x + (point.x - rect.x - rect.width / 2) / scale;
  const y = c.y + (point.y - rect.y - rect.height / 2) / scale;
  return {
    longitude: x * 360 - 180,
    latitude: (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI,
  };
}

/** Resolve camera intent to a viewport. `preserve` keeps the previous frame. */
export function resolveCamera(
  scene: MapSceneState,
  insets: EdgeInsets,
  env: PresentationEnvironment,
  previous?: Viewport,
): Viewport {
  const points = scene.points ?? [];
  const intent = scene.camera?.intent ?? "fit";

  if (intent === "preserve" && previous) return previous;
  if (intent === "follow" || intent === "center") {
    const subject = points.find((p) => p.role === "subject") ?? points[0];
    if (!subject) return previous ?? { centerLat: 0, centerLng: 0, zoom: 1 };
    return {
      centerLat: subject.latitude,
      centerLng: subject.longitude,
      zoom: intent === "follow" ? 15 : 13,
    };
  }
  return fit(points, insets, env);
}
