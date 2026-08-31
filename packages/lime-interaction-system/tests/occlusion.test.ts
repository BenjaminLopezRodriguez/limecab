import { test } from "node:test";
import assert from "node:assert/strict";

import { surfaceId } from "../src/core/index.ts";
import type { SurfaceLayout, SurfaceState } from "../src/core/surface.ts";
import type { PresentationEnvironment } from "../src/policy/environment.ts";
import { resolveOcclusion, occludingSurface, visibleMapRect } from "../src/policy/occlusion.ts";
import { resolveCamera, project, fit } from "../src/render/camera.ts";
import { createMockMapRenderer } from "../src/render/mock-map.ts";

const iphone: PresentationEnvironment = {
  safeArea: { top: 59, right: 0, bottom: 34, left: 0 },
  viewport: { width: 390, height: 844 },
  keyboard: { visible: false, height: 0 },
  reducedMotion: false,
  fontScale: 1,
};
const desktop: PresentationEnvironment = {
  ...iphone,
  safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
  viewport: { width: 1440, height: 900 },
};

const layout = (presentation: SurfaceState["presentation"]): SurfaceLayout =>
  ({ [surfaceId("primary")]: { emphasis: "primary", presentation, interaction: "active" } });

const PTS = [
  { id: "o", role: "origin" as const, latitude: 34.06, longitude: -117.6, label: "Ontario" },
  { id: "d", role: "destination" as const, latitude: 33.45, longitude: -112.07, label: "Phoenix" },
];

// --- the whole point of G-1: occlusion derives from posture, not from the DOM ---

test("deeper posture occludes more of the map", () => {
  const peek = resolveOcclusion(undefined, layout("peek"), iphone).bottom;
  const sheet = resolveOcclusion(undefined, layout("sheet"), iphone).bottom;
  const expanded = resolveOcclusion(undefined, layout("expanded"), iphone).bottom;
  assert.ok(peek < sheet && sheet < expanded, `${peek} < ${sheet} < ${expanded}`);
});

test("hidden surface occludes nothing beyond gutter and safe area", () => {
  const insets = resolveOcclusion(undefined, layout(null), iphone);
  assert.equal(insets.bottom, 32 + 34); // gutter + safeArea.bottom
});

test("keyboard steals the same screen the sheet does", () => {
  const closed = resolveOcclusion(undefined, layout("sheet"), iphone).bottom;
  const open = resolveOcclusion(undefined, layout("sheet"),
    { ...iphone, keyboard: { visible: true, height: 336 } }).bottom;
  assert.equal(open - closed, 336);
});

test("desktop reserves a side panel instead of bottom occlusion", () => {
  const insets = resolveOcclusion(undefined, layout("sheet"), desktop);
  assert.equal(insets.bottom, 32, "desktop must not pad the bottom by sheet height");
  assert.equal(insets.right, 432, "desktop reserves the panel");
});

test("explicit insets are an escape hatch that wins", () => {
  const insets = { top: 1, right: 2, bottom: 3, left: 4 };
  assert.deepEqual(resolveOcclusion({ source: "explicit", insets }, layout("expanded"), iphone), insets);
});

test("interrupt outranks primary as the occluding surface", () => {
  const both: SurfaceLayout = {
    [surfaceId("primary")]: { emphasis: "suspended", presentation: "sheet", interaction: "inert" },
    [surfaceId("interrupt")]: { emphasis: "interrupt", presentation: "overlay", interaction: "active" },
  };
  assert.equal(occludingSurface(both)?.presentation, "overlay");
});

test("visible rect never goes negative under extreme occlusion", () => {
  const rect = visibleMapRect({ top: 900, right: 900, bottom: 900, left: 900 }, iphone);
  assert.equal(rect.width, 0);
  assert.equal(rect.height, 0);
});

// --- camera ---

test("projection is stable and ordered", () => {
  assert.ok(project(34.06, -117.6).x < project(33.45, -112.07).x, "west is left of east");
  assert.ok(project(34.06, -117.6).y < project(33.45, -112.07).y, "north is above south");
});

test("bottom occlusion zooms out only when height is the binding constraint", () => {
  // Ontario->Phoenix is a wide, short span: width binds, so a taller sheet cannot change
  // its zoom. That is correct, not a bug — assert it explicitly so nobody "fixes" it.
  const wideOpen = fit(PTS, resolveOcclusion(undefined, layout("peek"), iphone), iphone).zoom;
  const wideTight = fit(PTS, resolveOcclusion(undefined, layout("expanded"), iphone), iphone).zoom;
  assert.equal(wideTight, wideOpen, "width-bound framing is unaffected by bottom occlusion");

  // A north-south pair is height-bound, so occlusion must zoom out.
  const NS = [
    { id: "n", role: "origin" as const, latitude: 34.5, longitude: -117.0 },
    { id: "s", role: "destination" as const, latitude: 33.0, longitude: -117.0 },
  ];
  const open = fit(NS, resolveOcclusion(undefined, layout("peek"), iphone), iphone).zoom;
  const tight = fit(NS, resolveOcclusion(undefined, layout("expanded"), iphone), iphone).zoom;
  assert.ok(tight < open, `height-bound framing must zoom out: ${tight} < ${open}`);
});

test("camera intent preserve keeps the previous frame", () => {
  const prev = { centerLat: 1, centerLng: 2, zoom: 9 };
  const got = resolveCamera(
    { mode: "active_route", points: PTS, camera: { intent: "preserve" } },
    resolveOcclusion(undefined, layout("sheet"), iphone), iphone, prev);
  assert.deepEqual(got, prev);
});

test("follow centres on the subject, not the bounds", () => {
  const pts = [...PTS, { id: "s", role: "subject" as const, latitude: 33.9, longitude: -115 }];
  const got = resolveCamera(
    { mode: "active_route", points: pts, camera: { intent: "follow" } },
    resolveOcclusion(undefined, layout("sheet"), iphone), iphone);
  assert.equal(got.centerLat, 33.9);
});

// --- mock renderer: offline, deterministic ---

test("mock map renders offline with no token, no DOM", () => {
  const insets = resolveOcclusion(undefined, layout("sheet"), iphone);
  const svg = createMockMapRenderer().render(
    { mode: "route_preview", points: PTS, route: { originId: "o", destinationId: "d" } },
    insets, iphone);
  assert.match(svg, /^<svg /);
  assert.match(svg, /Ontario/);
  assert.match(svg, /occluded/);
  // xmlns is a namespace identifier, not a fetch — exclude it before checking.
  const withoutNs = svg.replace(/xmlns="[^"]*"/g, "");
  assert.ok(!/mapbox|https?:\/\//.test(withoutNs), "must make no network reference");
});

test("mock map output is deterministic", () => {
  const insets = resolveOcclusion(undefined, layout("sheet"), iphone);
  const r = createMockMapRenderer();
  const scene = { mode: "route_preview" as const, points: PTS };
  assert.equal(r.render(scene, insets, iphone), r.render(scene, insets, iphone));
});

test("label text is escaped", () => {
  const insets = resolveOcclusion(undefined, layout("peek"), iphone);
  const svg = createMockMapRenderer().render(
    { mode: "home", points: [{ id: "x", role: "poi", latitude: 34, longitude: -117, label: '<script>&' }] },
    insets, iphone);
  assert.ok(!svg.includes("<script>"), "raw markup must not reach output");
  assert.match(svg, /&lt;script&gt;&amp;/);
});
