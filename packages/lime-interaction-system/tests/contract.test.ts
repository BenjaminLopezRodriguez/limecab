import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { surfaceId, sceneId } from "../src/core/index.ts";
import { extentFor, webMobileExtents } from "../src/recipes/web-mobile/surface-extents.ts";
import { motionFor, webMotion } from "../src/recipes/web/motion.ts";
import { reduceSurfaceProgress, SURFACE_PROGRESS_IDLE } from "../src/core/surface-progress.ts";

const coreDir = resolve(dirname(fileURLToPath(import.meta.url)), "../src/core");
const coreFiles = readdirSync(coreDir).filter((f) => f.endsWith(".ts"));

/** Strip comments — prose explaining why a thing is excluded must not trip the check. */
function code(file: string): string {
  return readFileSync(resolve(coreDir, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

// --- boundary invariants: the whole point of the layering ---

test("core imports no DOM or browser globals", () => {
  const banned = /\b(window|document|navigator|HTMLElement|requestAnimationFrame|localStorage)\b/;
  for (const f of coreFiles) {
    assert.ok(!banned.test(code(f)), `${f} references a browser global`);
  }
});

test("core imports no platform or framework packages", () => {
  const banned = /from\s+["'](react|next\/|mapbox|@base-ui|@trpc|drizzle)/;
  for (const f of coreFiles) {
    assert.ok(!banned.test(code(f)), `${f} imports a platform package`);
  }
});

test("no semantic core module imports PresentationEnvironment", () => {
  // The named review failure: `if (env.keyboard.visible)` inside a reducer.
  for (const f of coreFiles) {
    assert.ok(!/PresentationEnvironment|policy\//.test(code(f)), `${f} reaches into policy/`);
  }
});

test("core carries no viewport-layout policy values", () => {
  // Snap fractions live in recipes/, not core. Guards against re-canonizing 0.22/0.40/0.60.
  for (const f of coreFiles) {
    if (f === "surface-manager.ts" || f === "surface-progress.ts") continue; // extracted verbatim
    assert.ok(!/0\.22|0\.40|0\.6\b/.test(code(f)), `${f} hardcodes a snap fraction`);
  }
});

// --- renderer policy behaves ---

test("extentFor maps presentation to viewport fraction", () => {
  assert.equal(extentFor("peek"), 0.22);
  assert.equal(extentFor("overlay"), 1);
  assert.equal(extentFor(null), 0, "hidden surface occludes nothing");
  assert.equal(extentFor("compact-interrupt"), 0, "unmapped presentation must not crash");
  assert.equal(webMobileExtents.sheet, 0.4);
});

test("reduced motion collapses duration without losing the intent", () => {
  assert.equal(motionFor("progress", false).duration, 220);
  assert.equal(motionFor("progress", true).duration, 0);
  assert.equal(motionFor("progress", true).delay, 0);
  assert.deepEqual(motionFor("progress", true).easing, webMotion.progress.easing);
});

// --- branded ids ---

test("branded id constructors keep runtime value intact", () => {
  assert.equal(surfaceId("ride-status") as string, "ride-status");
  assert.equal(sceneId("linehaul") as string, "linehaul");
});

// --- extracted reducer still runs headless ---

test("extracted progress reducer runs with no DOM present", () => {
  assert.equal(SURFACE_PROGRESS_IDLE.phase, "idle");
  const next = reduceSurfaceProgress(SURFACE_PROGRESS_IDLE, {
    type: "start", from: "home", to: "quote", interim: false,
  });
  assert.notEqual(next.phase, "idle", "start must leave idle");
});
