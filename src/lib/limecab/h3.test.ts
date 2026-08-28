import test from "node:test";
import assert from "node:assert/strict";

import {
  cellDisk,
  cellPolygon,
  cellsToFeatureCollection,
  cellCenter,
  DRIVER_H3_RES,
  SEARCH_H3_RES,
  toDriverCell,
  toSearchCell,
  viewportCells,
} from "./h3.ts";

const DOWNTOWN = { latitude: 34.0505, longitude: -118.2551 };

test("the two jobs use two resolutions", () => {
  assert.equal(DRIVER_H3_RES, 8);
  assert.equal(SEARCH_H3_RES, 9);
  const driver = toDriverCell(DOWNTOWN.latitude, DOWNTOWN.longitude);
  const search = toSearchCell(DOWNTOWN.latitude, DOWNTOWN.longitude);
  assert.match(driver, /^[0-9a-f]+$/);
  assert.match(search, /^[0-9a-f]+$/);
  assert.notEqual(driver, search);
});

test("cellDisk is centre plus rings", () => {
  const cell = toDriverCell(DOWNTOWN.latitude, DOWNTOWN.longitude);
  assert.equal(cellDisk(cell, 0).length, 1);
  assert.equal(cellDisk(cell, 1).length, 7);
  assert.equal(cellDisk(cell, 2).length, 19);
  assert.ok(cellDisk(cell, 2).includes(cell));
  assert.deepEqual(cellDisk("not-a-cell", 2), []);
});

test("cellPolygon emits a closed [lng, lat] ring", () => {
  const cell = toDriverCell(DOWNTOWN.latitude, DOWNTOWN.longitude);
  const polygon = cellPolygon(cell);
  const ring = polygon.coordinates[0]!;
  assert.equal(polygon.type, "Polygon");
  assert.ok(ring.length >= 7);
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  for (const [lng, lat] of ring) {
    // GeoJSON order, not H3's. A swap puts downtown LA in the Atlantic.
    assert.ok(lng! < -117 && lng! > -119, `lng out of range: ${lng}`);
    assert.ok(lat! > 33 && lat! < 35, `lat out of range: ${lat}`);
  }
});

test("cellCenter round-trips back into its own cell", () => {
  const cell = toDriverCell(DOWNTOWN.latitude, DOWNTOWN.longitude);
  const center = cellCenter(cell);
  assert.equal(toDriverCell(center.latitude, center.longitude), cell);
});

test("viewportCells covers the bbox at the driver resolution", () => {
  const cells = viewportCells(-118.28, 34.03, -118.23, 34.07);
  assert.ok(cells.length > 1);
  assert.ok(cells.includes(toDriverCell(34.05, -118.255)));
  // Res 9 is a finer mesh over the same box.
  assert.ok(
    viewportCells(-118.28, 34.03, -118.23, 34.07, SEARCH_H3_RES).length >
      cells.length,
  );
});

test("cellsToFeatureCollection carries emphasis as a property", () => {
  const cell = toDriverCell(DOWNTOWN.latitude, DOWNTOWN.longitude);
  const collection = cellsToFeatureCollection([cell], (index) =>
    index === cell ? { emphasis: "self" } : {},
  );
  assert.equal(collection.type, "FeatureCollection");
  assert.equal(collection.features.length, 1);
  assert.equal(collection.features[0]!.properties?.emphasis, "self");
  assert.equal(collection.features[0]!.geometry.type, "Polygon");
});
