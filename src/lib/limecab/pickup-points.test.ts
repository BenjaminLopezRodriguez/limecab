import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cardinalCurbLabel,
  closestPickupCandidate,
  curbOffsetsAlongPath,
  featureBelongsToPlace,
  isDistinctSpotName,
  isVenuePlace,
  labelRoutablePoint,
  nameSameAddressSpots,
  pickupPointsAsMapPoints,
  pickupPointsFromVendor,
  upsertCustomPickup,
} from "./pickup-points.ts";

const CHESTER = {
  latitude: 34.1483,
  longitude: -118.1445,
  address: "303 North Chester Avenue, Pasadena, CA",
};

const UNION_STATION = {
  latitude: 34.0561,
  longitude: -118.2348,
  address: "Union Station, Los Angeles, CA",
};

test("a driving routable point is labeled as a curb, not the place name", () => {
  assert.equal(labelRoutablePoint({ name: "driving" }, "Union Station"), "Curb");
  assert.equal(labelRoutablePoint({ name: "walking" }), "Entrance");
  assert.equal(
    labelRoutablePoint({ name: "POI" }, "Union Station"),
    "Union Station",
  );
  assert.equal(
    labelRoutablePoint({ name: "walking", note: "Main entrance" }),
    "Main entrance",
  );
});

test("venues are detected from the address and from POI categories", () => {
  assert.equal(isVenuePlace(UNION_STATION), true);
  assert.equal(isVenuePlace(CHESTER), false);
  assert.equal(
    isVenuePlace(
      { latitude: 34, longitude: -118, address: "123 Main St" },
      [
        {
          properties: {
            name: "Pauley Pavilion",
            poi_category_ids: ["stadium"],
          },
        },
      ],
    ),
    true,
  );
});

test("pickup points prefer a named access curb over the parcel centroid", () => {
  const points = pickupPointsFromVendor({
    place: UNION_STATION,
    features: [
      {
        properties: {
          name: "Union Station",
          full_address: UNION_STATION.address,
          poi_category_ids: ["train_station"],
          coordinates: {
            latitude: UNION_STATION.latitude,
            longitude: UNION_STATION.longitude,
            routable_points: [
              {
                name: "driving",
                latitude: 34.0557,
                longitude: -118.2356,
              },
              {
                name: "walking",
                note: "Alameda entrance",
                latitude: 34.0564,
                longitude: -118.2362,
              },
            ],
          },
        },
      },
    ],
    snap: { latitude: 34.0557, longitude: -118.2356 },
  });

  assert.ok(points.length >= 2);
  assert.equal(points[0]?.source, "access");
  assert.ok(
    points.some((point) => point.label === "Alameda entrance"),
  );
  assert.ok(
    points.every(
      (point) =>
        Math.abs(point.latitude - UNION_STATION.latitude) > 1e-4 ||
        Math.abs(point.longitude - UNION_STATION.longitude) > 1e-4,
    ),
  );
});

test("a shop on the same block is not a pickup for the chosen place", () => {
  const pretzel = {
    properties: {
      name: "Wetzel's Pretzels",
      full_address: "800 N Alameda St Space #K1, Los Angeles, California",
      coordinates: {
        latitude: 34.05618,
        longitude: -118.23498,
        routable_points: [
          { name: "POI", latitude: 34.05618, longitude: -118.23498 },
        ],
      },
    },
  };
  assert.equal(featureBelongsToPlace(pretzel, UNION_STATION, true), false);
  const points = pickupPointsFromVendor({
    place: UNION_STATION,
    features: [
      pretzel,
      {
        properties: {
          name: "Union Station",
          full_address: "800 North Alameda Street, Los Angeles, California",
          poi_category_ids: ["train_station"],
          coordinates: {
            latitude: 34.0561,
            longitude: -118.2348,
            routable_points: [
              { name: "driving", latitude: 34.0557, longitude: -118.2356 },
            ],
          },
        },
      },
    ],
  });
  assert.equal(points.some((point) => /pretzel/i.test(point.label)), false);
  assert.ok(points.some((point) => point.source === "access"));
});

test("a street address still gets a snapped curb plus nearby curb choices", () => {
  const snap = { latitude: 34.1481, longitude: -118.1448 };
  const path = [
    { latitude: 34.1474, longitude: -118.1448 },
    snap,
    { latitude: 34.1489, longitude: -118.1448 },
  ];
  const points = pickupPointsFromVendor({
    place: CHESTER,
    snap,
    roadPath: path,
  });

  assert.ok(points.length >= 2);
  assert.equal(points[0]?.source, "curb");
  const faces = points.map((point) => point.label);
  assert.ok(faces.includes("Front entrance"));
  assert.ok(
    faces.some((label) => label === "Back entrance" || label === "Side entrance"),
  );
});

test("near-duplicate access points collapse to the better score", () => {
  const points = pickupPointsFromVendor({
    place: CHESTER,
    features: [
      {
        properties: {
          coordinates: {
            routable_points: [
              { name: "driving", latitude: 34.1481, longitude: -118.1448 },
              { name: "address", latitude: 34.14811, longitude: -118.14481 },
            ],
          },
        },
      },
    ],
  });
  assert.equal(points.length, 1);
  assert.equal(points[0]?.label, "Front entrance");
});

