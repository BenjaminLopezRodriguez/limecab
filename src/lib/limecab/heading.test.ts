import test from "node:test";
import assert from "node:assert/strict";

import { offerHeadsToward } from "./heading.ts";

const downtown = { latitude: 34.0505, longitude: -118.2551 };
const echoPark = { latitude: 34.0782, longitude: -118.2606 };
const pasadena = { latitude: 34.1459, longitude: -118.1376 };

test("offerHeadsToward keeps every offer when no heading is set", () => {
  assert.equal(
    offerHeadsToward(
      {
        pickupLatitude: downtown.latitude,
        pickupLongitude: downtown.longitude,
        destinationLatitude: pasadena.latitude,
        destinationLongitude: pasadena.longitude,
      },
      null,
    ),
    true,
  );
});

test("offerHeadsToward keeps a trip that ends at the heading", () => {
  assert.equal(
    offerHeadsToward(
      {
        pickupLatitude: downtown.latitude,
        pickupLongitude: downtown.longitude,
        destinationLatitude: echoPark.latitude,
        destinationLongitude: echoPark.longitude,
      },
      echoPark,
    ),
    true,
  );
});

test("offerHeadsToward drops a trip that ends farther from the heading", () => {
  assert.equal(
    offerHeadsToward(
      {
        pickupLatitude: downtown.latitude,
        pickupLongitude: downtown.longitude,
        destinationLatitude: pasadena.latitude,
        destinationLongitude: pasadena.longitude,
      },
      echoPark,
    ),
    false,
  );
});
