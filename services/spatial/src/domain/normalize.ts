import { ENTITY_TYPES, type EntityType } from "../contract.ts";

/**
 * Deterministic taxonomy. Tables and regex, no model call, no network — a
 * name has to normalize the same way on every replica forever, and a provider
 * type has to mean the same Lime type in a test as at 3am in production.
 */

/** Raw variant → Lime brand key. The key is a display string, lowercased. */
const BRAND_ALIASES: Record<string, string> = {
  "7 eleven": "7-eleven",
  "7-eleven": "7-eleven",
  "711": "7-eleven",
  "7-11": "7-eleven",
  "seven eleven": "7-eleven",
  mcdonalds: "mcdonald's",
  "mcdonald's": "mcdonald's",
  "trader joes": "trader joe's",
  "trader joe's": "trader joe's",
  "sams club": "sam's club",
  "sam's club": "sam's club",
  wendys: "wendy's",
  "wendy's": "wendy's",
  "chick fil a": "chick-fil-a",
  "chick-fil-a": "chick-fil-a",
  "in n out": "in-n-out",
  "in-n-out": "in-n-out",
  "in-n-out burger": "in-n-out",
  starbucks: "starbucks",
  "starbucks coffee": "starbucks",
  target: "target",
  walmart: "walmart",
  "walmart supercenter": "walmart",
  costco: "costco",
  "costco wholesale": "costco",
  cvs: "cvs",
  "cvs pharmacy": "cvs",
  walgreens: "walgreens",
  "rite aid": "rite aid",
  ralphs: "ralphs",
  vons: "vons",
  albertsons: "albertsons",
  safeway: "safeway",
  kroger: "kroger",
  aldi: "aldi",
  "whole foods": "whole foods",
  "whole foods market": "whole foods",
  "home depot": "home depot",
  "the home depot": "home depot",
  lowes: "lowe's",
  "best buy": "best buy",
  "dollar tree": "dollar tree",
  "dollar general": "dollar general",
  shell: "shell",
  chevron: "chevron",
  arco: "arco",
  mobil: "mobil",
  dunkin: "dunkin'",
  "dunkin donuts": "dunkin'",
  subway: "subway",
  "taco bell": "taco bell",
  kfc: "kfc",
  "burger king": "burger king",
  "jack in the box": "jack in the box",
};

/** Brand key → how the brand is written when we print it. */
const BRAND_DISPLAY: Record<string, string> = {
  "7-eleven": "7-Eleven",
  "mcdonald's": "McDonald's",
  "trader joe's": "Trader Joe's",
  "sam's club": "Sam's Club",
  "wendy's": "Wendy's",
  "chick-fil-a": "Chick-fil-A",
  "in-n-out": "In-N-Out",
  "dunkin'": "Dunkin'",
  kfc: "KFC",
  cvs: "CVS",
};

/** What a human types when they mean a Lime entity type. */
const CATEGORY_ALIASES: Record<string, EntityType> = {
  coffee: "cafe",
  "coffee shop": "cafe",
  cafe: "cafe",
  gas: "gas_station",
  "gas station": "gas_station",
  fuel: "gas_station",
  grocery: "grocery_store",
  groceries: "grocery_store",
  supermarket: "grocery_store",
  "grocery store": "grocery_store",
  convenience: "convenience_store",
  "corner store": "convenience_store",
  "convenience store": "convenience_store",
  drugstore: "pharmacy",
  pharmacy: "pharmacy",
  food: "restaurant",
  restaurant: "restaurant",
  hotel: "hotel",
  motel: "hotel",
  parking: "parking",
  park: "park",
  store: "retail_store",
  shop: "retail_store",
  hospital: "hospital",
  school: "school",
  university: "university",
  airport: "airport",
  transit: "transit_station",
};

