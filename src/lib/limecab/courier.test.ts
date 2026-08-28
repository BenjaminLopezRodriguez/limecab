import test from "node:test";
import assert from "node:assert/strict";

import {
  COURIER_OPTIONS,
  COURIER_SERVICE,
  courierCompleteAllowed,
  courierDraftFromOptions,
  courierDraftReady,
  courierMeetingPoint,
  courierOrderLabel,
  courierProductFromOptions,
  courierStartAllowed,
  findBookableProduct,
  isCourierProduct,
} from "./courier.ts";
import { defaultOptionValues } from "../service-app/options.ts";
import type { RideProduct } from "./domain.ts";

test("Courier is a live LimeCab service", () => {
  assert.equal(COURIER_SERVICE.status, "available");
  assert.equal(COURIER_SERVICE.id, "courier");
});

const LIME: RideProduct = {
  id: "lime",
  name: "Lime",
  description: "Everyday ride",
  seats: 4,
  etaMinutes: 4,
  priceCents: 100,
  status: "available",
};

test("findBookableProduct resolves courier sizes and ride tiers", () => {
  assert.equal(findBookableProduct("courier-small")?.name, "Courier");
  assert.equal(findBookableProduct("courier-medium")?.description, "Fits in the trunk");
  assert.equal(findBookableProduct("courier-large")?.name, "Courier XL");
  assert.equal(findBookableProduct("lime", [LIME])?.name, "Lime");
  assert.equal(findBookableProduct("nope", [LIME]), undefined);
});

test("larger packages cost more and take longer to match", () => {
  const small = findBookableProduct("courier-small")!;
  const medium = findBookableProduct("courier-medium")!;
  const large = findBookableProduct("courier-large")!;
  assert.ok(small.priceCents < medium.priceCents);
  assert.ok(medium.priceCents < large.priceCents);
  assert.ok(large.etaMinutes >= medium.etaMinutes);
});

test("isCourierProduct is true only for courier ids", () => {
  assert.equal(isCourierProduct("courier-small"), true);
  assert.equal(isCourierProduct("courier-large"), true);
  assert.equal(isCourierProduct("lime"), false);
});

test("size option selects the matching courier product", () => {
  const values = defaultOptionValues(COURIER_OPTIONS);
  assert.equal(courierProductFromOptions(values).id, "courier-small");
  assert.equal(
    courierProductFromOptions({ ...values, size: "medium" }).id,
    "courier-medium",
  );
  assert.equal(
    courierProductFromOptions({ ...values, size: "large" }).id,
    "courier-large",
  );
});

test("a draft is not ready until the recipient has a name and phone", () => {
  const values = defaultOptionValues(COURIER_OPTIONS);
  assert.equal(courierDraftReady(courierDraftFromOptions(values)), false);
  assert.equal(
    courierDraftReady(
      courierDraftFromOptions({
        ...values,
        recipientName: "Jordan Hale",
        recipientPhone: "2135550142",
      }),
    ),
    true,
  );
  assert.equal(
    courierDraftReady(
      courierDraftFromOptions({
        ...values,
        recipientName: "Jordan Hale",
        recipientPhone: "555",
      }),
    ),
    false,
  );
});

test("buy-for-me needs an item description before it is ready", () => {
  const values = defaultOptionValues(COURIER_OPTIONS);
  const named = {
    ...values,
    fulfillment: "buy",
    recipientName: "Jordan Hale",
    recipientPhone: "2135550142",
  };
  assert.equal(courierDraftReady(courierDraftFromOptions(named)), false);
  assert.equal(
    courierDraftReady(
      courierDraftFromOptions({ ...named, itemDescription: "Snake plant" }),
    ),
    true,
  );
});

test("meeting point is operational, not a contents confession", () => {
  const values = defaultOptionValues(COURIER_OPTIONS);
  assert.equal(
    courierMeetingPoint({
      ...values,
      quantity: 3,
      proof: "hand",
      recipientName: "Jordan Hale",
      instructions: "Side door",
    }),
    "3 packages · Hand to Jordan Hale · Side door",
  );
  assert.equal(
    courierMeetingPoint({
      ...values,
      quantity: 1,
      proof: "door",
      recipientName: "Acme Dental",
    }),
    "1 package · Leave at door for Acme Dental",
  );
});

test("order labels are short and stable", () => {
  assert.equal(courierOrderLabel("a1b2c3d4-e5f6"), "LC-E5F6");
});

test("pickup starts only when the submitted code matches", () => {
  assert.equal(courierStartAllowed("1842", "1842").ok, true);
  assert.equal(courierStartAllowed("0000", "1842").ok, false);
  assert.equal(courierStartAllowed(undefined, "1842").ok, false);
});

test("hand delivery requires the recipient PIN", () => {
  assert.equal(
    courierCompleteAllowed({
      proof: "hand",
      deliveryPin: "3317",
      submittedPin: "3317",
    }).ok,
    true,
  );
  assert.equal(
    courierCompleteAllowed({
      proof: "hand",
      deliveryPin: "3317",
      submittedPin: "0000",
    }).ok,
    false,
  );
});

test("leave-at-door and signature need an explicit acknowledgement", () => {
  assert.equal(
    courierCompleteAllowed({ proof: "door", deliveryPin: null }).ok,
    false,
  );
  assert.equal(
    courierCompleteAllowed({
      proof: "door",
      deliveryPin: null,
      leftAtDoor: true,
    }).ok,
    true,
  );
  assert.equal(
    courierCompleteAllowed({
      proof: "signature",
      deliveryPin: null,
      signatureCaptured: true,
    }).ok,
    true,
  );
});
