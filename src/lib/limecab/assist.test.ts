import test from "node:test";
import assert from "node:assert/strict";

import {
  assistResponseFromPlans,
  classifyAssistQuery,
  parseAssistTiming,
  placeFromFixtures,
  planAssistHeuristic,
  scheduledTimeFromQuery,
  shopItemsFromQuery,
} from "./assist.ts";

test("Griffith is a high-confidence ride land", () => {
  const planned = planAssistHeuristic("Griffith");
  assert.equal(planned.mode, "land");
  assert.equal(planned.plan?.kind, "ride");
  assert.ok(planned.plan?.destination?.address.includes("Griffith"));
  assert.match(planned.message, /\{\{textcon:place\}\}/);
});

test("beef seeds a shop list and finds a store", () => {
  const planned = planAssistHeuristic("beef");
  assert.ok(planned.suggestions.some((card) => card.plan.kind === "shop"));
  const shop = planned.suggestions.find((card) => card.plan.kind === "shop")?.plan;
  assert.ok(shop?.items?.some((item) => item.label === "beef"));
  assert.ok(shop?.store?.address);
});

test("send this to work is a courier card", () => {
  const planned = planAssistHeuristic("send this to work");
  assert.ok(planned.suggestions.some((card) => card.plan.kind === "courier"));
});

test("help alone is a high-confidence help land", () => {
  const planned = planAssistHeuristic("help");
  assert.equal(planned.mode, "land");
  assert.equal(planned.plan?.kind, "help");
});

test("send to a known place stays reply when ride is also plausible", () => {
  const classified = classifyAssistQuery("send this to Griffith");
  assert.ok(classified.intents.includes("send"));
  const planned = planAssistHeuristic("send this to Griffith");
  assert.equal(planned.mode, "reply");
  assert.ok(planned.suggestions.some((card) => card.plan.kind === "ride"));
  assert.ok(planned.suggestions.some((card) => card.plan.kind === "courier"));
});

test("shop items parse from a grocery sentence", () => {
  assert.deepEqual(shopItemsFromQuery("buy beef and milk"), [
    { label: "beef" },
    { label: "milk" },
  ]);
});

test("fixtures resolve LAX and leave unknown queries empty", () => {
  assert.ok(placeFromFixtures("LAX")?.address.includes("LAX"));
  assert.equal(placeFromFixtures("zzzz"), null);
});

test("order flowers for tonight is a scheduled shop among spanning chips", () => {
  const planned = planAssistHeuristic("order flowers for tonight");
  assert.equal(planned.mode, "reply");
  const shop = planned.suggestions.find((card) => card.plan.kind === "shop")?.plan;
  assert.equal(shop?.timing, "scheduled");
  assert.ok(shop?.items?.some((item) => item.label === "flowers"));
  assert.ok(planned.suggestions.some((card) => card.plan.kind === "ride"));
  assert.ok(planned.suggestions.some((card) => card.plan.kind === "courier"));
  assert.match(planned.message, /\{\{textcon:shop\}\}/);
  assert.ok(scheduledTimeFromQuery("order flowers for tonight"));
});

test("deliver flowers now keeps immediate shop timing", () => {
  const planned = planAssistHeuristic("deliver flowers now");
  const shop = planned.suggestions.find((card) => card.plan.kind === "shop")?.plan;
  assert.equal(shop?.timing, "now");
  assert.ok(shop?.items?.length);
});

test("a single high-confidence plan lands; two plans stay reply", () => {
  const land = assistResponseFromPlans("Griffith", [
    {
      kind: "ride",
      confidence: "high",
      title: "Ride to Griffith",
      destination: { address: "Griffith Observatory, Los Angeles" },
    },
  ]);
  assert.equal(land.mode, "land");
  const cards = assistResponseFromPlans("beef", [
    {
      kind: "ride",
      confidence: "low",
      title: "Ride",
    },
    {
      kind: "shop",
      confidence: "high",
      title: "Shop for beef",
      items: [{ label: "beef" }],
    },
  ]);
  assert.equal(cards.mode, "reply");
  assert.equal(cards.suggestions.length, 2);
  assert.equal(cards.cards.length, 2);
});

test("parseAssistTiming distinguishes now and later", () => {
  assert.equal(parseAssistTiming("deliver flowers now"), "now");
  assert.equal(parseAssistTiming("order flowers for tonight"), "scheduled");
  assert.equal(parseAssistTiming("flowers for later"), "scheduled");
});

test("help me move a couch spans help and courier", () => {
  const classified = classifyAssistQuery("help me move a couch");
  assert.ok(classified.intents.includes("help"));
  const planned = planAssistHeuristic("help me move a couch");
  assert.equal(planned.mode, "reply");
  assert.ok(planned.suggestions.some((card) => card.plan.kind === "help"));
  assert.ok(planned.suggestions.some((card) => card.plan.kind === "courier"));
  assert.match(planned.message, /\{\{textcon:help\}\}/);
});
