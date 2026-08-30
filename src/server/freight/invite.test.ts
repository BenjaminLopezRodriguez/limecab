import test from "node:test";
import assert from "node:assert/strict";

import {
  generateInviteCode,
  inviteRefusal,
  normalizeInviteCode,
  roleGrantLines,
  type InviteState,
} from "./invite.ts";

const now = new Date("2026-08-30T12:00:00Z");
const open: InviteState = {
  expiresAt: new Date("2026-09-06T12:00:00Z"),
  acceptedByUserId: null,
  revokedAt: null,
};

test("an open invite for a non-member accepts", () => {
  assert.equal(inviteRefusal(open, { now, alreadyMember: false }), null);
});

test("expired invite refuses as expired", () => {
  assert.equal(
    inviteRefusal(
      { ...open, expiresAt: new Date("2026-08-29T12:00:00Z") },
      { now, alreadyMember: false },
    ),
    "expired",
  );
});

test("codes are single-use — a used one refuses as already_accepted", () => {
  assert.equal(
    inviteRefusal(
      { ...open, acceptedByUserId: "user_1" },
      { now, alreadyMember: false },
    ),
    "already_accepted",
  );
});

test("existing member refuses as already_member, not a generic failure", () => {
  assert.equal(inviteRefusal(open, { now, alreadyMember: true }), "already_member");
});

test("revoked outranks expired — the fleet's decision is the real cause", () => {
  assert.equal(
    inviteRefusal(
      {
        expiresAt: new Date("2026-08-29T12:00:00Z"),
        acceptedByUserId: null,
        revokedAt: new Date("2026-08-28T12:00:00Z"),
      },
      { now, alreadyMember: true },
    ),
    "revoked",
  );
});

test("codes avoid ambiguous glyphs and normalize to one form", () => {
  const code = generateInviteCode();
  assert.match(code, /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}$/);
  assert.equal(normalizeInviteCode(code.toLowerCase().replace("-", " ")), code);
});

test("grant lines are derived from capabilitiesForRole", () => {
  const driver = roleGrantLines("DRIVER");
  assert.ok(driver.includes("Run assigned loads in Drive"));
  assert.ok(!driver.includes("Assign loads to drivers"));
  assert.ok(roleGrantLines("DISPATCHER").includes("Assign loads to drivers"));
  assert.ok(!roleGrantLines("DISPATCHER").includes("Invite and remove fleet members"));
});
