import type { MapPoint, MapSceneState, EdgeInsets } from "../core/map.ts";
import type { PresentationEnvironment } from "../policy/environment.ts";
import type { MapRenderer } from "./map-renderer.ts";
import { resolveCamera, toScreen } from "./camera.ts";
import { visibleMapRect } from "../policy/occlusion.ts";
import { color } from "../tokens/color.ts";

/**
 * Offline map renderer. Emits an SVG string — no React, no DOM, no Mapbox token, no network.
 * Storybook must boot without production secrets; this is what makes that true.
 *
 * It visualizes what matters for design review: point roles, route geometry, camera framing,
 * and — drawn explicitly — the occluded region and the visible rect the camera fits into.
 * It is deliberately not geospatially accurate.
 */

const ROLE_FILL: Record<MapPoint["role"], keyof typeof color> = {
  origin: "foreground",
  destination: "lime",
  subject: "lime",
  provider: "foreground",
  facility: "mutedForeground",
  poi: "mutedForeground",
};

const esc = (s: string) => s.replace(/[<>&"]/g, (c) =>
  ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] ?? c);

export interface MockMapOptions { theme?: "light" | "dark"; showOcclusion?: boolean }

export function createMockMapRenderer(
  options: MockMapOptions = {},
): MapRenderer<string> {
  const theme = options.theme ?? "light";
  const showOcclusion = options.showOcclusion ?? true;
  const c = (k: keyof typeof color) => color[k][theme];

  return {
    render(scene: MapSceneState, insets: EdgeInsets, env: PresentationEnvironment): string {
      const { width: W, height: H } = env.viewport;
      const view = resolveCamera(scene, insets, env);
      const rect = visibleMapRect(insets, env);
      const pts = scene.points ?? [];
      const at = (p: MapPoint) => toScreen(p.latitude, p.longitude, view, insets, env);

      const parts: string[] = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(scene.mode)} map">`,
        `<rect width="${W}" height="${H}" fill="${c("muted")}"/>`,
      ];

      // graticule — cheap "this is a map" signal
      for (let x = 0; x < W; x += 48)
        parts.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${c("border")}" stroke-width="1"/>`);
      for (let y = 0; y < H; y += 48)
        parts.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${c("border")}" stroke-width="1"/>`);

      if (showOcclusion) {
        parts.push(
          `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="none" stroke="${c("lime")}" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.8"/>`,
          `<text x="${rect.x + 6}" y="${rect.y + 16}" font-family="monospace" font-size="10" fill="${c("lime")}">visible rect ${Math.round(rect.width)}x${Math.round(rect.height)}</text>`,
        );
        if (insets.bottom > 0)
          parts.push(
            `<rect x="0" y="${H - insets.bottom}" width="${W}" height="${insets.bottom}" fill="${c("foreground")}" opacity="0.06"/>`,
            `<text x="8" y="${H - insets.bottom + 14}" font-family="monospace" font-size="10" fill="${c("mutedForeground")}">occluded ${Math.round(insets.bottom)}px</text>`,
          );
      }

      // route
      if (scene.route) {
        const o = pts.find((p) => p.id === scene.route!.originId);
        const d = pts.find((p) => p.id === scene.route!.destinationId);
        if (o && d) {
          const a = at(o), b = at(d);
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - Math.abs(b.x - a.x) * 0.18;
          parts.push(`<path d="M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}" fill="none" stroke="${c("lime")}" stroke-width="4" stroke-linecap="round"/>`);
        }
      }

      for (const p of pts) {
        const s = at(p);
        const fill = c(ROLE_FILL[p.role]);
        parts.push(
          `<circle cx="${s.x}" cy="${s.y}" r="7" fill="${fill}" stroke="${c("panel")}" stroke-width="2.5"/>`,
        );
        if (p.label)
          parts.push(`<text x="${s.x + 12}" y="${s.y + 4}" font-family="system-ui" font-size="12" font-weight="600" fill="${c("foreground")}">${esc(p.label)}</text>`);
      }

      parts.push(
        `<text x="8" y="${H - 8}" font-family="monospace" font-size="10" fill="${c("mutedForeground")}">${esc(scene.mode)} · zoom ${view.zoom.toFixed(2)} · mock</text>`,
        `</svg>`,
      );
      return parts.join("");
    },
  };
}
