import test from "node:test";
import assert from "node:assert/strict";

import { cellToParent, latLngToCell } from "h3-js";

import {
  K_MAX,
  R10,
  R11,
  R5,
  R7,
  R8,
  R9,
  cellCenter,
  coverageCell,
  distanceMeters,
  expandDisk,
  kForDistance,
  lookupCell,
  toCellHierarchy,
  toParent,
} from "./cells.ts";

const ROSEMEAD = { latitude: 34.0806, longitude: -118.0728 };

test("a point resolves to all six resolutions", () => {
  const cells = toCellHierarchy(ROSEMEAD.latitude, ROSEMEAD.longitude);
  assert.equal(cells.h3R5, latLngToCell(ROSEMEAD.latitude, ROSEMEAD.longitude, R5));
  assert.equal(cells.h3R7, latLngToCell(ROSEMEAD.latitude, ROSEMEAD.longitude, R7));
  assert.equal(cells.h3R8, latLngToCell(ROSEMEAD.latitude, ROSEMEAD.longitude, R8));
  assert.equal(cells.h3R9, latLngToCell(ROSEMEAD.latitude, ROSEMEAD.longitude, R9));
  assert.equal(cells.h3R10, latLngToCell(ROSEMEAD.latitude, ROSEMEAD.longitude, R10));
  assert.equal(cells.h3R11, latLngToCell(ROSEMEAD.latitude, ROSEMEAD.longitude, R11));
  assert.equal(new Set(Object.values(cells)).size, 6);
});

test("the hierarchy is a real parent chain", () => {
  // From a cell's own centre, so the chain is exact — near an r9 boundary the
  // point's r8 cell and its r9 cell's parent legitimately differ, which is
  // one more reason cells are candidate geography and never distance.
  const centre = cellCenter(coverageCell(ROSEMEAD.latitude, ROSEMEAD.longitude));
  const cells = toCellHierarchy(centre.latitude, centre.longitude);
  assert.equal(cellToParent(cells.h3R9, R8), cells.h3R8);
  assert.equal(cellToParent(cells.h3R10, R9), cells.h3R9);
  assert.equal(cellToParent(cells.h3R11, R10), cells.h3R10);
  assert.equal(cellToParent(cells.h3R8, R7), cells.h3R7);
  assert.equal(toParent(cells.h3R9, R8), cells.h3R8);
});

test("coverage is r8 and lookup is r9", () => {
  const cells = toCellHierarchy(ROSEMEAD.latitude, ROSEMEAD.longitude);
  assert.equal(coverageCell(ROSEMEAD.latitude, ROSEMEAD.longitude), cells.h3R8);
  assert.equal(lookupCell(ROSEMEAD.latitude, ROSEMEAD.longitude), cells.h3R9);
});

test("ring expansion is bounded", () => {
  const cell = lookupCell(ROSEMEAD.latitude, ROSEMEAD.longitude);
  assert.equal(expandDisk(cell, 0).length, 1);
  assert.equal(expandDisk(cell, 1).length, 7);
  assert.equal(expandDisk(cell, 2).length, 19);
  // Past the cap the disk stops growing, whatever the caller asks for.
  assert.equal(expandDisk(cell, 99).length, expandDisk(cell, K_MAX).length);
  assert.deepEqual(expandDisk("not-a-cell", 2), []);
});

test("k is derived from the distance budget and still capped", () => {
  assert.equal(kForDistance(100), 1);
  assert.equal(kForDistance(600), 3);
  assert.equal(kForDistance(50_000), K_MAX);
  assert.equal(kForDistance(undefined), K_MAX);
});

test("cellCenter round-trips into its own cell", () => {
  const cell = coverageCell(ROSEMEAD.latitude, ROSEMEAD.longitude);
  const centre = cellCenter(cell);
  assert.equal(coverageCell(centre.latitude, centre.longitude), cell);
});

test("distance is haversine metres, not cell arithmetic", () => {
  assert.equal(
    Math.round(distanceMeters(ROSEMEAD.latitude, ROSEMEAD.longitude, ROSEMEAD.latitude, ROSEMEAD.longitude)),
    0,
  );
  const oneKmNorth = distanceMeters(
    ROSEMEAD.latitude,
    ROSEMEAD.longitude,
    ROSEMEAD.latitude + 0.009,
    ROSEMEAD.longitude,
  );
  assert.ok(oneKmNorth > 950 && oneKmNorth < 1050, `got ${oneKmNorth}`);
});
