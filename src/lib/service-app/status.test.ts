import test from "node:test";
import assert from "node:assert/strict";

import {
  formatEtaMetric,
  formatRemainingMetric,
  formatTypicalMetric,
  glanceLabel,
  serviceStatusView,
} from "./status.ts";

test("ETA metric is at most two digits, floored, no unit", () => {
  assert.deepEqual(formatEtaMetric(5), { value: "5" });
  assert.deepEqual(formatEtaMetric(5.9), { value: "5" });
  assert.deepEqual(formatEtaMetric(18), { value: "18" });
  assert.deepEqual(formatEtaMetric(0), { value: "0" });
  assert.equal(formatEtaMetric(18).value.length <= 2, true);
  assert.equal(formatEtaMetric(5).value.includes("$"), false);
  assert.equal(glanceLabel(formatEtaMetric(18)), "18 seconds");
});

test("matching wait is the same ticker, never a typical sentence", () => {
  assert.deepEqual(formatTypicalMetric(8), { value: "8" });
  assert.deepEqual(formatTypicalMetric(8.2), { value: "8" });
  assert.equal(glanceLabel(formatTypicalMetric(8)).includes("Usually"), false);
});

test("remaining metric is the same ticker, never remaining copy", () => {
  assert.deepEqual(formatRemainingMetric(6), { value: "6" });
  assert.deepEqual(formatRemainingMetric(20.4), { value: "20" });
});

test("matching view puts the ticker in the tile, not a sentence", () => {
  const view = serviceStatusView({ state: "matching", typicalSeconds: 8 });
  assert.deepEqual(view.estimate, { value: "8" });
  assert.equal(
    view.estimate && glanceLabel(view.estimate).includes("Usually"),
    false,
  );
});

test("a zero ticker is omitted — zero is the scene change", () => {
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
  assert.deepEqual(view.estimate, { value: "12" });
  assert.equal(view.detail.includes("map"), false);
});

test("in-car remaining is the ticker, not a caption", () => {
  const view = serviceStatusView({
    state: "active",
    completedSteps: 2,
    totalSteps: 4,
    remainingSeconds: 20,
  });
  assert.deepEqual(view.estimate, { value: "20" });
});
