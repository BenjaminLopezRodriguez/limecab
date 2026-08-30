import assert from "node:assert/strict";
import { test } from "node:test";

import {
  chatMayRead,
  chatMaySend,
  firstName,
  resolveChatAccess,
} from "./trip-chat.ts";

const trip = {
  userId: "rider-1",
  driverId: "driver-1",
  status: "matched" as const,
};

test("the rider of a matched trip may open the thread", () => {
  const access = resolveChatAccess({
    userId: "rider-1",
    trip,
    assignedDriverUserId: "driver-user-1",
  });
  assert.deepEqual(access, { ok: true, role: "rider" });
});

test("the assigned driver of a matched trip may open the thread", () => {
  const access = resolveChatAccess({
    userId: "driver-user-1",
    trip,
    assignedDriverUserId: "driver-user-1",
  });
  assert.deepEqual(access, { ok: true, role: "driver" });
});

test("a stranger cannot read or write the thread", () => {
  const access = resolveChatAccess({
    userId: "other",
    trip,
    assignedDriverUserId: "driver-user-1",
  });
  assert.deepEqual(access, { ok: false, code: "FORBIDDEN" });
});

test("a missing trip is not found", () => {
  const access = resolveChatAccess({
    userId: "rider-1",
    trip: null,
    assignedDriverUserId: null,
  });
  assert.deepEqual(access, { ok: false, code: "NOT_FOUND" });
});

test("chat is unavailable until a driver is assigned", () => {
  const access = resolveChatAccess({
    userId: "rider-1",
    trip: { userId: "rider-1", driverId: null, status: "requested" },
    assignedDriverUserId: null,
  });
  assert.deepEqual(access, { ok: false, code: "UNAVAILABLE" });
});

test("a driver who is not assigned cannot impersonate the seat", () => {
  const access = resolveChatAccess({
    userId: "other-driver",
    trip,
    assignedDriverUserId: "driver-user-1",
  });
  assert.deepEqual(access, { ok: false, code: "FORBIDDEN" });
});

test("read is open after a match, including cancel", () => {
  assert.equal(chatMayRead("requested"), false);
  assert.equal(chatMayRead("matched"), true);
  assert.equal(chatMayRead("complete"), true);
  assert.equal(chatMayRead("cancelled"), true);
});

test("send is closed after a cancel, and before a match", () => {
  assert.equal(chatMaySend("requested"), false);
  assert.equal(chatMaySend("matched"), true);
  assert.equal(chatMaySend("arriving"), true);
  assert.equal(chatMaySend("in_progress"), true);
  assert.equal(chatMaySend("complete"), true);
  assert.equal(chatMaySend("cancelled"), false);
});

test("firstName keeps only the given name", () => {
  assert.equal(firstName("Jordan Miles"), "Jordan");
  assert.equal(firstName("  Ada  "), "Ada");
  assert.equal(firstName(""), null);
  assert.equal(firstName(null), null);
});
