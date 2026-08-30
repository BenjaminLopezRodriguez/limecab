import test from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";

import { CARRIER_MEMBER_ROLES } from "../../lib/freight/types.ts";
import {
  capabilitiesForRole,
  redactLoadForRole,
  requireCarrierAccess,
  requireDriverAssigned,
  type CarrierCapabilities,
  type CarrierMembership,
} from "./authz.ts";

const member = (
  role: CarrierMembership["role"],
  carrierId = "carrier_a",
): CarrierMembership => ({
  id: `mem_${role}`,
  carrierId,
  userId: `user_${role}`,
  role,
});

const forbidden = (err: unknown) =>
  err instanceof TRPCError && err.code === "FORBIDDEN";

/**
 * Full capability matrix. A future edit to capabilitiesForRole must break here.
 * Two holes were closed by audit and are locked below: DRIVER.canBook is
 * `false` (booking binds the carrier to a lane — that is dispatch, not
 * driving) and DRIVER.canSeeRate is `false` (an employee driver is not paid
 * the load rate, and the broker margin is not theirs to read).
 */
const MATRIX: Record<string, CarrierCapabilities> = {
  OWNER: {
    canBook: true,
    canAssign: true,
    canDrive: true,
    canManageFleet: true,
    canSeeRate: true,
  },
  DISPATCHER: {
    canBook: true,
    canAssign: true,
    canDrive: false,
    canManageFleet: false,
    canSeeRate: true,
  },
  DRIVER: {
    canBook: false,
    canAssign: false,
    canDrive: true,
    canManageFleet: false,
    canSeeRate: false,
  },
};

test("capability matrix has no holes", () => {
  assert.deepEqual(Object.keys(MATRIX).sort(), [...CARRIER_MEMBER_ROLES].sort());
  for (const role of CARRIER_MEMBER_ROLES) {
    assert.deepEqual(capabilitiesForRole(role), MATRIX[role], role);
  }
});

test("DRIVER cannot assign", () => {
  assert.equal(capabilitiesForRole("DRIVER").canAssign, false);
});

test("DRIVER cannot book — booking is dispatch, not driving", () => {
  assert.equal(capabilitiesForRole("DRIVER").canBook, false);
});

test("DRIVER cannot see rate; dispatch can", () => {
  assert.equal(capabilitiesForRole("DRIVER").canSeeRate, false);
  assert.equal(capabilitiesForRole("DISPATCHER").canSeeRate, true);
  assert.equal(capabilitiesForRole("OWNER").canSeeRate, true);
});

test("DISPATCHER books and assigns but cannot drive", () => {
  const caps = capabilitiesForRole("DISPATCHER");
  assert.equal(caps.canBook, true);
  assert.equal(caps.canAssign, true);
  assert.equal(caps.canDrive, false);
  assert.equal(caps.canManageFleet, false);
});

test("OWNER passes all five", () => {
  const caps = capabilitiesForRole("OWNER");
  assert.deepEqual(Object.values(caps), [true, true, true, true, true]);
});

test("Ontario-Phoenix: dispatcher books, driver runs it", () => {
  const dispatcher = member("DISPATCHER");
  const driver = member("DRIVER");
  const load = {
    status: "AVAILABLE",
    carrierId: null as string | null,
    assignedDriverUserId: null as string | null,
  };

  // Dispatcher books; the driver could not have.
  assert.equal(capabilitiesForRole(dispatcher.role).canBook, true);
  assert.equal(capabilitiesForRole(driver.role).canBook, false);
  assert.equal(requireCarrierAccess(load, dispatcher), dispatcher);
  load.status = "BOOKED";
  load.carrierId = dispatcher.carrierId;

  // Dispatcher assigns the driver; the driver could not have.
  assert.equal(capabilitiesForRole(dispatcher.role).canAssign, true);
  assert.equal(capabilitiesForRole(driver.role).canAssign, false);
  load.assignedDriverUserId = driver.userId;
  load.status = "DRIVER_ASSIGNED";

  // Driver runs it and uploads POD.
  assert.equal(capabilitiesForRole(driver.role).canDrive, true);
  requireDriverAssigned(load, driver.userId);
  assert.equal(requireCarrierAccess(load, driver), driver);

  // Dispatcher may not drive it.
  assert.equal(capabilitiesForRole(dispatcher.role).canDrive, false);
  assert.throws(() => requireDriverAssigned(load, dispatcher.userId), forbidden);
});

test("a booked load is invisible to another carrier and to non-members", () => {
  const load = { status: "BOOKED", carrierId: "carrier_a" };
  assert.throws(() => requireCarrierAccess(load, member("OWNER", "carrier_b")), forbidden);
  assert.throws(() => requireCarrierAccess(load, null), forbidden);
  assert.throws(
    () => requireCarrierAccess({ status: "AVAILABLE", carrierId: null }, null),
    forbidden,
  );
});

test("an unassigned driver of the right carrier still cannot drive the load", () => {
  const load = { assignedDriverUserId: "user_DRIVER" };
  assert.throws(() => requireDriverAssigned(load, "some_other_driver"), forbidden);
  assert.throws(() => requireDriverAssigned({ assignedDriverUserId: null }, "user_DRIVER"), forbidden);
});

const priced = {
  id: "load_ontario_phoenix",
  status: "DRIVER_ASSIGNED",
  shipperPriceMinor: 210_000,
  carrierRateMinor: 184_000,
};

test("shipper keeps their price, never the carrier's side of the spread", () => {
  const seen = redactLoadForRole(priced, { canSeeRate: false, isShipper: true });
  assert.equal(seen.shipperPriceMinor, 210_000);
  assert.equal("carrierRateMinor" in seen, false);
});

test("carrier dispatch keeps the rate, never the broker margin", () => {
  const seen = redactLoadForRole(priced, {
    canSeeRate: capabilitiesForRole("DISPATCHER").canSeeRate,
    isShipper: false,
  });
  assert.equal(seen.carrierRateMinor, 184_000);
  assert.equal("shipperPriceMinor" in seen, false);
});

test("a DRIVER reads neither — absent, not zero", () => {
  const seen = redactLoadForRole(priced, {
    canSeeRate: capabilitiesForRole("DRIVER").canSeeRate,
    isShipper: false,
  });
  assert.equal("carrierRateMinor" in seen, false);
  assert.equal("shipperPriceMinor" in seen, false);
  // A zero would render as "$0.00", which is a lie.
  assert.equal(seen.carrierRateMinor, undefined);
  assert.equal(seen.id, "load_ontario_phoenix");
});

test("an owner-operator driving their own load still reads the rate", () => {
  const seen = redactLoadForRole(priced, {
    canSeeRate: capabilitiesForRole("OWNER").canSeeRate,
    isShipper: false,
  });
  assert.equal(seen.carrierRateMinor, 184_000);
});
