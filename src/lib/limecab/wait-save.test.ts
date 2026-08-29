import assert from "node:assert/strict";
import { test } from "node:test";

import { findBookableProduct } from "./courier.ts";
import {
  estimateFare,
  isWaitSaveProduct,
  ridePickupCopy,
  WAIT_SAVE_PRODUCT,
  WAIT_SAVE_PRODUCT_ID,
  type RideProduct,
} from "./domain.ts";

const LIME: RideProduct = {
  id: "lime",
  name: "Lime",
  description: "Everyday ride",
  seats: 4,
  etaMinutes: 4,
  priceCents: 100,
  status: "available",
};

test("Wait & Save is a bookable private ride", () => {
  assert.equal(WAIT_SAVE_PRODUCT.id, WAIT_SAVE_PRODUCT_ID);
  assert.equal(WAIT_SAVE_PRODUCT.name, "Wait & Save");
  assert.equal(WAIT_SAVE_PRODUCT.status, "available");
  assert.equal(WAIT_SAVE_PRODUCT.seats, LIME.seats);
  assert.equal(isWaitSaveProduct(WAIT_SAVE_PRODUCT_ID), true);
  assert.equal(isWaitSaveProduct("lime"), false);
  assert.equal(
    findBookableProduct(WAIT_SAVE_PRODUCT_ID, [WAIT_SAVE_PRODUCT])?.name,
    "Wait & Save",
  );
});

test("Wait & Save is cheaper than Lime and slower to pick up", () => {
  assert.ok(WAIT_SAVE_PRODUCT.priceCents < LIME.priceCents);
  assert.ok(WAIT_SAVE_PRODUCT.etaMinutes > LIME.etaMinutes);
  assert.ok(
    estimateFare(WAIT_SAVE_PRODUCT, 5, 20).totalCents <
      estimateFare(LIME, 5, 20).totalCents,
  );
});

test("Wait & Save pickup copy is a wait window, not a clock ETA", () => {
  assert.equal(
    ridePickupCopy(WAIT_SAVE_PRODUCT),
    `Wait up to ${WAIT_SAVE_PRODUCT.etaMinutes} min`,
  );
  assert.equal(ridePickupCopy(LIME), `${LIME.etaMinutes} min away`);
});
