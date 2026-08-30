/**
 * Colloquial place search → structured intent.
 *
 * DeepSeek fills this on the server when a key is present. The heuristic
 * here is the fallback, and the shared schema either way.
 */

export type PlaceIntent = {
  /** Brand or POI, expanded when we know it ("711" → "7-Eleven"). */
  poi: string;
  /** Street or road the place is on. */
  street: string | null;
  /** Neighborhood, city, or district. */
  area: string | null;
  /** Relative landmark ("chinese restaurant"). */
  landmark: string | null;
  /** Rider asked for the nearest match. */
  closest: boolean;
  /** Rider asked for something nearby / near me. */
  nearby: boolean;
};

const BRANDS: ReadonlyArray<{ match: RegExp; poi: string }> = [
  { match: /\b(7\s*-?\s*11|7\s*eleven|711)\b/i, poi: "7-Eleven" },
  { match: /\b(mc\s*donald'?s?|mcdonalds)\b/i, poi: "McDonald's" },
  { match: /\bhome\s*depot\b/i, poi: "Home Depot" },
  { match: /\bin\s*-?\s*n\s*-?\s*out\b/i, poi: "In-N-Out" },
  { match: /\bwal\s*-?\s*mart\b/i, poi: "Walmart" },
  { match: /\bwalgreens\b/i, poi: "Walgreens" },
  { match: /\bstarbucks\b/i, poi: "Starbucks" },
  { match: /\btarget\b/i, poi: "Target" },
  { match: /\bcvs\b/i, poi: "CVS" },
];

const LANDMARK_ALIASES: ReadonlyArray<{ match: RegExp; name: string }> = [
  { match: /\bchinese\s+(?:place|spot|food|resto|restaurant)\b/i, name: "Chinese restaurant" },
  { match: /\bmexican\s+(?:place|spot|food|resto|restaurant)\b/i, name: "Mexican restaurant" },
  { match: /\bthai\s+(?:place|spot|food|resto|restaurant)\b/i, name: "Thai restaurant" },
];

const FILLER =
  /\b(that|the one|the|a|an|closest|nearest|nearby|near me|around here|close by|please|like)\b/gi;

const STREET_SUFFIX =
  /\s+(dr|drive|ave|avenue|blvd|boulevard|st|street|rd|road|way|ln|lane|ct|court|pkwy|parkway)\.?$/i;

export function emptyPlaceIntent(): PlaceIntent {
  return {
    poi: "",
    street: null,
    area: null,
    landmark: null,
    closest: false,
    nearby: false,
  };
}

/** Expand a known shorthand after DeepSeek or the heuristic. */
export function expandPoi(poi: string): string {
  const trimmed = poi.trim();
  if (!trimmed) return "";
  for (const brand of BRANDS) {
    if (brand.match.test(trimmed)) return brand.poi;
  }
  return trimmed.replace(/\s+/g, " ");
}

export function expandLandmark(landmark: string | null): string | null {
  if (!landmark) return null;
  const trimmed = landmark.trim();
  if (!trimmed) return null;
  for (const alias of LANDMARK_ALIASES) {
    if (alias.match.test(trimmed)) return alias.name;
  }
  return trimmed.replace(/\s+/g, " ");
}

/**
 * Vendor text query: brand plus any street/area constraint.
 * "McDonald's" + "Las Tunas" → "McDonald's Las Tunas".
 */
export function vendorQueryFor(intent: PlaceIntent, fallback: string): string {
  const parts = [intent.poi, intent.street, intent.area]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  const joined = parts.join(" ").replace(/\s+/g, " ").trim();
  return joined || fallback.trim();
}

export function parsePlaceIntent(query: string): PlaceIntent {
  const raw = query.trim();
  if (!raw) return emptyPlaceIntent();

  const closest = /\b(closest|nearest)\b/i.test(raw);
  const nearby = /\b(nearby|near me|around here|close by)\b/i.test(raw);
  const street = matchStreet(raw);
  const landmark = expandLandmark(matchLandmark(raw));
  const brand = matchBrand(raw);

  let remainder = raw;
  if (street) {
    remainder = remainder.replace(streetPhrase(street), " ");
  }
  if (landmark) {
    remainder = remainder.replace(
      /\b(?:next to|next|beside|across from|by that|by)\s+(?:that\s+)?.+$/i,
      " ",
    );
  }
  remainder = remainder.replace(FILLER, " ").replace(/\s+/g, " ").trim();

  const poi = expandPoi(brand ?? remainder);

  return {
    poi,
    street,
    area: null,
    landmark,
    closest,
    nearby,
  };
}

/** DeepSeek is worth the wait only when the query is doing more than a name. */
export function needsModelParse(query: string, intent: PlaceIntent): boolean {
  if (intent.street || intent.landmark || intent.closest || intent.nearby) {
    return true;
  }
  return query.trim().split(/\s+/).filter(Boolean).length >= 4;
}

function matchBrand(query: string): string | null {
  for (const brand of BRANDS) {
    if (brand.match.test(query)) return brand.poi;
  }
  return null;
}

function matchStreet(query: string): string | null {
  const onStreet = query.match(
    /\b(?:the one\s+)?on\s+([A-Za-z0-9][A-Za-z0-9 .'-]{1,40}?)(?:\s*,|\s+near\b|\s+nearby\b|\s+next\b|$)/i,
  );
  if (!onStreet?.[1]) return null;
  return tidyStreet(onStreet[1]);
}

function streetPhrase(street: string): RegExp {
  const escaped = street.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `\\b(?:the one\\s+)?on\\s+${escaped}(?:\\s+(?:dr|drive|ave|avenue|blvd|boulevard|st|street|rd|road|way|ln|lane))?\\b`,
    "i",
  );
}

function tidyStreet(value: string): string {
  return value
    .replace(STREET_SUFFIX, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchLandmark(query: string): string | null {
  const relative = query.match(
    /\b(?:next to|next|beside|across from|by that)\s+(?:that\s+)?(.+?)(?:\s+nearby|\s+near me)?$/i,
  );
  const captured = relative?.[1]?.trim();
  if (!captured) return null;
  return captured.replace(/\s+/g, " ");
}
