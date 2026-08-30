/** Minimal quote state machine. Pure. */

export const QUOTE_STATUSES = [
  "PENDING",
  "ACTIVE",
  "EXPIRED",
  "ACCEPTED",
  "REJECTED",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

const ALLOWED: Record<QuoteStatus, readonly QuoteStatus[]> = {
  PENDING: ["ACTIVE", "REJECTED", "EXPIRED"],
  ACTIVE: ["ACCEPTED", "REJECTED", "EXPIRED"],
  EXPIRED: [],
  ACCEPTED: [],
  REJECTED: [],
};

export function isQuoteStatus(value: string): value is QuoteStatus {
  return (QUOTE_STATUSES as readonly string[]).includes(value);
}

export function canTransitionQuote(
  from: QuoteStatus,
  to: QuoteStatus,
): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}
