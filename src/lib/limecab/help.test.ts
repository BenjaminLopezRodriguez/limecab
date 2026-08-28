import test from "node:test";
import assert from "node:assert/strict";

import {
  careAckCurrent,
  CARE_RULES,
  CARE_RULES_VERSION,
  helpVisitSlots,
  isCareProduct,
  isHelpProduct,
  withinHelpHours,
} from "./help.ts";

test("Help products are Help; rides, courier and Assist are not", () => {
  assert.equal(isHelpProduct("lime-help"), true);
  assert.equal(isHelpProduct("lime-care"), true);
  assert.equal(isHelpProduct("lime"), false);
  assert.equal(isHelpProduct("courier-small"), false);
  assert.equal(isHelpProduct("assist"), false);
  assert.equal(isHelpProduct(null), false);
  assert.equal(isCareProduct("lime-help"), false);
  assert.equal(isCareProduct("lime-care"), true);
});

test("daytime only — nothing before 8am or after 9pm", () => {
  const at = (h: number, m = 0) => new Date(2026, 7, 28, h, m);
  assert.equal(withinHelpHours(at(7, 30)), false);
  assert.equal(withinHelpHours(at(8)), true);
  assert.equal(withinHelpHours(at(21)), true);
  assert.equal(withinHelpHours(at(21, 30)), false);
  assert.equal(withinHelpHours(at(2)), false);
});

test("a late evening leaves no slots rather than offering an overnight", () => {
  const slots = helpVisitSlots("today", 8, new Date(2026, 7, 28, 22, 10));
  assert.deepEqual(slots, []);
});

test("slots are half-hours inside the window", () => {
  const slots = helpVisitSlots("today", 8, new Date(2026, 7, 28, 9, 5));
  assert.equal(slots.length, 8);
  assert.equal(slots[0]!.getHours(), 9);
  assert.equal(slots[0]!.getMinutes(), 30);
  for (const slot of slots) assert.equal(withinHelpHours(slot), true);
});

test("tomorrow starts in the morning, not overnight", () => {
  const slots = helpVisitSlots("tomorrow", 8, new Date(2026, 7, 28, 22, 10));
  assert.ok(slots.length > 0);
  assert.equal(slots[0]!.getHours(), 8);
  assert.equal(slots[0]!.getDate(), 29);
});

test("Care needs a yes to *these* rules, not an older set", () => {
  assert.equal(careAckCurrent({ careJobs: true, careRulesVersion: CARE_RULES_VERSION }), true);
  assert.equal(careAckCurrent({ careJobs: true, careRulesVersion: "2020-01-01" }), false);
  assert.equal(careAckCurrent({ careJobs: true, careRulesVersion: null }), false);
  assert.equal(careAckCurrent({ careJobs: false, careRulesVersion: CARE_RULES_VERSION }), false);
  assert.equal(careAckCurrent({}), false);
});

test("every rule has a title and a body to acknowledge", () => {
  assert.equal(CARE_RULES.length, 7);
  for (const rule of CARE_RULES) {
    assert.ok(rule.title.length > 0, rule.title);
    assert.ok(rule.body.length > 20, rule.title);
  }
});
