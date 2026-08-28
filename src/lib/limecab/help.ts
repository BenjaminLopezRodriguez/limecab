/**
 * Lime Help — a scheduled visit to someone's home.
 *
 * Not a ride with a different icon and not Assist (which is help getting into
 * a car). A helper comes to the house at a time the rider picked, does light
 * household tasks for about an hour, and leaves. Pickup and destination are
 * the same address, so there is no route and no per-mile fare.
 */

import type { RideProduct } from "./domain.ts";
import { upcomingHalfHours } from "./reserve.ts";

export const HELP_SERVICE = {
  id: "help",
  title: "Help",
  description: "Someone to help at home",
  status: "available" as const,
};

/**
 * Two products, one tile. Light tasks and Care are genuinely different work
 * with different driver gates — that difference is the "what kind?" question,
 * so it is two ids and not a flag.
 */
export const HELP_PRODUCTS: RideProduct[] = [
  {
    id: "lime-help",
    name: "Lime Help",
    description: "Light tasks at home",
    seats: 0,
    etaMinutes: 0,
    priceCents: 280,
    status: "available",
  },
  {
    id: "lime-care",
    name: "Lime Care",
    description: "Care at home",
    seats: 0,
    etaMinutes: 0,
    priceCents: 320,
    status: "available",
  },
];

export function isHelpProduct(id: string | null | undefined): boolean {
  if (!id) return false;
  return HELP_PRODUCTS.some((product) => product.id === id);
}

export function isCareProduct(id: string | null | undefined): boolean {
  return id === "lime-care";
}

/** A visit is priced as an hour on site, never as miles driven. */
export const HELP_VISIT_MINUTES = 60;

/**
 * Visits happen during the day. Overnight is out of the product, so a slot
 * that would land outside this window is not offered — there is no control
 * to decline, because the time never appears.
 */
export const HELP_FIRST_MINUTE = 8 * 60;
export const HELP_LAST_MINUTE = 21 * 60;

export function withinHelpHours(at: Date): boolean {
  const minutes = at.getHours() * 60 + at.getMinutes();
  return minutes >= HELP_FIRST_MINUTE && minutes <= HELP_LAST_MINUTE;
}

/**
 * The Reserve clock, filtered to daytime. Same half-hours, fewer of them.
 *
 * A late-evening "today" runs out of slots rather than rolling over into
 * tomorrow morning under a Today heading — a wrong day is worse than an
 * empty list, and the empty list is what sends the rider to Tomorrow.
 */
export function helpVisitSlots(
  day: "today" | "tomorrow",
  count = 8,
  from = new Date(),
): Date[] {
  const sameDay = (slot: Date) =>
    day === "tomorrow" || slot.getDate() === from.getDate();
  return upcomingHalfHours(day, count * 6, from)
    .filter((slot) => sameDay(slot) && withinHelpHours(slot))
    .slice(0, count);
}

export function helpVisitLabel(at: Date): string {
  const time = at.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `Scheduled for ${time}`;
}

/**
 * Care rules, and the version of them a driver agreed to.
 *
 * Bump this whenever the wording below changes: a driver who agreed to an
 * older list has not agreed to this one, so their `careJobs` stops counting
 * until they walk the rules again. Never auto-carry an old acknowledgement
 * across a version change.
 */
export const CARE_RULES_VERSION = "2026-08-28";

export type CareRule = { title: string; body: string };

export const CARE_RULES: CareRule[] = [
  {
    title: "Not medical care",
    body: "You do not diagnose, advise on medication, or act as a nurse. If they need a clinician, this job is the wrong job.",
  },
  {
    title: "Emergencies",
    body: "If someone is in danger, you call 911. You do not “handle it”.",
  },
  {
    title: "Lifting",
    body: "You do not lift or transfer a person. You do not lift more than 25 lb. If the visit needs that, you decline and leave.",
  },
  {
    title: "No overnight",
    body: "The visit ends at the scheduled window. You do not stay the night. You do not accept a “just until morning”.",
  },
  {
    title: "Privacy",
    body: "No photos or video of the client or the inside of the home. No posting.",
  },
  {
    title: "You can leave",
    body: "If you feel unsafe, you leave. You tell support. A Care accept is not a lock-in to stay.",
  },
  {
    title: "Companionship and daily living only",
    body: "Presence, a meal they can eat, help they can still do with you there. Not bathing that needs training, not wound care, not controlled meds.",
  },
];

/**
 * Whether this driver may be offered Care work. An acknowledgement of an
 * older rules version is not an acknowledgement of these rules.
 */
export function careAckCurrent(driver: {
  careJobs?: boolean | null;
  careRulesVersion?: string | null;
}): boolean {
  return (
    driver.careJobs === true && driver.careRulesVersion === CARE_RULES_VERSION
  );
}

export function helpKindLabel(productId: string): string {
  return isCareProduct(productId) ? "Care" : "Light tasks";
}
