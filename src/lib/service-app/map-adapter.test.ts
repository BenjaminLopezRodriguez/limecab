import test from "node:test";
import assert from "node:assert/strict";

import {
  panCenter,
  pointAlongPath,
  pointsFromLineString,
  projectPoint,
  type MapPoint,
} from "./map-adapter.ts";

const downtown: MapPoint = { latitude: 34.05, longitude: -118.25 };
const east: MapPoint = { latitude: 34.05, longitude: -118.24 };
const north: MapPoint = { latitude: 34.06, longitude: -118.24 };

test("panning the canvas east moves the center west", () => {
  const next = panCenter(downtown, 10, 0, 6);
  assert.ok(next.longitude < downtown.longitude);
  assert.equal(next.latitude, downtown.latitude);
});

test("a pan then project of the old center lands at the drag offset", () => {
  const meters = 6;
  const dx = 12;
  const dy = -8;
  const next = panCenter(downtown, dx, dy, meters);
  const at = projectPoint(next, downtown, meters);
  assert.ok(Math.abs(at.x - (100 + dx)) < 0.05);
  assert.ok(Math.abs(at.y - (100 + dy)) < 0.05);
});

test("pointsFromLineString reads Mapbox GeoJSON order (lng, lat)", () => {
  const points = pointsFromLineString({
    coordinates: [
      [-118.25, 34.05],
      [-118.24, 34.05],
    ],
  });
  assert.equal(points[0]?.longitude, -118.25);
  assert.equal(points[0]?.latitude, 34.05);
  assert.equal(points.length, 2);
});

test("pointAlongPath at 0 and 1 is the ends of the path", () => {
  const path = [downtown, east, north];
  assert.deepEqual(pointAlongPath(path, 0), downtown);
  assert.equal(pointAlongPath(path, 1).latitude, north.latitude);
  assert.equal(pointAlongPath(path, 1).longitude, north.longitude);
});

test("pointAlongPath at 0.5 sits between the ends", () => {
  const path = [downtown, east];
  const mid = pointAlongPath(path, 0.5);
  assert.ok(mid.longitude > downtown.longitude);
  assert.ok(mid.longitude < east.longitude);
});
