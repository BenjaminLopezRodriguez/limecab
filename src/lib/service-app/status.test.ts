import test from "node:test";
import assert from "node:assert/strict";

import {
  formatEtaMetric,
  formatRemainingMetric,
  formatTypicalMetric,
  glanceLabel,
  isTimeCounterOverflow,
  serviceStatusView,
  TIME_COUNTER_MAX,
} from "./status.ts";

test("ETA metric is at most two digits, floored, no price", () => {
  assert.deepEqual(formatEtaMetric(5), { value: "5", unit: "sec" });
  assert.deepEqual(formatEtaMetric(5.9), { value: "5", unit: "sec" });
  assert.deepEqual(formatEtaMetric(18), { value: "18", unit: "sec" });
  assert.deepEqual(formatEtaMetric(0), { value: "0", unit: "sec" });
  assert.equal(formatEtaMetric(18).value.length <= 2, true);
  assert.equal(formatEtaMetric(5).value.includes("$"), false);
  assert.equal(glanceLabel(formatEtaMetric(18)), "18 seconds");
});

test("from 100 seconds up the tile counts floored minutes", () => {
  assert.deepEqual(formatEtaMetric(60), { value: "60", unit: "sec" });
  assert.deepEqual(formatEtaMetric(99), { value: "99", unit: "sec" });
  assert.deepEqual(formatEtaMetric(125), { value: "2", unit: "min" });
  assert.equal(glanceLabel(formatEtaMetric(125)), "2 minutes");
});

test("past 99 minutes is overflow, not a clamped tile", () => {
  assert.equal(isTimeCounterOverflow(TIME_COUNTER_MAX * 60), false);
  assert.equal(isTimeCounterOverflow(TIME_COUNTER_MAX * 60 + 60), true);
});

test("matching wait is the same ticker, never a typical sentence", () => {
  assert.deepEqual(formatTypicalMetric(8), { value: "8", unit: "sec" });
  assert.deepEqual(formatTypicalMetric(8.2), { value: "8", unit: "sec" });
  assert.equal(glanceLabel(formatTypicalMetric(8)).includes("Usually"), false);
});

test("remaining metric is the same ticker, never remaining copy", () => {
  assert.deepEqual(formatRemainingMetric(6), { value: "6", unit: "sec" });
  assert.deepEqual(formatRemainingMetric(20.4), { value: "20", unit: "sec" });
});

test("matching view is an eta countdown, never a typical sentence", () => {
  const atZero = serviceStatusView({ state: "matching", typicalSeconds: 0 });
  assert.equal(atZero.estimate, null);
  const later = serviceStatusView({ state: "matching", typicalSeconds: 8 });
  assert.deepEqual(later.estimate, { value: "8", unit: "sec" });
  assert.equal(
    later.estimate && glanceLabel(later.estimate).includes("Usually"),
    false,
  );
});

test("a zero ticker is omitted on countdown scenes — zero is the scene change", () => {
  const view = serviceStatusView({
    state: "provider_en_route",
    providerName: "Maya",
    etaSeconds: 0,
  });
  assert.equal(view.estimate, null);
});

test("arriving has no ticker — the countdown already ended", () => {
  const view = serviceStatusView({ state: "arriving", providerName: "Maya" });
  assert.equal(view.estimate, null);
  assert.equal(view.detail, "They're outside");
});

test("en route callout is the same floored number, not a rounded label", () => {
  const view = serviceStatusView({
    state: "provider_en_route",
    providerName: "Maya",
    etaSeconds: 12.9,
  });
  assert.equal(view.callout, "12");
  assert.deepEqual(view.estimate, { value: "12", unit: "sec" });
  assert.equal(view.detail.includes("map"), false);
});

test("in-car remaining is the ticker, not a caption", () => {
  const view = serviceStatusView({
    state: "active",
    completedSteps: 2,
    totalSteps: 4,
    remainingSeconds: 20,
  });
  assert.deepEqual(view.estimate, { value: "20", unit: "sec" });
});
