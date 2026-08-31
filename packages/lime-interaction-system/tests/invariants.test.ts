import { test } from "node:test";
import assert from "node:assert/strict";

import { createScenario } from "../src/harness/flow-machine.ts";
import { freightHappyPath, type FreightStep } from "../src/scenarios/freight/happy-path.ts";
import { resolveOcclusion } from "../src/policy/occlusion.ts";
import type { PresentationEnvironment } from "../src/policy/environment.ts";

/**
 * Interaction invariants (spec §19) — architectural rules, tested as behaviour.
 * These are the conditions that decide whether the architecture is viable at all.
 */

const env: PresentationEnvironment = {
  safeArea: { top: 59, right: 0, bottom: 34, left: 0 },
  viewport: { width: 390, height: 844 },
  keyboard: { visible: false, height: 0 },
  reducedMotion: false, fontScale: 1,
};

const run = (from?: Parameters<typeof createScenario<FreightStep>>[1]) =>
  createScenario(freightHappyPath, from);

const to = (m: ReturnType<typeof run>, step: FreightStep) => { m.jump(step); return m; };

// --- §32: the full ladder ---

test("freight ladder walks assigned -> complete", () => {
  const m = run();
  const seen: FreightStep[] = [m.snapshot().step];
  while (m.canAdvance()) { m.next(); seen.push(m.snapshot().step); }
  assert.deepEqual(seen, freightHappyPath.order);
  assert.equal(m.canAdvance(), false, "complete is terminal");
});

// --- a live job must not silently disappear ---

test("minimizing live work collapses the surface but never removes it", () => {
  const m = to(run(), "linehaul");
  m.minimize();
  const surfaces = Object.values(m.frame().scene.surfaces);
  assert.equal(surfaces.length, 1, "surface still present");
  assert.equal(surfaces[0]!.presentation, "peek", "receded, not gone");
  assert.notEqual(surfaces[0]!.emphasis, "hidden", "a live job must remain visible");
});

test("a minimized live job is recoverable", () => {
  const m = to(run(), "linehaul");
  m.minimize();
  assert.equal(m.snapshot().minimized, true);
  m.restore();
  assert.equal(m.snapshot().minimized, false);
});

test("minimize restores the EXACT prior state", () => {
  const m = to(run(), "linehaul");
  const before = m.frame();
  m.minimize();
  m.restore();
  assert.deepEqual(m.frame().scene, before.scene, "scene must round-trip identically");
});

test("non-live steps cannot be minimized", () => {
  const m = to(run(), "complete");
  m.minimize();
  assert.equal(m.snapshot().minimized, false, "a terminal step has no live work to minimize");
});

// --- interrupts preserve the underlying state ---

test("opening an interrupt preserves the underlying scene", () => {
  const m = to(run(), "loading");
  const underlying = m.frame().scene.id;
  m.openInterrupt("damage");
  assert.equal(m.frame().scene.id, underlying, "the scene behind must not change");
  assert.equal(m.frame().transition?.intent, "interrupt");
});

test("closing an interrupt restores the exact loading state (§32)", () => {
  const m = to(run(), "loading");
  const before = m.frame().scene;
  m.openInterrupt("damage");
  m.closeInterrupt();
  assert.deepEqual(m.frame().scene, before);
  assert.equal(m.snapshot().interrupt, null);
});

test("progression clears an open interrupt rather than stranding it", () => {
  const m = to(run(), "loading");
  m.openInterrupt("detention");
  m.next();
  assert.equal(m.snapshot().interrupt, null);
  assert.equal(m.snapshot().step, "loaded");
});

// --- §27: reconstructible from state, not from a mounted component ---

test("a scenario rebuilt from a snapshot is indistinguishable", () => {
  const a = to(run(), "linehaul");
  a.minimize();
  const rebuilt = run(a.snapshot());          // simulates process death + relaunch
  assert.deepEqual(rebuilt.frame(), a.frame());
  assert.deepEqual(rebuilt.snapshot(), a.snapshot());
});

test("a reconstructed frame carries no transition announcement", () => {
  // Cold remount must not re-announce "Loaded!" merely because a component mounted.
  const m = to(run(), "linehaul");
  m.minimize();
  assert.equal(m.frame().transition?.announcement, undefined,
    "minimized/reconstructed frames stay silent");
});

// --- map framing accounts for surface posture ---

test("minimizing reframes the map because occlusion changed", () => {
  const m = to(run(), "linehaul");
  const open = resolveOcclusion(undefined, m.frame().scene.surfaces, env).bottom;
  m.minimize();
  const collapsed = resolveOcclusion(undefined, m.frame().scene.surfaces, env).bottom;
  assert.ok(collapsed < open, `peek must occlude less than sheet: ${collapsed} < ${open}`);
});

// --- dominant action ---

test("no step offers two competing primary actions", () => {
  for (const s of freightHappyPath.order) {
    const surfaces = Object.values(freightHappyPath.steps[s].frame.scene.surfaces);
    const primary = surfaces.filter((x) => x.emphasis === "primary");
    assert.ok(primary.length <= 1, `${s} has ${primary.length} primary surfaces`);
  }
});

test("every live step is genuinely long-running work", () => {
  // A 12-hour lane must be minimizable; a terminal step must not be.
  assert.ok(freightHappyPath.live!.includes("linehaul"));
  assert.ok(!freightHappyPath.live!.includes("complete"));
  assert.ok(!freightHappyPath.live!.includes("assigned"));
});
