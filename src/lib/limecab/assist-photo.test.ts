import test from "node:test";
import assert from "node:assert/strict";

import {
  assistQueryFromPhoto,
  classifyPhotoFilename,
  composeShopQuery,
  normalizePhotoClassification,
  pickClosestStoreForPhoto,
  rankStoresForPhoto,
  scoreStoreForPhoto,
  shopItemsFromPhoto,
} from "./assist-photo.ts";

const DOWNTOWN = { latitude: 34.0505, longitude: -118.2551 };

const FIXTURE_STORES = [
  {
    address: "The Home Depot, 500 S Alameda St, Los Angeles",
    latitude: 34.0407,
    longitude: -118.2384,
    label: "Home Depot",
    category: "hardware_store",
  },
  {
    address: "Lowe's, 4550 E Olympic Blvd, Los Angeles",
    latitude: 34.0194,
    longitude: -118.1756,
    label: "Lowe's",
    category: "hardware_store",
  },
  {
    address: "Target, 735 S Figueroa St, Los Angeles",
    latitude: 34.0485,
    longitude: -118.2606,
    label: "Target",
  },
  {
    address: "Vons, 1430 S Fair Oaks Ave, Pasadena",
    latitude: 34.1288,
    longitude: -118.1497,
    label: "Vons",
    category: "grocery",
  },
  {
    address: "Sunset Plant Shop, Sunset Blvd, Los Angeles",
    latitude: 34.0869,
    longitude: -118.2694,
    label: "Florist",
  },
];

test("composeShopQuery names the item; soft types stay out of the sentence", () => {
  assert.equal(
    composeShopQuery([{ label: "hex nuts" }], ["hardware store"]),
    "deliver hex nuts now",
  );
  assert.equal(
    composeShopQuery([{ label: "hex nuts" }], ["Home Depot", "Lowe's"]),
    "deliver hex nuts from Home Depot now",
  );
  assert.equal(composeShopQuery([{ label: "milk" }]), "deliver milk now");
});

test("filename fallback extracts item labels without locking a chain", () => {
  const nut = classifyPhotoFilename("nut.jpg");
  assert.equal(nut?.category, "hardware");
  assert.ok(nut?.items.some((item) => /nut/i.test(item.label)));
  assert.ok(nut?.storeHints.some((hint) => /hardware/i.test(hint)));
  assert.equal(nut?.storeHints.includes("Home Depot"), false);
  assert.match(nut?.query ?? "", /nut/i);
  assert.doesNotMatch(nut?.query ?? "", /Home Depot/i);

  const hex = classifyPhotoFilename("hex-nut.png");
  assert.equal(hex?.items[0]?.label, "hex nuts");

  assert.equal(classifyPhotoFilename("doughnut.jpg"), null);
  assert.equal(classifyPhotoFilename("IMG_1234.jpg"), null);
});

test("filename stationery extracts pencils without locking Target", () => {
  const pencil = classifyPhotoFilename(
    "pngtree-pencil-with-orange-body-png-image_21226753.png",
  );
  assert.equal(pencil?.category, "home");
  assert.equal(pencil?.items[0]?.label, "pencils");
  assert.equal(pencil?.storeHints.includes("Target"), false);
  assert.ok(pencil?.storeHints.some((hint) => /office|merchandise|home/i.test(hint)));
  assert.match(pencil?.query ?? "", /pencils/i);
  assert.doesNotMatch(pencil?.query ?? "", /Target/i);

  const pens = classifyPhotoFilename("blue-pens.jpg");
  assert.equal(pens?.items[0]?.label, "pens");
});

test("assistQueryFromPhoto adds now when the model omitted timing", () => {
  assert.equal(
    assistQueryFromPhoto({
      category: "hardware",
      query: "buy hex nuts at a hardware store",
      items: [{ label: "hex nuts" }],
      storeHints: ["hardware store"],
      source: "model",
    }),
    "buy hex nuts at a hardware store now",
  );
});

test("normalizePhotoClassification uses soft store types not locked chains", () => {
  const classified = normalizePhotoClassification({
    category: "hardware",
    items: ["hex nuts"],
  });
  assert.equal(classified?.category, "hardware");
  assert.deepEqual(classified?.items, [{ label: "hex nuts" }]);
  assert.ok(classified?.storeHints.some((hint) => /hardware/i.test(hint)));
  assert.equal(classified?.storeHints.includes("Home Depot"), false);
  assert.match(classified?.query ?? "", /hex nuts/i);
  assert.doesNotMatch(classified?.query ?? "", /Home Depot/i);
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

test("pickClosestStoreForPhoto picks nearest hardware for fasteners", () => {
  const picked = pickClosestStoreForPhoto(
    {
      category: "hardware",
      storeHints: ["hardware store", "home improvement"],
      items: [{ label: "hex nuts" }],
    },
    FIXTURE_STORES,
    DOWNTOWN,
  );
  assert.equal(picked?.label, "Home Depot");
});

test("pickClosestStoreForPhoto picks nearest home/office option for pencils", () => {
  const picked = pickClosestStoreForPhoto(
    {
      category: "home",
      storeHints: ["office supply", "general merchandise"],
      items: [{ label: "pencils" }],
    },
    FIXTURE_STORES,
    DOWNTOWN,
  );
  assert.equal(picked?.label, "Target");
});

test("rankStoresForPhoto prefers closer of two viable hardware stores", () => {
  const ranked = rankStoresForPhoto(
    {
      category: "hardware",
      storeHints: ["hardware store"],
      items: [{ label: "bolts" }],
    },
    FIXTURE_STORES,
    DOWNTOWN,
  );
  assert.ok(ranked.length >= 2);
  assert.equal(ranked[0]?.label, "Home Depot");
  assert.ok((ranked[0]?.meters ?? Infinity) < (ranked[1]?.meters ?? 0));
});

test("scoreStoreForPhoto boosts matching category tags", () => {
  const hardware = scoreStoreForPhoto(FIXTURE_STORES[0]!, {
    category: "hardware",
    storeHints: ["hardware store"],
    items: [],
  });
  const grocery = scoreStoreForPhoto(FIXTURE_STORES[3]!, {
    category: "hardware",
    storeHints: ["hardware store"],
    items: [],
  });
  assert.ok(hardware > grocery);
  assert.equal(grocery, 0);
});
