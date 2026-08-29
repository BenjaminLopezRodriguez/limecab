/**
 * Local ride-utterance parser. No vendor, no network.
 *
 * Hands-full booking still ends on Confirm — this only fills a destination
 * and a product hint from fixtures and keywords.
 */

export type RideProductHint =
  "lime" | "lime-xl" | "lime-comfort" | "lime-pool" | "lime-wait-save";

export type RideUtterance = {
  destinationQuery: string | null;
  productHint: RideProductHint;
  notes: string[];
};

export type UtterancePlace = {
  /** Geocode-friendly query, e.g. "LAX Terminal 4". */
  query: string;
  aliases: readonly string[];
};

const FILLER =
  /\b(take me to|take me|i need a ride to|i need|book me|book|ride to|to the|please|for me|in an|in a)\b/gi;

const PRODUCT_RULES: {
  hint: RideProductHint;
  pattern: RegExp;
  note: string;
}[] = [
  {
    hint: "lime-xl",
    pattern: /\b(xl|bags?|luggage|six people|6 people)\b/i,
    note: "XL",
  },
  {
    hint: "lime-wait-save",
    pattern: /\bwait\s*(?:&|and)\s*save\b/i,
    note: "Wait & Save",
  },
  {
    hint: "lime-pool",
    pattern: /\b(cheap|pool|share|shared)\b/i,
    note: "Pool",
  },
  {
    hint: "lime-comfort",
    pattern: /\b(comfort|quiet)\b/i,
    note: "Comfort",
  },
];

const DEFAULT_PLACES: UtterancePlace[] = [
  { query: "LAX Terminal 4", aliases: ["lax", "airport", "terminal 4"] },
  { query: "Home", aliases: ["home"] },
  { query: "Work", aliases: ["work"] },
  { query: "Union Station", aliases: ["union station", "union"] },
  { query: "Griffith Observatory", aliases: ["griffith", "observatory"] },
  { query: "Santa Monica Pier", aliases: ["pier", "santa monica"] },
  { query: "Dodger Stadium", aliases: ["dodger", "dodgers", "stadium"] },
  { query: "Pasadena", aliases: ["pasadena"] },
];

export function parseRideUtterance(
  text: string,
  places: readonly UtterancePlace[] = DEFAULT_PLACES,
): RideUtterance {
  const raw = text.trim();
  const notes: string[] = [];
  let productHint: RideProductHint = "lime";

  for (const rule of PRODUCT_RULES) {
    if (rule.pattern.test(raw)) {
      productHint = rule.hint;
      notes.push(rule.note);
      break;
    }
  }

  const stripped = raw
    .replace(FILLER, " ")
    .replace(
      /\b(xl|bags?|luggage|six people|6 people|wait\s*(?:&|and)\s*save|cheap|pool|share|shared|comfort|quiet)\b/gi,
      " ",
    )
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const destinationQuery = matchPlace(stripped, places);

  return { destinationQuery, productHint, notes };
}

function matchPlace(
  remainder: string,
  places: readonly UtterancePlace[],
): string | null {
  if (!remainder) return null;

  let best: { query: string; score: number } | null = null;
  for (const place of places) {
    for (const alias of [place.query, ...place.aliases]) {
      const needle = alias.toLowerCase();
      if (!needle) continue;
      if (remainder === needle || remainder.includes(needle)) {
        const score = needle.length;
        if (!best || score > best.score) best = { query: place.query, score };
      }
    }
  }
  return best?.query ?? null;
}
