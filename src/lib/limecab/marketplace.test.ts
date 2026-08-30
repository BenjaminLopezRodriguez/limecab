import assert from "node:assert/strict";
import test from "node:test";

import { tripsWithinMarketplaceMiles } from "./marketplace.ts";

test("tripsWithinMarketplaceMiles keeps nearby pickups and drops far ones", () => {
  const driver = { lastLatitude: 33.4484, lastLongitude: -112.074 };
  const trips = [
    {
      id: "near",
      pickupLatitude: 33.45,
      pickupLongitude: -112.07,
    },
    {
      id: "far",
      pickupLatitude: 34.05,
      pickupLongitude: -118.25,
    },
    {
      id: "legacy",
      pickupLatitude: null,
      pickupLongitude: null,
    },
  ];

  const matched = tripsWithinMarketplaceMiles(trips, driver, 15);
  assert.deepEqual(
    matched.map((trip) => trip.id),
    ["near", "legacy"],
  );
});
