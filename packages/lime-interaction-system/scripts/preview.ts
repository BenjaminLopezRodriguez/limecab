/**
 * Renders canonical scenes with the offline mock and writes one HTML page.
 * No Storybook, no React, no Mapbox token, no network. `node --experimental-strip-types`.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { surfaceId } from "../src/core/index.ts";
import type { SurfaceLayout, SurfacePresentation } from "../src/core/surface.ts";
import type { MapSceneState } from "../src/core/map.ts";
import type { PresentationEnvironment } from "../src/policy/environment.ts";
import { resolveOcclusion } from "../src/policy/occlusion.ts";
import { createMockMapRenderer } from "../src/render/mock-map.ts";

const phone = (over: Partial<PresentationEnvironment> = {}): PresentationEnvironment => ({
  safeArea: { top: 59, right: 0, bottom: 34, left: 0 },
  viewport: { width: 390, height: 844 },
  keyboard: { visible: false, height: 0 },
  reducedMotion: false, fontScale: 1, ...over,
});

const lay = (p: SurfacePresentation | null): SurfaceLayout =>
  ({ [surfaceId("primary")]: { emphasis: "primary", presentation: p, interaction: "active" } });

const ONT = { id: "o", role: "origin" as const, latitude: 34.06, longitude: -117.6, label: "Ontario, CA" };
const PHX = { id: "d", role: "destination" as const, latitude: 33.45, longitude: -112.07, label: "Phoenix, AZ" };
const TRUCK = { id: "s", role: "subject" as const, latitude: 33.8, longitude: -114.5, label: "Truck" };

const scenes: { title: string; note: string; scene: MapSceneState; presentation: SurfacePresentation | null; env: PresentationEnvironment }[] = [
  { title: "Rider · home", note: "peek 0.22 — ambient world, sheet barely occludes",
    scene: { mode: "home", points: [ONT] }, presentation: "peek", env: phone() },
  { title: "Rider · route preview", note: "sheet 0.40 — camera pads, map does not shrink",
    scene: { mode: "route_preview", points: [ONT, PHX], route: { originId: "o", destinationId: "d" } },
    presentation: "sheet", env: phone() },
  { title: "Rider · destination search", note: "keyboard steals the same screen the sheet does",
    scene: { mode: "select_location", points: [ONT] }, presentation: "expanded",
    env: phone({ keyboard: { visible: true, height: 336 } }) },
  { title: "Freight · linehaul", note: "follow intent centres the subject, ignores bounds",
    scene: { mode: "active_route", points: [ONT, PHX, TRUCK], route: { originId: "o", destinationId: "d" }, camera: { intent: "follow" } },
    presentation: "sheet", env: phone() },
  { title: "Freight · minimized", note: "live work recedes; the world reclaims the screen",
    scene: { mode: "active_route", points: [ONT, PHX, TRUCK], route: { originId: "o", destinationId: "d" } },
    presentation: "peek", env: phone() },
  { title: "Desktop · route preview", note: "side panel reserved (432) — no bottom occlusion",
    scene: { mode: "route_preview", points: [ONT, PHX], route: { originId: "o", destinationId: "d" } },
    presentation: "sheet", env: phone({ viewport: { width: 1440, height: 900 }, safeArea: { top: 0, right: 0, bottom: 0, left: 0 } }) },
];

const renderer = createMockMapRenderer({ theme: "light" });
const cards = scenes.map(({ title, note, scene, presentation, env }) => {
  const insets = resolveOcclusion(scene.occlusion, lay(presentation), env);
  const svg = renderer.render(scene, insets, env);
  const scale = env.viewport.width > 800 ? 0.46 : 1;
  return `<figure><figcaption><b>${title}</b><span>${note}</span>
    <code>${presentation ?? "hidden"} · insets t${insets.top} r${insets.right} b${insets.bottom} l${insets.left}</code>
  </figcaption><div class="vp" style="width:${env.viewport.width * scale}px;height:${env.viewport.height * scale}px">
    <div style="transform:scale(${scale});transform-origin:top left">${svg}</div></div></figure>`;
}).join("\n");

const html = `<!doctype html><meta charset="utf-8"><title>Lime mock map · occlusion preview</title>
<style>
 body{background:#EBEDE8;color:#1B1E19;font:14px/1.5 system-ui;margin:0;padding:32px}
 h1{font-size:20px;margin:0 0 4px} p.sub{color:#6E7468;margin:0 0 28px}
 .grid{display:flex;flex-wrap:wrap;gap:28px;align-items:flex-start}
 figure{margin:0} figcaption{margin:0 0 8px;display:flex;flex-direction:column;gap:2px}
 figcaption span{color:#6E7468;font-size:12.5px}
 figcaption code{font:11px ui-monospace,monospace;color:#5F8A11}
 .vp{overflow:hidden;border:1px solid #D0D4C9;border-radius:12px;background:#fff}
</style>
<h1>Occlusion &rarr; camera framing</h1>
<p class="sub">Rendered offline. No Mapbox token, no network, no React. Dashed lime rect = visible map after occlusion; shaded band = screen the surface takes.</p>
<div class="grid">${cards}</div>`;

const out = resolve(dirname(fileURLToPath(import.meta.url)), "../preview.html");
writeFileSync(out, html);
console.log(out);
