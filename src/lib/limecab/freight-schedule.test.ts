import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clockLabel,
  etaFromDistance,
  haversineMeters,
  proximityBand,
  scheduleStanding,
} from "./freight-schedule.ts";

test("proximity bands separate on the property from near it", () => {
  assert.equal(proximityBand(0), "arrived");
  assert.equal(proximityBand(249), "arrived");
  assert.equal(proximityBand(900), "near");
  assert.equal(proximityBand(5_000), "far");
  // No fix, no band — never a guessed "arrived".
  assert.equal(proximityBand(null), null);
  assert.equal(proximityBand(Number.NaN), null);
});

test("haversine gets Ontario → Phoenix roughly right", () => {
  const meters = haversineMeters(
    { latitude: 34.0633, longitude: -117.6509 },
    { latitude: 33.4484, longitude: -112.074 },
  );
  const miles = meters / 1609.344;
  assert.ok(miles > 300 && miles < 360, `got ${miles} mi`);
});

test("an unknown distance produces no ETA rather than now", () => {
  assert.equal(etaFromDistance(null), null);
  assert.equal(etaFromDistance(-5), null);
  const now = new Date("2026-08-30T12:00:00Z");
  const eta = etaFromDistance(22 * 600, now); // 600s of driving
  assert.equal(eta?.toISOString(), "2026-08-30T12:10:00.000Z");
});

test("standing needs both an appointment and an ETA", () => {
  const at = new Date("2026-08-31T07:00:00Z");
  assert.equal(scheduleStanding(null, at), null);
  assert.equal(scheduleStanding(at, null), null);
  assert.equal(scheduleStanding(at, "not a date"), null);
});

test("early, late, and the five-minute band that is neither", () => {
  const appt = new Date("2026-08-31T07:00:00Z");
  const early = scheduleStanding(appt, new Date("2026-08-31T06:42:00Z"));
  assert.equal(early?.label, "18 min early");
  assert.equal(early?.late, false);

  const late = scheduleStanding(appt, new Date("2026-08-31T07:16:00Z"));
  assert.equal(late?.label, "16 min late");
  assert.equal(late?.late, true);

  const close = scheduleStanding(appt, new Date("2026-08-31T07:03:00Z"));
  assert.equal(close?.label, "on time");

  const hours = scheduleStanding(appt, new Date("2026-08-31T09:20:00Z"));
  assert.equal(hours?.label, "2 hr 20 min late");
});

test("clock label is absent, not fabricated, without a time", () => {
  assert.equal(clockLabel(null), null);
  assert.equal(clockLabel("nope"), null);
  assert.ok(clockLabel(new Date()));
});

test("a whole day out is a calendar, not a schedule", () => {
  const appt = new Date("2026-08-31T07:00:00Z");
  // 19 hr "early" is what a stale seed appointment produces; the sheet must
  // fall back to the plain appointment line rather than print pressure.
  assert.equal(scheduleStanding(appt, new Date("2026-08-30T11:38:00Z")), null);
  assert.equal(scheduleStanding(appt, new Date("2026-09-01T09:00:00Z")), null);
  // Just inside the horizon still reads as a standing.
  assert.ok(scheduleStanding(appt, new Date("2026-08-30T20:00:00Z")));
});
