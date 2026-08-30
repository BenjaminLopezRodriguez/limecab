/** Minimal accessorial request state machine. Pure. */

export const ACCESSORIAL_TYPES = [
  "DETENTION",
  "LAYOVER",
  "LUMPER",
  "TONU",
  "EXTRA_STOP",
  "OTHER",
] as const;

export type AccessorialType = (typeof ACCESSORIAL_TYPES)[number];

export const ACCESSORIAL_STATUSES = [
  "REQUESTED",
  "APPROVED",
  "DENIED",
  "PAID",
] as const;

export type AccessorialStatus = (typeof ACCESSORIAL_STATUSES)[number];

const ALLOWED: Record<AccessorialStatus, readonly AccessorialStatus[]> = {
  REQUESTED: ["APPROVED", "DENIED"],
  APPROVED: ["PAID"],
  DENIED: [],
  PAID: [],
};

export function isAccessorialStatus(
  value: string,
): value is AccessorialStatus {
  return (ACCESSORIAL_STATUSES as readonly string[]).includes(value);
}

export function canTransitionAccessorial(
  from: AccessorialStatus,
  to: AccessorialStatus,
): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}