test("with no vendor hints the snapped curb is still returned", () => {
  const snap = { latitude: 34.1481, longitude: -118.1448 };
  const points = pickupPointsFromVendor({ place: CHESTER, snap });
  assert.equal(points.length, 1);
  assert.equal(points[0]?.latitude, snap.latitude);
  assert.equal(points[0]?.longitude, snap.longitude);
  assert.equal(points[0]?.label, "Front entrance");
});

test("cardinal labels face away from the place", () => {
  assert.equal(
    cardinalCurbLabel(CHESTER, { latitude: 34.149, longitude: CHESTER.longitude }),
    "North curb",
  );
  assert.equal(
    cardinalCurbLabel(CHESTER, {
      latitude: CHESTER.latitude,
      longitude: -118.143,
    }),
    "East curb",
  );
});

test("along-road offsets sit on the path, not the parcel", () => {
  const path = [
    { latitude: 34.147, longitude: -118.145 },
    { latitude: 34.149, longitude: -118.145 },
  ];
  const offsets = curbOffsetsAlongPath(path, {
    latitude: 34.148,
    longitude: -118.145,
  });
  assert.ok(offsets.length >= 2);
  for (const offset of offsets) {
    assert.ok(Math.abs(offset.longitude + 118.145) < 1e-6);
    assert.ok(offset.latitude !== 34.148);
  }
});

test("closest candidate ignores points outside the snap radius", () => {
  const points = pickupPointsFromVendor({
    place: CHESTER,
    snap: { latitude: 34.1481, longitude: -118.1448 },
  });
  assert.equal(
    closestPickupCandidate({ latitude: 34.2, longitude: -118.2 }, points),
    null,
  );
  assert.equal(
    closestPickupCandidate(
      { latitude: 34.14812, longitude: -118.14481 },
      points,
    )?.id,
    points[0]?.id,
  );
});

test("map points mark the selected curb and keep the others visible", () => {
  const candidates = pickupPointsFromVendor({
    place: UNION_STATION,
    features: [
      {
        properties: {
          name: "Union Station",
          poi_category_ids: ["train_station"],
          coordinates: {
            routable_points: [
              { name: "driving", latitude: 34.0557, longitude: -118.2356 },
              {
                name: "walking",
                note: "Alameda entrance",
                latitude: 34.0564,
                longitude: -118.2362,
              },
            ],
          },
        },
      },
    ],
  });
  const selected = candidates[0]!;
  const points = pickupPointsAsMapPoints(candidates, selected.id);
  assert.equal(points.every((point) => point.kind === "pickup"), true);
  assert.equal(points.filter((point) => point.selected).length, 1);
  assert.equal(points.find((point) => point.selected)?.label, selected.label);
});

test("same-address spots become Front / Side / Back around the parcel", () => {
  const place = { latitude: 34.15, longitude: -118.15 };
  const named = nameSameAddressSpots(place, [
    {
      id: "front",
      latitude: 34.1502,
      longitude: -118.15,
      label: "Curb",
      source: "curb",
      score: 70,
    },
    {
      id: "back",
      latitude: 34.1488,
      longitude: -118.15,
      label: "South curb",
      source: "curb",
      score: 50,
    },
    {
      id: "side",
      latitude: 34.15,
      longitude: -118.1494,
      label: "East curb",
      source: "curb",
      score: 50,
    },
  ]);
  assert.equal(named.find((point) => point.id === "front")?.label, "Front entrance");
  assert.equal(named.find((point) => point.id === "back")?.label, "Back entrance");
  assert.equal(named.find((point) => point.id === "side")?.label, "Side entrance");
  assert.equal(isDistinctSpotName("Alameda entrance"), true);
  assert.equal(isDistinctSpotName("Terminal B Departures"), true);
  assert.equal(isDistinctSpotName("Curb"), false);
  assert.equal(isDistinctSpotName("Central Library"), false);
});

test("a venue POI name is faced, not listed as a different place", () => {
  const named = nameSameAddressSpots(
    { latitude: 34.0505, longitude: -118.2551, address: "630 West 5th Street" },
    [
      {
        id: "near",
        latitude: 34.0506,
        longitude: -118.2551,
        label: "Curb",
        source: "curb",
        score: 70,
      },
      {
        id: "poi",
        latitude: 34.0504,
        longitude: -118.2546,
        label: "Central Library",
        source: "access",
        score: 80,
      },
      {
        id: "far",
        latitude: 34.0498,
        longitude: -118.2551,
        label: "South curb",
        source: "curb",
        score: 50,
      },
    ],
  );
  assert.equal(named.find((point) => point.id === "near")?.label, "Front entrance");
  assert.equal(named.find((point) => point.id === "far")?.label, "Back entrance");
  assert.equal(named.find((point) => point.id === "poi")?.label, "Side entrance");
});

test("a dragged custom pickup replaces the previous custom, not the curbs", () => {
  const base = pickupPointsFromVendor({
    place: CHESTER,
    snap: { latitude: 34.1481, longitude: -118.1448 },
  });
  const next = upsertCustomPickup(base, {
    latitude: 34.1485,
    longitude: -118.145,
  });
  assert.equal(next.filter((point) => point.source === "custom").length, 1);
  assert.ok(next.some((point) => point.source === "curb"));
});
