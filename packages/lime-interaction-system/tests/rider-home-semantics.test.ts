import { test } from "node:test";
import assert from "node:assert/strict";

import {
  initialSurfaceManagerState,
  reduceSurfaceManager,
} from "../src/core/surface-manager.ts";
import type { SurfaceState } from "../src/core/surface.ts";
import { shouldMountSurface } from "../src/native/mount-policy.ts";
import { rideSurfaces } from "../src/recipes/ride.ts";
import { launcher, restingTask, SURFACES } from "../src/recipes/surfaces.ts";

test("hidden surfaces do not mount; suspended surfaces do", () => {
  const hidden: SurfaceState = { emphasis: "hidden", presentation: null, interaction: "inert" };
  const suspended: SurfaceState = { emphasis: "suspended", presentation: "sheet", interaction: "inert" };
  const primary: SurfaceState = { emphasis: "primary", presentation: "sheet", interaction: "active" };

  assert.equal(shouldMountSurface(hidden), false);
  assert.equal(shouldMountSurface(suspended), true);
  assert.equal(shouldMountSurface(primary), true);
});

test("rider home keeps search hidden so destination autoFocus cannot mount", () => {
  const home = reduceSurfaceManager(
    initialSurfaceManagerState(rideSurfaces),
    { type: "apply", intent: "collapse", surfaces: launcher },
    rideSurfaces,
  );

  assert.equal(home.layout[SURFACES.secondary]?.emphasis, "hidden");
  assert.equal(shouldMountSurface(home.layout[SURFACES.secondary]! as SurfaceState), false);
});

test("opening search activates secondary; closing it hides search again", () => {
  const start = initialSurfaceManagerState(rideSurfaces);
  const searching = reduceSurfaceManager(start, { type: "perform", action: "openSearch" }, rideSurfaces);

  assert.equal(searching.layout[SURFACES.secondary]?.emphasis, "primary");
  assert.equal(searching.layout[SURFACES.primary]?.emphasis, "hidden");
  assert.equal(shouldMountSurface(searching.layout[SURFACES.secondary]! as SurfaceState), true);
  assert.equal(shouldMountSurface(searching.layout[SURFACES.primary]! as SurfaceState), false);

  const dismissed = reduceSurfaceManager(
    searching,
    { type: "apply", intent: "collapse", surfaces: launcher },
    rideSurfaces,
  );

  assert.equal(dismissed.layout[SURFACES.secondary]?.emphasis, "hidden");
  assert.equal(shouldMountSurface(dismissed.layout[SURFACES.secondary]! as SurfaceState), false);
});

test("ride extras keep the pickup sheet mounted while suspended", () => {
  const offered = reduceSurfaceManager(
    initialSurfaceManagerState(rideSurfaces),
    { type: "perform", action: "offerExtras" },
    rideSurfaces,
  );

  assert.equal(offered.layout[SURFACES.primary]?.emphasis, "suspended");
  assert.equal(shouldMountSurface(offered.layout[SURFACES.primary]! as SurfaceState), true);
  assert.equal(offered.layout[SURFACES.interrupt]?.emphasis, "interrupt");
});

test("resting task hides secondary without suspending primary", () => {
  const resting = reduceSurfaceManager(
    initialSurfaceManagerState(rideSurfaces),
    { type: "apply", intent: "progress", surfaces: restingTask },
    rideSurfaces,
  );

  assert.equal(resting.layout[SURFACES.primary]?.emphasis, "primary");
  assert.equal(resting.layout[SURFACES.secondary]?.emphasis, "hidden");
  assert.equal(shouldMountSurface(resting.layout[SURFACES.secondary]! as SurfaceState), false);
});
