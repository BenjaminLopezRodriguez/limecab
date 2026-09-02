import { test } from "node:test";
import assert from "node:assert/strict";

import { ladderFor, resolveSnap, fractionOf } from "../src/native/snap.ts";

/**
 * The rules these cover are product semantics lifted from `service-sheet.tsx`, not native
 * tuning. If web changes which rungs a sheet may reach, these fail — which is the point.
 */

const VIEWPORT = 874;
const still = (translation: number) => ({ translation, velocity: 0, viewportHeight: VIEWPORT });

test("every sheet can be dragged across the whole ladder, as on web", () => {
  assert.deepEqual(ladderFor({ presentation: "sheet", canDismiss: false }), [
    "peek",
    "sheet",
    "expanded",
    "overlay",
  ]);
});

test("a peek never dismisses — a short flick must not leave the task", () => {
  const ladder = ladderFor({ presentation: "peek", canDismiss: true });
  assert.ok(!ladder.includes("dismiss"));
  // Even a hard downward fling stays on the ladder.
  assert.notEqual(
    resolveSnap({ presentation: "peek", canDismiss: true }, { translation: 400, velocity: 2000, viewportHeight: VIEWPORT }),
    "dismiss",
  );
});

test("dismissal exists only where the caller gave it meaning", () => {
  assert.ok(ladderFor({ presentation: "sheet", canDismiss: true }).includes("dismiss"));
  assert.ok(!ladderFor({ presentation: "sheet", canDismiss: false }).includes("dismiss"));
});

test("capping the ladder removes overlay, as overlaySnap={false} does on web", () => {
  assert.deepEqual(ladderFor({ presentation: "sheet", canDismiss: false, allowOverlay: false }), [
    "peek",
    "sheet",
    "expanded",
  ]);
});

test("an interrupt has no ladder — it is a question, not a resizable sheet", () => {
  assert.deepEqual(ladderFor({ presentation: "compact-interrupt", canDismiss: true }), []);
  assert.equal(resolveSnap({ presentation: "compact-interrupt", canDismiss: true }, still(200)), null);
});

test("overlay is locked to its own rung, as OVERLAY_POINTS is on web", () => {
  assert.deepEqual(ladderFor({ presentation: "overlay", canDismiss: false }), ["overlay"]);
  assert.equal(resolveSnap({ presentation: "overlay", canDismiss: false }, still(300)), null);
});

test("a small drag settles back onto the rung it started from", () => {
  assert.equal(resolveSnap({ presentation: "sheet", canDismiss: true }, still(20)), "sheet");
});

test("a deliberate drag down steps one rung, not straight out of the task", () => {
  const destination = resolveSnap({ presentation: "expanded", canDismiss: true }, still(0.18 * VIEWPORT));
  assert.equal(destination, "sheet");
});

test("dragging up climbs the ladder", () => {
  assert.equal(resolveSnap({ presentation: "peek", canDismiss: false }, still(-0.18 * VIEWPORT)), "sheet");
  assert.equal(resolveSnap({ presentation: "sheet", canDismiss: false }, still(-0.30 * VIEWPORT)), "expanded");
  assert.equal(resolveSnap({ presentation: "sheet", canDismiss: false }, still(-0.50 * VIEWPORT)), "overlay");
});

test("a fling carries past the rungs the finger reached", () => {
  const gentle = { translation: 60, velocity: 0, viewportHeight: VIEWPORT };
  const flung = { translation: 60, velocity: 2600, viewportHeight: VIEWPORT };
  assert.equal(resolveSnap({ presentation: "expanded", canDismiss: true }, gentle), "expanded");
  // Same finger travel, thrown: it crosses two rungs the finger never reached.
  assert.equal(resolveSnap({ presentation: "expanded", canDismiss: true }, flung), "peek");
});

test("leaving the task takes a decisive drag, not a flick", () => {
  const flick = { translation: 40, velocity: 900, viewportHeight: VIEWPORT };
  const decisive = { translation: 280, velocity: 1800, viewportHeight: VIEWPORT };
  assert.notEqual(resolveSnap({ presentation: "sheet", canDismiss: true }, flick), "dismiss");
  assert.equal(resolveSnap({ presentation: "sheet", canDismiss: true }, decisive), "dismiss");
});

test("dismissal sits at the floor of the ladder", () => {
  assert.equal(fractionOf("dismiss"), 0);
});
