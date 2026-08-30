import test from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";

import { assertDriverAdvance, assertSystemComplete } from "./advance.ts";

test("assertDriverAdvance happy path", () => {
  assert.equal(
    assertDriverAdvance("DRIVER_ASSIGNED", "en_route_pickup"),
    "EN_ROUTE_TO_PICKUP",
  );
  assert.equal(
    assertDriverAdvance("UNLOADING", "finish_delivery"),
    "DELIVERED",
  );
});

test("assertDriverAdvance invalid transition throws", () => {
  assert.throws(
    () => assertDriverAdvance("AVAILABLE", "en_route_pickup"),
    (err: unknown) =>
      err instanceof TRPCError && err.code === "PRECONDITION_FAILED",
  );
  assert.throws(
    () => assertDriverAdvance("IN_TRANSIT", "arrive_pickup"),
    (err: unknown) =>
      err instanceof TRPCError && err.code === "PRECONDITION_FAILED",
  );
  assert.throws(
    () => assertDriverAdvance("COMPLETED", "submit_pod"),
    (err: unknown) =>
      err instanceof TRPCError && err.code === "PRECONDITION_FAILED",
  );
});

test("assertSystemComplete only from POD_PENDING", () => {
  assert.equal(assertSystemComplete("POD_PENDING"), "COMPLETED");
  assert.throws(
    () => assertSystemComplete("DELIVERED"),
    (err: unknown) =>
      err instanceof TRPCError && err.code === "PRECONDITION_FAILED",
  );
});
