import test from "node:test";
import assert from "node:assert/strict";

import {
  SHEET_DISMISS_SNAP,
  SHEET_EXPANDED_SNAP,
  SHEET_OVERLAY_SNAP,
  SHEET_PEEK_SNAP,
  SHEET_SNAP,
  sheetContentOverflows,
  sheetInnerScrolls,
  sheetSnapPoints,
} from "./sheet-interaction.ts";

test("overflow is a real clip, not a rounding wiggle", () => {
  assert.equal(sheetContentOverflows(400, 400), false);
  assert.equal(sheetContentOverflows(408, 400), false);
  assert.equal(sheetContentOverflows(409, 400), true);
});

test("inner scroll stays locked until overlay", () => {
  assert.equal(sheetInnerScrolls(SHEET_PEEK_SNAP), false);
  assert.equal(sheetInnerScrolls(SHEET_SNAP), false);
  assert.equal(sheetInnerScrolls(SHEET_EXPANDED_SNAP), false);
  assert.equal(sheetInnerScrolls(SHEET_OVERLAY_SNAP), true);
});

test("fitting content cannot reach overlay", () => {
  assert.deepEqual(sheetSnapPoints({ presentation: "sheet", overlay: false }), [
    SHEET_PEEK_SNAP,
    SHEET_SNAP,
    SHEET_EXPANDED_SNAP,
  ]);
});

test("overflowing content adds overlay as the top snap", () => {
  assert.deepEqual(sheetSnapPoints({ presentation: "sheet", overlay: true }), [
    SHEET_PEEK_SNAP,
    SHEET_SNAP,
    SHEET_EXPANDED_SNAP,
    SHEET_OVERLAY_SNAP,
  ]);
});

test("dismiss is a snap below sheet, never below peek", () => {
  assert.deepEqual(
    sheetSnapPoints({ presentation: "sheet", overlay: true, dismiss: true }),
    [
      SHEET_DISMISS_SNAP,
      SHEET_PEEK_SNAP,
      SHEET_SNAP,
      SHEET_EXPANDED_SNAP,
      SHEET_OVERLAY_SNAP,
    ],
  );
  assert.deepEqual(
    sheetSnapPoints({ presentation: "peek", overlay: false, dismiss: true }),
    [SHEET_PEEK_SNAP, SHEET_SNAP, SHEET_EXPANDED_SNAP],
  );
});

test("an overlay scene is already at the overflow destination", () => {
  assert.deepEqual(
    sheetSnapPoints({ presentation: "overlay", overlay: true, dismiss: true }),
    [SHEET_DISMISS_SNAP, SHEET_OVERLAY_SNAP],
  );
});
