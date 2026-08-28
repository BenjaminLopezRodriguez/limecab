import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeShopList,
  parseShopList,
  serializeShopList,
  shopListSchema,
  shopListSummary,
  SHOP_LIST_MAX,
} from "./shop-list.ts";

test("normalize drops blank labels and trims", () => {
  assert.deepEqual(
    normalizeShopList([
      { label: "  Oat milk  ", note: "  any brand  " },
      { label: "   " },
      { label: "Bananas" },
    ]),
    [{ label: "Oat milk", note: "any brand" }, { label: "Bananas" }],
  );
});

test("normalize caps the list at twelve", () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ label: `Item ${i}` }));
  assert.equal(normalizeShopList(rows).length, SHOP_LIST_MAX);
});

test("normalize truncates an over-long label", () => {
  const [item] = normalizeShopList([{ label: "x".repeat(200) }]);
  assert.equal(item!.label.length, 80);
});

test("a round trip through the column keeps the list", () => {
  const items = [{ label: "Bread", note: "sourdough" }, { label: "Eggs" }];
  assert.deepEqual(parseShopList(serializeShopList(items)), items);
});

test("a missing or malformed column is no list, not a throw", () => {
  assert.deepEqual(parseShopList(null), []);
  assert.deepEqual(parseShopList("not json"), []);
  assert.deepEqual(parseShopList("[]"), []);
  assert.deepEqual(parseShopList('[{"label":""}]'), []);
});

test("the wire schema refuses an empty list and an over-long one", () => {
  assert.equal(shopListSchema.safeParse([]).success, false);
  assert.equal(
    shopListSchema.safeParse(
      Array.from({ length: 13 }, () => ({ label: "x" })),
    ).success,
    false,
  );
  assert.equal(shopListSchema.safeParse([{ label: "Milk" }]).success, true);
});

test("summary shows three then counts the rest", () => {
  const items = ["a", "b", "c", "d", "e"].map((label) => ({ label }));
  assert.equal(shopListSummary(items), "a, b, c and 2 more");
  assert.equal(shopListSummary(items.slice(0, 2)), "a, b");
  assert.equal(shopListSummary([]), "");
});
