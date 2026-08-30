import type { ReactNode } from "react";

/**
 * Generic service-app data model.
 *
 * These types carry no business semantics. A consuming app supplies its own
 * services, places, and pricing; the shared components never inspect ids.
 */

export type ServiceAvailability = "available" | "coming_soon";

export type ServiceDefinition = {
  id: string;
  title: string;
  description: string;
  icon?: ReactNode;
  status: ServiceAvailability;
  /**
   * Comparable, already-formatted metrics for this option: the numbers the
   * user is choosing *between*. e.g. `{ value: "$24.80", note: "4 min · 4 seats" }`.
   * Display only — the component never parses or compares them.
   */
  meta?: { value?: string; note?: string };
};

export type Location = {
  address: string;
  /** Nearest short label for a pin, e.g. a POI or street name. */
  shortName?: string;
  latitude?: number;
  longitude?: number;
};

/**
 * A saved or recent place. `label` is whatever the app calls it — "Home",
 * "Work", a job number, a street line. Nothing is hard-coded.
 */
export type Place = {
  id: string;
  label: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  source: "saved" | "recent";
  /** Secondary text, e.g. "Yesterday" or "2 mi". */
  hint?: string;
};

/**
 * The draft a request is assembled from. `target` covers single-point
 * services (inspection, field service); `origin`/`destination` cover
 * movement services (rideshare, delivery, freight). An app uses the pair it
 * needs and ignores the rest.
 */
export type ServiceRequestDraft = {
  serviceId: string | null;
  target?: Location;
  origin?: Location;
  destination?: Location;
  options?: Record<string, unknown>;
  notes?: string;
};

export type Provider = {
  id: string;
  name: string;
  /** e.g. "Silver Corolla · 7KDR221" or "Technician · Level 2". */
  detail?: string;
  avatarUrl?: string;
  rating?: number;
  latitude?: number;
  longitude?: number;
};

export type Quote = {
  totalCents: number;
  currency?: string;
  lines: { label: string; value: string }[];
};

/** Splits "221B Baker St, London, UK" into a primary line and a locality. */
export function splitAddress(address: string): {
  line: string;
  locality: string;
} {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const [line, ...rest] = parts;
  return { line: line ?? address, locality: rest.join(", ") };
}

/** Post-trip privacy — neighbourhood only, never the door number. */
export function obscureAddress(address: string): string {
  const { locality } = splitAddress(address);
  const city = locality.split(",")[0]?.trim();
  return city ? `${city} area` : "Nearby area";
}

/**
 * Money, always at the currency's own precision.
 *
 * Amounts appear in columns — fare lines, receipts, option prices — and a
 * column that renders "$4" next to "$1.80" reads as a bug in the price, not a
 * choice about zeros. Trimming per-value is what breaks the alignment, so it
 * is not done here.
 */
export function formatMoney(cents: number, currency = "USD", locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/**
 * Money for a live tile: dollars as the numeral, cents as the unit.
 * `$18` / `.40` — glanceable, not a caption.
 */
export function formatMoneyMetric(
  cents: number,
  currency = "USD",
  locale = "en-US",
): { value: string; unit: string } {
  const symbol =
    new Intl.NumberFormat(locale, { style: "currency", currency })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? "$";
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return {
    value: `${negative ? "-" : ""}${symbol}${dollars}`,
    unit: `.${remainder.toString().padStart(2, "0")}`,
  };
}

/**
 * Collapses a request history into recent places, most recent first.
 * Deduplicates by address so the same destination is not listed twice.
 */
export function placesFromHistory(
  history: ReadonlyArray<{
    id: string;
    address: string;
    latitude?: number | null;
    longitude?: number | null;
    at: Date | string;
  }>,
  options: { limit?: number; now?: Date } = {},
): Place[] {
  const { limit = 3, now = new Date() } = options;
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const entry of history) {
    const key = entry.address.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    places.push({
      id: entry.id,
      label: splitAddress(entry.address).line,
      address: entry.address,
      latitude: entry.latitude,
      longitude: entry.longitude,
      source: "recent",
      hint: relativeDay(new Date(entry.at), now),
    });
    if (places.length === limit) break;
  }
  return places;
}

function relativeDay(date: Date, now: Date) {
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}
