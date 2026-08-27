import assert from "node:assert/strict";
import { test } from "node:test";

import { mapboxReferer } from "./mapbox-request.ts";

test("prefers the Origin header", () => {
  const request = new Request("http://localhost:3000/api/map/directions", {
    headers: {
      origin: "http://localhost:3000",
      referer: "http://localhost:3000/ride",
    },
  });
  assert.equal(mapboxReferer(request), "http://localhost:3000");
});

test("falls back to the Referer origin", () => {
  const request = new Request("http://localhost:3000/api/map/directions", {
    headers: { referer: "http://localhost:3000/ride?x=1" },
  });
  assert.equal(mapboxReferer(request), "http://localhost:3000");
});

test("uses the forwarded host when the browser sent neither", () => {
  const request = new Request("http://127.0.0.1/api/map/directions", {
    headers: {
      host: "127.0.0.1:3000",
      "x-forwarded-host": "localhost:3000",
      "x-forwarded-proto": "https",
    },
  });
  assert.equal(mapboxReferer(request), "https://localhost:3000");
});
