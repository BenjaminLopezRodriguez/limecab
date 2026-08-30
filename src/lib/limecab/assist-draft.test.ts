import test from "node:test";
import assert from "node:assert/strict";

import {
  parseAssistTiming,
  scheduledTimeFromQuery,
} from "./assist.ts";
import {
  shopDeliveryStatusLabel,
  shouldAbortDraftForAssist,
  shouldResetAssistDraft,
} from "./assist-draft.ts";

test("parseAssistTiming distinguishes now vs scheduled shop", () => {
  assert.equal(parseAssistTiming("deliver flowers now"), "now");
  assert.equal(parseAssistTiming("order flowers for tonight"), "scheduled");
  assert.equal(parseAssistTiming("deliver flowers asap"), "now");
});

test("scheduledTimeFromQuery picks an evening slot for tonight", () => {
  const from = new Date("2026-08-30T14:00:00");
  const when = scheduledTimeFromQuery("order flowers for tonight", from);
  assert.ok(when);
  assert.ok(when!.getHours() >= 18);
});

test("scheduledTimeFromQuery picks an evening slot for tonight even in the morning", () => {
  const from = new Date("2026-08-30T02:00:00");
  const when = scheduledTimeFromQuery("order flowers for tonight", from);
  assert.ok(when);
  assert.ok(when!.getHours() >= 18);
});

test("shouldResetAssistDraft on Assist home only", () => {
  assert.equal(
    shouldResetAssistDraft({
      wantAssist: true,
      state: "home",
      rideMinimized: false,
      inAssistSearch: false,
    }),
    true,
  );
  assert.equal(
    shouldResetAssistDraft({
      wantAssist: true,
      state: "location_search",
      rideMinimized: false,
      inAssistSearch: true,
    }),
    false,
  );
  assert.equal(
    shouldResetAssistDraft({
      wantAssist: true,
      state: "quote",
      rideMinimized: false,
      inAssistSearch: false,
    }),
    false,
  );
});

test("shouldAbortDraftForAssist when ribbon opens during draft", () => {
  assert.equal(
    shouldAbortDraftForAssist({
      wantAssist: true,
      state: "quote",
      enteredAssist: true,
    }),
    true,
  );
  assert.equal(
    shouldAbortDraftForAssist({
      wantAssist: true,
      state: "matching",
      enteredAssist: true,
    }),
    false,
  );
});

test("shopDeliveryStatusLabel formats immediate shop copy", () => {
  assert.equal(shopDeliveryStatusLabel(40), "Shop & deliver · ~40 min");
});