/** Provider type strings (Google types, Mapbox categories) → Lime type. */
const PROVIDER_TYPE_MAP: Record<string, EntityType> = {
  supermarket: "grocery_store",
  grocery_store: "grocery_store",
  grocery: "grocery_store",
  convenience_store: "convenience_store",
  convenience: "convenience_store",
  pharmacy: "pharmacy",
  drugstore: "pharmacy",
  restaurant: "restaurant",
  fast_food: "restaurant",
  meal_takeaway: "restaurant",
  food: "restaurant",
  cafe: "cafe",
  coffee: "cafe",
  coffee_shop: "cafe",
  gas_station: "gas_station",
  fuel: "gas_station",
  parking: "parking",
  parking_lot: "parking",
  school: "school",
  primary_school: "school",
  secondary_school: "school",
  university: "university",
  college: "university",
  hospital: "hospital",
  doctor: "hospital",
  lodging: "hotel",
  hotel: "hotel",
  motel: "hotel",
  airport: "airport",
  international_airport: "airport",
  transit_station: "transit_station",
  bus_station: "transit_station",
  subway_station: "transit_station",
  train_station: "transit_station",
  light_rail_station: "transit_station",
  local_government_office: "government",
  city_hall: "government",
  post_office: "government",
  government: "government",
  movie_theater: "entertainment",
  amusement_park: "entertainment",
  night_club: "entertainment",
  bar: "entertainment",
  stadium: "entertainment",
  park: "park",
  street_address: "address",
  address: "address",
  premise: "address",
  department_store: "retail_store",
  clothing_store: "retail_store",
  hardware_store: "retail_store",
  electronics_store: "retail_store",
  shopping_mall: "retail_store",
  store: "retail_store",
  retail: "retail_store",
};

const ENTITY_TYPE_SET = new Set<string>(ENTITY_TYPES);

/** Lowercase, de-accent, collapse space. Apostrophes and hyphens survive
 *  because "mcdonald's" and "7-eleven" are the brand keys we ship. */
export function normalizeText(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9'\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * "Target - Rosemead" and "Target Store #1234" are the same brand at two
 * addresses. Drop the location tail, then the store-number suffix.
 */
export function stripLocationTail(raw: string): string {
  const head = raw.split(/\s+[-–—@|]\s+/)[0] ?? raw;
  return head
    .replace(/\s*[(（][^)）]*[)）]\s*$/g, "")
    .replace(/\s*[#№]\s*\d+\s*$/i, "")
    .replace(/\s+(?:store|no\.?|number|unit|ste\.?|suite)\s*\d*\s*$/i, "")
    .replace(/[\s,]+$/, "")
    .trim();
}

export function brandKeyFor(name: string): string | null {
  const words = normalizeText(name).split(" ").filter(Boolean);
  // Longest prefix wins: "trader joe's market" is Trader Joe's, not "trader".
  for (let take = words.length; take > 0; take -= 1) {
    const key = BRAND_ALIASES[words.slice(0, take).join(" ")];
    if (key) return key;
  }
  return null;
}

export function categoryAlias(term: string): EntityType | null {
  const key = normalizeText(term);
  if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];
  return ENTITY_TYPE_SET.has(key.replace(/\s/g, "_"))
    ? (key.replace(/\s/g, "_") as EntityType)
    : null;
}

/** Raw provider types → one Lime type. First recognised type wins. */
export function entityTypeFor(rawTypes: readonly string[]): EntityType {
  for (const raw of rawTypes) {
    const mapped = PROVIDER_TYPE_MAP[normalizeText(raw).replace(/\s/g, "_")];
    if (mapped) return mapped;
  }
  return "generic_place";
}

export type NormalizedPlace = {
  canonicalName: string;
  shortName: string;
  normalizedName: string;
  brandKey: string | null;
  entityType: EntityType;
  entitySubtype: string | null;
};

export function normalizePlace(input: {
  name: string;
  rawTypes: readonly string[];
}): NormalizedPlace {
  const shortName = stripLocationTail(input.name) || input.name.trim();
  const brandKey = brandKeyFor(shortName);
  return {
    canonicalName: brandKey
      ? (BRAND_DISPLAY[brandKey] ?? titleCase(brandKey))
      : shortName,
    shortName,
    normalizedName: normalizeText(shortName),
    brandKey,
    entityType: entityTypeFor(input.rawTypes),
    entitySubtype: input.rawTypes[0] ?? null,
  };
}

/** A free-text query is only ever read for a brand and a category. */
export function readQuery(query: string): {
  brandKey: string | null;
  entityTypes: EntityType[];
  normalized: string;
} {
  const normalized = normalizeText(query);
  const words = normalized.split(" ").filter(Boolean);
  const entityTypes = new Set<EntityType>();
  for (let i = 0; i < words.length; i += 1) {
    for (const size of [2, 1]) {
      const type = categoryAlias(words.slice(i, i + size).join(" "));
      if (type) entityTypes.add(type);
    }
  }
  // A query says the brand anywhere ("nearest target"), so scan windows;
  // a place name says it first, so `brandKeyFor` stays prefix-anchored.
  let brandKey: string | null = null;
  for (let i = 0; i < words.length && !brandKey; i += 1) {
    brandKey = brandKeyFor(words.slice(i).join(" "));
  }
  return { brandKey, entityTypes: [...entityTypes], normalized };
}

function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
