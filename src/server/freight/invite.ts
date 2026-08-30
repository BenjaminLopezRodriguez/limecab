/**
 * Fleet invites — the one door into carrier membership.
 *
 * Membership is organizational identity: it is what unlocks freight on
 * `/driver`. So the guard lives here as pure functions the router calls and
 * the tests exercise without a database, and acceptance CASes on the invite
 * row (see `claimInvite`) the same way `booking.ts` CASes on an AVAILABLE load.
 */

import type { CarrierMemberRole } from "../../lib/freight/types.ts";
import {
  capabilitiesForRole,
  type CarrierCapabilities,
} from "./authz.ts";

/** Roles an invite may grant. OWNER is not transferable by invite. */
export const INVITABLE_ROLES = ["DRIVER", "DISPATCHER"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * No 0/O/1/I/L/U — the code is read off a screen and typed by a stranger.
 * ponytail: crypto.getRandomValues, not a dependency; rejection-free because
 * 32 divides 256 evenly, so the alphabet stays uniform.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const CODE_LEN = 8;

export function generateInviteCode(
  randomBytes: (n: number) => Uint8Array = defaultRandomBytes,
): string {
  const bytes = randomBytes(CODE_LEN);
  let out = "";
  for (let i = 0; i < CODE_LEN; i += 1) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

function defaultRandomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

/** People type spaces, lowercase and stray dashes. Store/compare one form. */
export function normalizeInviteCode(raw: string): string {
  const bare = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (bare.length !== CODE_LEN) return bare;
  return `${bare.slice(0, 4)}-${bare.slice(4)}`;
}

export type InviteState = {
  expiresAt: Date;
  acceptedByUserId: string | null;
  revokedAt: Date | null;
};

export type InviteRefusal =
  | "revoked"
  | "already_accepted"
  | "expired"
  | "already_member";

/** Each refusal names its own cause — never a generic "invalid invite". */
export const INVITE_REFUSAL_MESSAGE: Record<InviteRefusal, string> = {
  revoked: "This invite was revoked by the fleet. Ask for a new code.",
  already_accepted:
    "This invite has already been used. Codes work once — ask for a new one.",
  expired: "This invite expired. Ask the fleet for a new code.",
  already_member: "You're already a member of this fleet.",
};

/**
 * Revoked before used before expired: the most deliberate cause first, so a
 * driver is told the fleet pulled the invite rather than that time ran out.
 */
export function inviteRefusal(
  state: InviteState,
  opts: { now: Date; alreadyMember: boolean },
): InviteRefusal | null {
  if (state.revokedAt) return "revoked";
  if (state.acceptedByUserId) return "already_accepted";
  if (state.expiresAt.getTime() <= opts.now.getTime()) return "expired";
  if (opts.alreadyMember) return "already_member";
  return null;
}

const CAPABILITY_LABEL: Record<keyof CarrierCapabilities, string> = {
  canBook: "Book loads off the freight board",
  canAssign: "Assign loads to drivers",
  canDrive: "Run assigned loads in Drive",
  canManageFleet: "Invite and remove fleet members",
  canSeeRate: "See load rates and lane pricing",
};

/**
 * What the role can do, in words — derived from `capabilitiesForRole` so the
 * accept screen cannot drift from the permission table it is describing.
 */
export function roleGrantLines(role: CarrierMemberRole): string[] {
  const caps = capabilitiesForRole(role);
  return (Object.keys(CAPABILITY_LABEL) as (keyof CarrierCapabilities)[])
    .filter((key) => caps[key])
    .map((key) => CAPABILITY_LABEL[key]);
}
