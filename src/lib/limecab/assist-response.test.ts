import test from "node:test";
import assert from "node:assert/strict";

import {
  assistResponseFromPlans,
  planAssistHeuristic,
  reconcileAssistResponse,
} from "./assist.ts";

test("ambiguous flowers returns message and multi-service suggestions", () => {
  const planned = planAssistHeuristic("flowers");
  assert.ok(planned.message);
  assert.match(planned.message, /\{\{textcon:shop\}\}/);
  assert.match(planned.message, /\{\{textcon:ride\}\}/);
  assert.equal(planned.mode, "reply");
  assert.ok(planned.suggestions.length >= 2);
  assert.ok(planned.suggestions.some((option) => option.plan.kind === "shop"));
  assert.ok(planned.suggestions.some((option) => option.plan.kind === "ride"));
  const shop = planned.suggestions.find((option) => option.plan.kind === "shop");
  assert.equal(shop?.plan.timing, "scheduled");
});

test("assistResponseFromPlans includes message and textcons with service", () => {
  const response = assistResponseFromPlans("beef", [
    {
      kind: "shop",
      confidence: "high",
      title: "Deliver beef",
      items: [{ label: "beef" }],
      store: { address: "Vons", label: "Vons" },
    },
    {
      kind: "ride",
      confidence: "low",
      title: "Ride",
    },
  ]);
  assert.ok(response.message);
  assert.equal(response.suggestions.length, 2);
  assert.ok(response.textcons?.length);
  assert.ok(response.textcons?.every((ref) => ref.service));
  assert.equal(response.mode, "reply");
});

test("single ride plan gets conversational message with place textcon", () => {
  const response = assistResponseFromPlans("Griffith", [
    {
      kind: "ride",
      confidence: "high",
      title: "Ride to Griffith",
      destination: {
        address: "Griffith Observatory, Los Angeles",
        label: "Griffith",
      },
    },
  ]);
  assert.match(response.message, /\{\{textcon:place\}\}/);
  assert.equal(response.suggestions.length, 1);
});

test("reconcileAssistResponse restores a mosaic when the model under-spans", () => {
  const model = assistResponseFromPlans("help me move a couch", [
    {
      kind: "help",
      confidence: "high",
      title: "Move couch",
      subtitle: "A helper comes here",
    },
  ]);
  assert.equal(model.mode, "land");
  const reconciled = reconcileAssistResponse("help me move a couch", model);
  assert.equal(reconciled.mode, "reply");
  assert.ok(reconciled.suggestions.some((entry) => entry.plan.kind === "help"));
  assert.ok(
    reconciled.suggestions.some((entry) => entry.plan.kind === "courier"),
  );
});

test("reconcileAssistResponse stamps shop timing from the query", () => {
  const base = planAssistHeuristic("order flowers for tonight");
  const skewed = {
    ...base,
    suggestions: base.suggestions.map((entry) =>
      entry.plan.kind === "shop"
        ? {
            ...entry,
            plan: { ...entry.plan, title: "Order flowers for 12:00 pm" },
          }
        : entry,
    ),
  };
  skewed.cards = skewed.suggestions;
  const reconciled = reconcileAssistResponse(
    "order flowers for tonight",
    skewed,
  );
  const shop = reconciled.suggestions.find(
    (entry) => entry.plan.kind === "shop",
  );
  assert.equal(shop?.plan.timing, "scheduled");
  assert.notEqual(shop?.plan.title, "Order flowers for 12:00 pm");
});
