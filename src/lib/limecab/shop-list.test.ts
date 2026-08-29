import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeShopList,
  parseShopList,
  serializeShopList,
  shopListSchema,
  shopListSummary,
  shopListUnitCount,
  SHOP_LIST_MAX,
  SHOP_QTY_MAX,
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

test("qty of one is omitted on the wire", () => {
  assert.deepEqual(normalizeShopList([{ label: "Milk", qty: 1 }]), [
    { label: "Milk" },
  ]);
});

test("qty above one is kept and clamped", () => {
  assert.deepEqual(normalizeShopList([{ label: "Milk", qty: 2 }]), [
    { label: "Milk", qty: 2 },
  ]);
  const [item] = normalizeShopList([{ label: "Milk", qty: 99 }]);
  assert.equal(item!.qty, SHOP_QTY_MAX);
});

test("a missing qty still parses; zero does not", () => {
  assert.equal(shopListSchema.safeParse([{ label: "Milk" }]).success, true);
  assert.equal(
    shopListSchema.safeParse([{ label: "Milk", qty: 2 }]).success,
    true,
  );
  assert.equal(
    shopListSchema.safeParse([{ label: "Milk", qty: 0 }]).success,
    false,
  );
});

test("summary prefixes qty when it is more than one", () => {
  assert.equal(
    shopListSummary([{ label: "Milk", qty: 2 }, { label: "Bananas" }]),
    "2× Milk, Bananas",
  );
});

test("unit count sums qty and treats a missing qty as one", () => {
  assert.equal(
    shopListUnitCount([{ label: "Milk", qty: 2 }, { label: "Bananas" }]),
    3,
  );
  assert.equal(shopListUnitCount([{ label: "Milk" }]), 1);
});
