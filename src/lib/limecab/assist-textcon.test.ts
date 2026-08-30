import test from "node:test";
import assert from "node:assert/strict";

import { splitAssistMessage } from "./assist-message.ts";
import {
  resolveAssistTextcon,
  textconIdForPlan,
} from "./assist-textcon.ts";

test("splitAssistMessage splits textcon markers", () => {
  const segments = splitAssistMessage(
    "Get {{textcon:flowers}} from {{textcon:shop}} tonight.",
  );
  assert.deepEqual(segments, [
    { type: "text", value: "Get " },
    { type: "textcon", id: "flowers" },
    { type: "text", value: " from " },
    { type: "textcon", id: "shop" },
    { type: "text", value: " tonight." },
  ]);
});

test("splitAssistMessage returns plain text when no markers", () => {
  assert.deepEqual(splitAssistMessage("Hello there."), [
    { type: "text", value: "Hello there." },
  ]);
});

test("splitAssistMessage accepts hyphenated ids", () => {
  const segments = splitAssistMessage("Try {{textcon:shop}} tonight.");
  assert.equal(segments[1]?.type, "textcon");
  if (segments[1]?.type === "textcon") assert.equal(segments[1].id, "shop");
});

test("resolveAssistTextcon maps service and product ids", () => {
  assert.equal(resolveAssistTextcon("shop")?.service, "shop");
  assert.equal(resolveAssistTextcon("flowers")?.service, "shop");
  assert.equal(resolveAssistTextcon("place")?.service, "ride");
  assert.equal(resolveAssistTextcon("nope"), undefined);
});

test("textconIdForPlan uses flowers and service fallbacks", () => {
  assert.equal(
    textconIdForPlan({
      kind: "shop",
      items: [{ label: "flowers" }],
    }),
    "flowers",
  );
  assert.equal(
    textconIdForPlan({
      kind: "ride",
      destination: { address: "LAX" },
    }),
    "place",
  );
  assert.equal(textconIdForPlan({ kind: "help" }), "help");
});
