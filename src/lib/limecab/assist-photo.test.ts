import test from "node:test";
import assert from "node:assert/strict";

import {
  assistQueryFromPhoto,
  classifyPhotoFilename,
  composeShopQuery,
  normalizePhotoClassification,
  shopItemsFromPhoto,
} from "./assist-photo.ts";

test("composeShopQuery names the item and a hardware store", () => {
  assert.equal(
    composeShopQuery([{ label: "hex nuts" }], ["Home Depot", "Lowe's"]),
    "deliver hex nuts from Home Depot now",
  );
  assert.equal(composeShopQuery([{ label: "milk" }]), "deliver milk now");
  assert.equal(composeShopQuery([], ["Home Depot"]), "buy from Home Depot now");
});

test("filename nut/hardware classifies as hardware for Home Depot", () => {
  const nut = classifyPhotoFilename("nut.jpg");
  assert.equal(nut?.category, "hardware");
  assert.ok(nut?.storeHints.includes("Home Depot"));
  assert.ok(nut?.items.some((item) => /nut/i.test(item.label)));
  assert.match(nut?.query ?? "", /Home Depot/i);

  const hex = classifyPhotoFilename("hex-nut.png");
  assert.equal(hex?.items[0]?.label, "hex nuts");

  assert.equal(classifyPhotoFilename("doughnut.jpg"), null);
  assert.equal(classifyPhotoFilename("IMG_1234.jpg"), null);
});

test("filename pencil/stationery classifies as home for Target", () => {
  const pencil = classifyPhotoFilename(
    "pngtree-pencil-with-orange-body-png-image_21226753.png",
  );
  assert.equal(pencil?.category, "home");
  assert.equal(pencil?.items[0]?.label, "pencils");
  assert.ok(pencil?.storeHints.includes("Target"));
  assert.match(pencil?.query ?? "", /pencils/i);
  assert.match(pencil?.query ?? "", /Target/i);

  const pens = classifyPhotoFilename("blue-pens.jpg");
  assert.equal(pens?.items[0]?.label, "pens");
});

test("assistQueryFromPhoto adds now when the model omitted timing", () => {
  assert.equal(
    assistQueryFromPhoto({
      category: "hardware",
      query: "buy hex nuts at Home Depot",
      items: [{ label: "hex nuts" }],
      storeHints: ["Home Depot"],
      source: "model",
    }),
    "buy hex nuts at Home Depot now",
  );
});

test("normalizePhotoClassification fills Home Depot for hardware", () => {
  const classified = normalizePhotoClassification({
    category: "hardware",
    items: ["hex nuts"],
  });
  assert.equal(classified?.category, "hardware");
  assert.deepEqual(classified?.items, [{ label: "hex nuts" }]);
  assert.ok(classified?.storeHints.includes("Home Depot"));
  assert.match(classified?.query ?? "", /hex nuts/i);
  assert.match(classified?.query ?? "", /Home Depot/i);
});

test("shopItemsFromPhoto drops empty labels", () => {
  assert.deepEqual(
    shopItemsFromPhoto({
      category: "hardware",
      query: "x",
      items: [{ label: "  hex nuts " }, { label: " " }],
      storeHints: [],
      source: "model",
    }),
    [{ label: "hex nuts" }],
  );
});
