import test from "node:test";
import assert from "node:assert/strict";

import {
  applyAssistPhotoContext,
  assistResponseFromPlans,
  classifyAssistQuery,
  isAssistPhotoShopAsk,
  parseAssistTiming,
  placeFromFixtures,
  planAssistHeuristic,
  scheduledTimeFromQuery,
  shopItemsFromQuery,
  storeFromFixtures,
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

test("hex nuts at Home Depot lands shop with the list and store", () => {
  const planned = planAssistHeuristic(
    "deliver hex nuts from Home Depot now",
  );
  assert.equal(planned.mode, "land");
  assert.equal(planned.plan?.kind, "shop");
  assert.ok(planned.plan?.items?.some((item) => /hex nuts/i.test(item.label)));
  assert.ok(planned.plan?.store?.label?.includes("Home Depot"));
  assert.deepEqual(shopItemsFromQuery("deliver hex nuts from Home Depot now"), [
    { label: "hex nuts" },
  ]);
  assert.ok(storeFromFixtures("buy from Home Depot")?.label?.includes("Home Depot"));
});

test("photo classification fills shop items from closest matching store", () => {
  const planned = applyAssistPhotoContext(
    "deliver hex nuts now",
    planAssistHeuristic("deliver hex nuts now"),
    {
      items: [{ label: "hex nuts" }],
      storeHints: ["hardware store", "home improvement"],
      category: "hardware",
      origin: { latitude: 34.0505, longitude: -118.2551 },
    },
  );
  const shop = planned.suggestions.find((card) => card.plan.kind === "shop")?.plan;
  assert.ok(shop?.items?.some((item) => item.label === "hex nuts"));
  assert.ok(shop?.store?.label?.includes("Home Depot"));
});

test("photo + need more of these stays shop not ride", () => {
  const query = "deliver pencils now: need more of these";
  const planned = applyAssistPhotoContext(query, planAssistHeuristic(query), {
    items: [{ label: "pencils" }],
    storeHints: ["office supply", "general merchandise"],
    category: "home",
    origin: { latitude: 34.0505, longitude: -118.2551 },
  });
  assert.ok(planned.suggestions.every((card) => card.plan.kind === "shop"));
  const shop = planned.suggestions[0]?.plan;
  assert.ok(shop?.items?.some((item) => item.label === "pencils"));
  assert.ok(shop?.store?.label?.includes("Target"));
  assert.match(shop?.subtitle ?? "", /Target/i);
});

test("unclassified photo stamp strips DeepSeek-style ride POIs", () => {
  const query = "buy what is in the photo now: need more of these";
  const rides = assistResponseFromPlans(query, [
    {
      kind: "ride",
      confidence: "low",
      title: "Ride to Need More Yoga",
      subtitle: "Los Angeles",
      destination: {
        address: "Need More Yoga, Los Angeles",
        label: "Need More Yoga",
      },
    },
  ]);
  const planned = applyAssistPhotoContext(query, rides, { hasPhoto: true });
  assert.ok(planned.suggestions.length > 0);
  assert.ok(planned.suggestions.every((card) => card.plan.kind === "shop"));
});

test("isAssistPhotoShopAsk covers photo payload and compose stamp", () => {
  assert.equal(isAssistPhotoShopAsk("need more of these"), false);
  assert.equal(
    isAssistPhotoShopAsk("need more of these", { hasPhoto: true }),
    true,
  );
  assert.equal(
    isAssistPhotoShopAsk("buy what is in the photo now: need more of these"),
    true,
  );
  assert.equal(
    isAssistPhotoShopAsk("hello", { items: [{ label: "pencils" }] }),
    true,
  );
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
