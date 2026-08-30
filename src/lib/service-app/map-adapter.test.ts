import test from "node:test";
import assert from "node:assert/strict";

import {
  bearingDegrees,
  boundsForPoints,
  boundsToFitCorners,
  expandBoundsToSpan,
  mapMarkerAnchor,
  panCenter,
  pointAlongPath,
  pointsFromLineString,
  projectPoint,
  tracksProvider,
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
  const start = pointAlongPath(path, 0);
  const end = pointAlongPath(path, 1);
  assert.equal(start.latitude, downtown.latitude);
  assert.equal(start.longitude, downtown.longitude);
  assert.equal(end.latitude, north.latitude);
  assert.equal(end.longitude, north.longitude);
});

test("pointAlongPath at 0.5 sits between the ends", () => {
  const path = [downtown, east];
  const mid = pointAlongPath(path, 0.5);
  assert.ok(mid.longitude > downtown.longitude);
  assert.ok(mid.longitude < east.longitude);
});

test("bearingDegrees points east along a same-latitude pair", () => {
  const heading = bearingDegrees(downtown, east);
  assert.ok(heading > 80 && heading < 100);
});

test("boundsForPoints frames a cluster, then expand fills a single pin", () => {
  const box = boundsForPoints([downtown, east]);
  assert.ok(box);
  assert.equal(box.west, downtown.longitude);
  assert.equal(box.east, east.longitude);
  const pin = boundsForPoints([downtown]);
  assert.ok(pin);
  const filled = expandBoundsToSpan(pin, 80);
  assert.ok(filled.east - filled.west > pin.east - pin.west);
  const corners = boundsToFitCorners(filled);
  assert.equal(corners[0][0], filled.west);
  assert.equal(corners[1][1], filled.north);
});

test("tracksProvider is the live vehicle modes, not the preview", () => {
  assert.equal(tracksProvider("provider_arrival"), true);
  assert.equal(tracksProvider("active_route"), true);
  assert.equal(tracksProvider("route_preview"), false);
  assert.equal(tracksProvider("results"), false);
});

test("needle pins attach at the tip; pucks and cars attach at the center", () => {
  const origin: MapPoint = { ...downtown, kind: "origin", label: "Main St" };
  const drop: MapPoint = { ...east, kind: "destination", label: "Union Station" };
  const selected: MapPoint = {
    ...north,
    kind: "pickup",
    label: "Front",
    selected: true,
  };
  const alternate: MapPoint = { ...north, kind: "pickup", label: "Side" };
  const car: MapPoint = { ...downtown, kind: "provider" };

  assert.equal(mapMarkerAnchor(origin, "home"), "center");
  assert.equal(mapMarkerAnchor(origin, "route_preview"), "bottom");
  assert.equal(mapMarkerAnchor(drop, "route_preview"), "bottom");
  assert.equal(mapMarkerAnchor(selected, "select_location"), "bottom");
  assert.equal(mapMarkerAnchor(alternate, "select_location"), "center");
  assert.equal(mapMarkerAnchor(car, "provider_arrival"), "center");
});
