import test from "node:test";
import assert from "node:assert/strict";

import {
  fetchNearby,
  nearbyQuerySchema,
  restStopsFromPlaces,
  type LimePlace,
} from "./spatial.ts";

const CONFIG = { baseUrl: "https://spatial.test", apiKey: "key" };

const PLACE: LimePlace = {
  id: "lp_1",
  canonicalName: "Ralphs, 123 Main St",
  shortName: "Ralphs",
  normalizedName: "ralphs",
  brandKey: "ralphs",
  latitude: 34.05,
  longitude: -118.25,
  entityType: "grocery_store",
  entitySubtype: null,
  distanceMeters: 412.6,
  h3R9: "89283082837ffff",
  h3R10: "8a283082837ffff",
  sources: [{ provider: "google", providerPlaceId: "g1" }],
  attribution: ["google"],
};

function query(search: string) {
  return Object.fromEntries(new URLSearchParams(search));
}

type FetchCall = { url: string; init: RequestInit };

/** Zero network: every test drives the client through this stub. */
function stubFetch(
  handler: (call: FetchCall) => Promise<Response>,
): { calls: FetchCall[]; restore: () => void } {
  const original = globalThis.fetch;
  const calls: FetchCall[] = [];
  globalThis.fetch = (input: URL | RequestInfo, init?: RequestInit) => {
    const url =
      input instanceof URL
        ? input.href
        : typeof input === "string"
          ? input
          : input.url;
    const call = { url, init: init ?? {} };
    calls.push(call);
    return handler(call);
  };
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

test("query params map onto the contract request", () => {
  const parsed = nearbyQuerySchema.parse(
    query(
      "lat=34.05&lng=-118.25&brand=ralphs&q=milk&types=grocery_store,pharmacy&limit=5&maxMeters=1200",
    ),
  );
  assert.deepEqual(parsed, {
    latitude: 34.05,
    longitude: -118.25,
    query: "milk",
    brandKey: "ralphs",
    entityTypes: ["grocery_store", "pharmacy"],
    limit: 5,
    maxDistanceMeters: 1200,
  });
});

test("lat and lng are the only required params", () => {
  assert.deepEqual(nearbyQuerySchema.parse(query("lat=34.05&lng=-118.25")), {
    latitude: 34.05,
    longitude: -118.25,
  });
  assert.equal(nearbyQuerySchema.safeParse(query("lat=34.05")).success, false);
  assert.equal(
    nearbyQuerySchema.safeParse(query("lat=91&lng=-118.25")).success,
    false,
  );
});

test("an unknown entity type is rejected, not forwarded", () => {
  const result = nearbyQuerySchema.safeParse(
    query("lat=34.05&lng=-118.25&types=grocery_store,taco_truck"),
  );
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.message, "Unknown entity type");
});

test("limit and maxMeters clamp instead of failing", () => {
  const high = nearbyQuerySchema.parse(
    query("lat=34.05&lng=-118.25&limit=500&maxMeters=9999999"),
  );
  assert.equal(high.limit, 25);
  assert.equal(high.maxDistanceMeters, 50_000);
  const low = nearbyQuerySchema.parse(
    query("lat=34.05&lng=-118.25&limit=0&maxMeters=0"),
  );
  assert.equal(low.limit, 1);
  assert.equal(low.maxDistanceMeters, 1);
});

test("fetchNearby POSTs to /v1/nearby with the key header", async () => {
  const stub = stubFetch(async () =>
    new Response(JSON.stringify({ places: [PLACE] }), { status: 200 }),
  );
  try {
    const places = await fetchNearby(
      { latitude: 34.05, longitude: -118.25, entityTypes: ["grocery_store"] },
      CONFIG,
    );
    assert.equal(places?.length, 1);
    assert.equal(places?.[0]?.id, "lp_1");
  } finally {
    stub.restore();
  }
  const call = stub.calls[0]!;
  assert.equal(call.url, "https://spatial.test/v1/nearby");
  assert.equal(call.init.method, "POST");
  assert.equal(
    (call.init.headers as Record<string, string>)["X-Lime-Spatial-Key"],
    "key",
  );
  assert.deepEqual(JSON.parse(call.init.body as string), {
    latitude: 34.05,
    longitude: -118.25,
    entityTypes: ["grocery_store"],
  });
});

test("a non-2xx answer is null, never a throw", async () => {
  const stub = stubFetch(async () =>
    new Response(JSON.stringify({ error: "nope" }), { status: 500 }),
  );
  try {
    assert.equal(
      await fetchNearby({ latitude: 34.05, longitude: -118.25 }, CONFIG),
      null,
    );
  } finally {
    stub.restore();
  }
});

test("an off-contract body is null, never a throw", async () => {
  const stub = stubFetch(async () =>
    new Response(JSON.stringify({ places: [{ id: "lp_1" }] }), { status: 200 }),
  );
  try {
    assert.equal(
      await fetchNearby({ latitude: 34.05, longitude: -118.25 }, CONFIG),
      null,
    );
  } finally {
    stub.restore();
  }
});

test("a transport failure is null, never a throw", async () => {
  const stub = stubFetch(() => Promise.reject(new Error("timed out")));
  try {
    assert.equal(
      await fetchNearby({ latitude: 34.05, longitude: -118.25 }, CONFIG),
      null,
    );
  } finally {
    stub.restore();
  }
});

test("places become rest stops the list scenes already render", () => {
  const [stop] = restStopsFromPlaces([
    PLACE,
    { ...PLACE, id: "lp_2", entityType: "parking" },
  ]);
  assert.equal(stop?.address, "Ralphs, 123 Main St");
  assert.equal(stop?.shortName, "Ralphs");
  assert.equal(stop?.category, "grocery");
  assert.equal(stop?.distanceMeters, 413);
  assert.equal(restStopsFromPlaces([{ ...PLACE, entityType: "parking" }])[0]
    ?.category, undefined);
});
