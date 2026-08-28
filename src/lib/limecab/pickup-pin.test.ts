import assert from "node:assert/strict";
import { test } from "node:test";

import {
  redactTripPins,
  ridePinBlocksStart,
  ridePinRequired,
  rideStartAllowed,
} from "./pickup-pin.ts";

test("a ride with PIN on needs the rider to present it", () => {
  assert.equal(
    ridePinRequired({
      productId: "lime",
      pickupPin: "3708",
      enabled: true,
    }),
    true,
  );
});

test("courier and PIN-off riders do not gate the start", () => {
  assert.equal(
    ridePinRequired({
      productId: "courier-small",
      pickupPin: "3708",
      enabled: true,
    }),
    false,
  );
  assert.equal(
    ridePinRequired({
      productId: "lime",
      pickupPin: "3708",
      enabled: false,
    }),
    false,
  );
});

test("the ride cannot start without the matching PIN", () => {
  assert.equal(rideStartAllowed("3708", "3708", true).ok, true);
  assert.equal(rideStartAllowed("0000", "3708", true).ok, false);
  assert.equal(rideStartAllowed(undefined, "3708", true).ok, false);
  assert.equal(rideStartAllowed("3708", "3708", false).ok, true);
  assert.equal(rideStartAllowed(undefined, "3708", false).ok, true);
});

test("the driver payload never contains the PIN digits", () => {
  const redacted = redactTripPins(
    {
      id: "t1",
      productId: "lime",
      pickupPin: "3708",
      deliveryPin: "9911",
    },
    true,
  );
  assert.equal(redacted.pickupPin, null);
  assert.equal(redacted.deliveryPin, null);
  assert.equal(redacted.pinRequired, true);
  assert.equal(JSON.stringify(redacted).includes("3708"), false);
  assert.equal(JSON.stringify(redacted).includes("9911"), false);
});

test("open offers do not hint that a PIN exists", () => {
  const offer = redactTripPins(
    {
      id: "t1",
      productId: "lime",
      pickupPin: "3708",
      deliveryPin: null,
    },
    false,
  );
  assert.equal(offer.pinRequired, false);
  assert.equal(offer.pickupPin, null);
});

test("the PIN overlay is only a question at the curb", () => {
  assert.equal(ridePinBlocksStart("to_pickup", true), false);
  assert.equal(ridePinBlocksStart("at_pickup", true), true);
  assert.equal(ridePinBlocksStart("at_pickup", false), false);
  assert.equal(ridePinBlocksStart("on_trip", true), false);
});

test("a Help visit has no curb, so it never gates the start on a PIN", () => {
  assert.equal(
    ridePinRequired({ productId: "lime-help", pickupPin: "1234" }),
    false,
  );
  assert.equal(
    ridePinRequired({ productId: "lime-care", pickupPin: "1234" }),
    false,
  );
  assert.equal(ridePinRequired({ productId: "lime", pickupPin: "1234" }), true);
});
