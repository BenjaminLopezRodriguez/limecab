/**
 * Assist photo → shop context.
 *
 * Vision classifies the image; filename is a soft item-label fallback only.
 * Store choice is resolved against real nearby/fixture candidates — closest
 * place that might sell the item — not a canned chain from a switch.
 */

import type { ShopItem } from "./shop-list.ts";

export const ASSIST_PHOTO_CATEGORIES = [
  "hardware",
  "grocery",
  "pharmacy",
  "flowers",
  "home",
  "other",
] as const;

export type AssistPhotoCategory = (typeof ASSIST_PHOTO_CATEGORIES)[number];

export type AssistPhotoClassification = {
  category: AssistPhotoCategory;
  /** Sentence Assist should plan from, e.g. "deliver hex nuts now". */
  query: string;
  items: ShopItem[];
  /**
   * Soft store *types* or optional chain suggestions (hardware store,
   * office supply, Target). Planning matches these against real places.
   */
  storeHints: string[];
  source: "model" | "filename";
};

/** Soft type labels — not locked chain destinations. */
export const STORE_TYPES_BY_CATEGORY: Record<
  AssistPhotoCategory,
  readonly string[]
> = {
  hardware: ["hardware store", "home improvement"],
  grocery: ["grocery", "supermarket"],
  pharmacy: ["pharmacy"],
  flowers: ["florist"],
  home: ["office supply", "general merchandise", "home goods"],
  other: [],
};

/** @deprecated alias — prefer STORE_TYPES_BY_CATEGORY */
export const STORE_HINTS_BY_CATEGORY = STORE_TYPES_BY_CATEGORY;

const CATEGORY_SET = new Set<string>(ASSIST_PHOTO_CATEGORIES);

/** Keywords that mark a real place as viable for a photo category. */
const PLACE_KEYWORDS_BY_CATEGORY: Record<
  AssistPhotoCategory,
  readonly string[]
> = {
  hardware: ["home depot", "lowe", "ace hardware", "hardware"],
  grocery: [
    "vons",
    "ralphs",
    "trader joe",
    "whole foods",
    "grocery",
    "market",
    "supermarket",
    "superior",
  ],
  pharmacy: ["cvs", "walgreens", "pharmacy", "drug"],
  flowers: ["florist", "flower", "plant shop", "nursery"],
  home: [
    "target",
    "walmart",
    "office depot",
    "staples",
    "office supply",
    "home depot",
    "lowe",
  ],
  other: [],
};

/**
 * Soft filename tokens → item label only. No chain lock.
 * Avoids doughnut for "nut". Generic IMG_1234 → null.
 */
const FILENAME_HARDWARE =
  /(^|[-_\s])((hex[-_\s]?)?nuts?|bolts?|screws?|washers?|fasteners?|hardware)([-_\s.]|$)/i;
const FILENAME_FLOWERS = /(^|[-_\s])(flowers?|bouquet)([-_\s.]|$)/i;
const FILENAME_GROCERY =
  /(^|[-_\s])(milk|eggs|bread|grocer(?:y|ies)|bananas?)([-_\s.]|$)/i;
const FILENAME_STATIONERY =
  /(^|[-_\s])(pencils?|pens?|markers?|highlighters?|erasers?|stationery|notebooks?|staplers?)([-_\s.]|$)/i;

const EARTH_M = 111_320;

export type PhotoStoreCandidate = {
  address: string;
  latitude?: number;
  longitude?: number;
  label?: string;
  /** Optional place category from Mapbox/fixtures (hardware_store, grocery…). */
  category?: string;
};

function basename(filename: string): string {
  const slash = Math.max(filename.lastIndexOf("/"), filename.lastIndexOf("\\"));
  const base = slash >= 0 ? filename.slice(slash + 1) : filename;
  return base.replace(/\.[a-z0-9]+$/i, "");
}

function cleanItems(items: readonly ShopItem[] | undefined): ShopItem[] {
  const out: ShopItem[] = [];
  for (const item of items ?? []) {
    const label = item.label.trim().slice(0, 80);
    if (!label) continue;
    const next: ShopItem = { label };
    if (item.note?.trim()) next.note = item.note.trim().slice(0, 80);
    if (typeof item.qty === "number" && item.qty > 1) next.qty = item.qty;
    out.push(next);
    if (out.length >= 12) break;
  }
  return out;
}

function cleanHints(hints: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const hint of hints ?? []) {
    const label = hint.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= 6) break;
  }
  return out;
}

/** "deliver hex nuts now" — store resolved later against real places. */
export function composeShopQuery(
  items?: readonly ShopItem[] | null,
  storeHints?: readonly string[] | null,
): string {
  const itemLine = cleanItems(items ?? undefined)
    .map((item) => item.label)
    .join(" and ");
  // Only name a store in the sentence when the hint looks like a proper place
  // (Target, Home Depot) — not a soft type ("hardware store").
  const store = cleanHints(storeHints ?? undefined).find((hint) =>
    looksLikePlaceName(hint),
  );
  if (itemLine && store) return `deliver ${itemLine} from ${store} now`;
  if (itemLine) return `deliver ${itemLine} now`;
  if (store) return `buy from ${store} now`;
  return "";
}

function looksLikePlaceName(hint: string): boolean {
  const lower = hint.toLowerCase();
  if (
    /\b(store|shop|supply|merchandise|goods|supermarket|improvement|pharmacy|florist|grocery)\b/i.test(
      lower,
    )
  ) {
    return false;
  }
  return /[A-Z]/.test(hint) || /\b(target|home depot|lowe'?s|cvs|walgreens|vons|ralphs)\b/i.test(lower);
}

function withTiming(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return "";
  if (/\b(now|later|tonight|tomorrow|schedule|asap)\b/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed} now`;
}

export function assistQueryFromPhoto(
  classification: AssistPhotoClassification,
): string {
  const fromModel = withTiming(classification.query);
  if (fromModel) return fromModel;
  return composeShopQuery(classification.items, classification.storeHints);
}

function softClassification(
  category: AssistPhotoCategory,
  items: ShopItem[],
): AssistPhotoClassification {
  const storeHints = [...STORE_TYPES_BY_CATEGORY[category]];
  return {
    category,
    query: composeShopQuery(items, storeHints),
    items,
    storeHints,
    source: "filename",
  };
}

/**
 * Soft fallback when vision is unavailable. Extracts an item label from the
 * filename — never locks a destination chain.
 */
export function classifyPhotoFilename(
  filename: string,
): AssistPhotoClassification | null {
  const name = basename(filename);
  if (!name) return null;
  if (FILENAME_HARDWARE.test(name)) {
    const hex = /\bhex\b/i.test(name);
    const items: ShopItem[] = [
      {
        label: hex
          ? "hex nuts"
          : /\bnuts?\b/i.test(name)
            ? "hardware nuts"
            : "hardware",
      },
    ];
    if (/\bbolts?\b/i.test(name) && !/\bnuts?\b/i.test(name)) {
      items[0] = { label: "bolts" };
    }
    return softClassification("hardware", items);
  }
  if (FILENAME_FLOWERS.test(name)) {
    return softClassification("flowers", [{ label: "flowers" }]);
  }
  if (FILENAME_GROCERY.test(name)) {
    return softClassification("grocery", [{ label: "groceries" }]);
  }
  if (FILENAME_STATIONERY.test(name)) {
    const pencil = /\bpencils?\b/i.test(name);
    const pen = /\bpens?\b/i.test(name) && !pencil;
    const items: ShopItem[] = [
      {
        label: pencil
          ? "pencils"
          : pen
            ? "pens"
            : /\bmarkers?\b/i.test(name)
              ? "markers"
              : "stationery",
      },
    ];
    return softClassification("home", items);
  }
  return null;
}

function asCategory(value: unknown): AssistPhotoCategory | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  if (CATEGORY_SET.has(key)) return key as AssistPhotoCategory;
  if (/\bhardware|fastener|diy|lumber\b/.test(key)) return "hardware";
  if (/\bflower|florist|bouquet\b/.test(key)) return "flowers";
  if (/\bpharm|drug\b/.test(key)) return "pharmacy";
  if (/\bgrocer|food|supermarket\b/.test(key)) return "grocery";
  if (/\bhome|household|furniture|stationer|office supply\b/.test(key)) {
    return "home";
  }
  return "other";
}

function itemsFromUnknown(value: unknown): ShopItem[] {
  if (!Array.isArray(value)) {
    if (typeof value === "string" && value.trim()) return [{ label: value.trim() }];
    return [];
  }
  return cleanItems(
    value.flatMap((entry) => {
      if (typeof entry === "string") return [{ label: entry }];
      if (entry && typeof entry === "object" && "label" in entry) {
        const label = (entry as { label?: unknown }).label;
        const qty = (entry as { qty?: unknown }).qty;
        const note = (entry as { note?: unknown }).note;
        if (typeof label !== "string") return [];
        const item: ShopItem = { label };
        if (typeof note === "string") item.note = note;
        if (typeof qty === "number") item.qty = qty;
        return [item];
      }
      return [];
    }),
  );
}

function hintsFromUnknown(value: unknown): string[] {
  if (typeof value === "string") return cleanHints([value]);
  if (!Array.isArray(value)) return [];
  return cleanHints(value.filter((entry): entry is string => typeof entry === "string"));
}

/** Coerce model JSON (or a partial) into the wire shape. */
export function normalizePhotoClassification(
  raw: unknown,
  fallbackFilename?: string,
): AssistPhotoClassification | null {
  if (!raw || typeof raw !== "object") {
    return fallbackFilename ? classifyPhotoFilename(fallbackFilename) : null;
  }
  const record = raw as Record<string, unknown>;
  const category = asCategory(record.category) ?? "other";
  const items = itemsFromUnknown(record.items ?? record.labels);
  const fromModel = hintsFromUnknown(
    record.storeHints ?? record.stores ?? record.store,
  );
  const storeHints =
    fromModel.length > 0
      ? fromModel
      : [...STORE_TYPES_BY_CATEGORY[category]];
  const query =
    typeof record.query === "string" && record.query.trim()
      ? record.query.trim()
      : composeShopQuery(items, storeHints);
  if (!query && items.length === 0 && storeHints.length === 0) {
    return fallbackFilename ? classifyPhotoFilename(fallbackFilename) : null;
  }
  const source = record.source === "filename" ? "filename" : "model";
  return {
    category,
    query: withTiming(query),
    items,
    storeHints,
    source,
  };
}

export function shopItemsFromPhoto(
  classification: AssistPhotoClassification | null | undefined,
): ShopItem[] {
  return cleanItems(classification?.items);
}

export function metersBetweenPlaces(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = (b.latitude - a.latitude) * EARTH_M;
  const dLng =
    (b.longitude - a.longitude) *
    EARTH_M *
    Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

function placeHaystack(store: PhotoStoreCandidate): string {
  return `${store.label ?? ""} ${store.address} ${store.category ?? ""}`.toLowerCase();
}

/**
 * How well a real place matches photo classification (higher = more likely
 * to sell the item). Soft type hints and category keywords both count.
 */
export function scoreStoreForPhoto(
  store: PhotoStoreCandidate,
  classification: Pick<
    AssistPhotoClassification,
    "category" | "storeHints" | "items"
  >,
): number {
  const hay = placeHaystack(store);
  if (!hay.trim()) return 0;
  let score = 0;

  for (const hint of classification.storeHints) {
    const token = hint.trim().toLowerCase();
    if (!token) continue;
    if (hay.includes(token)) score += 12;
    else {
      const parts = token.split(/\s+/).filter((part) => part.length > 2);
      if (parts.length > 0 && parts.every((part) => hay.includes(part))) {
        score += 8;
      }
    }
  }

  for (const keyword of PLACE_KEYWORDS_BY_CATEGORY[classification.category]) {
    if (hay.includes(keyword)) score += 6;
  }

  // Fixture / Mapbox category tags
  const placeCat = (store.category ?? "").toLowerCase();
  if (
    classification.category === "hardware" &&
    /hardware/.test(placeCat)
  ) {
    score += 10;
  }
  if (
    classification.category === "grocery" &&
    /grocery|supermarket|food/.test(placeCat)
  ) {
    score += 10;
  }
  if (
    classification.category === "pharmacy" &&
    /pharm|drug/.test(placeCat)
  ) {
    score += 10;
  }
  if (
    classification.category === "flowers" &&
    /florist|flower|plant/.test(placeCat)
  ) {
    score += 10;
  }
  if (
    classification.category === "home" &&
    /department|general|office|home/.test(placeCat)
  ) {
    score += 4;
  }

  return score;
}

export type RankedPhotoStore = PhotoStoreCandidate & {
  matchScore: number;
  meters: number | null;
};

/**
 * Rank real store candidates for a photo classification. Viable matches
 * (matchScore > 0) sort closest-first when origin coords exist.
 */
export function rankStoresForPhoto(
  classification: Pick<
    AssistPhotoClassification,
    "category" | "storeHints" | "items"
  >,
  candidates: readonly PhotoStoreCandidate[],
  origin?: { latitude: number; longitude: number } | null,
): RankedPhotoStore[] {
  const ranked = candidates.map((store) => {
    const hasCoords =
      typeof store.latitude === "number" &&
      typeof store.longitude === "number" &&
      origin &&
      Number.isFinite(origin.latitude) &&
      Number.isFinite(origin.longitude);
    return {
      ...store,
      matchScore: scoreStoreForPhoto(store, classification),
      meters: hasCoords
        ? metersBetweenPlaces(origin, {
            latitude: store.latitude!,
            longitude: store.longitude!,
          })
        : null,
    };
  });

  const viable = ranked.filter((entry) => entry.matchScore > 0);
  const pool = viable.length > 0 ? viable : [];

  pool.sort((a, b) => {
    if (a.meters != null && b.meters != null && Math.abs(a.meters - b.meters) > 40) {
      return a.meters - b.meters;
    }
    if (a.meters != null && b.meters == null) return -1;
    if (a.meters == null && b.meters != null) return 1;
    return b.matchScore - a.matchScore;
  });

  return pool;
}

/** Closest viable store for the classified item, or null if none match. */
export function pickClosestStoreForPhoto(
  classification: Pick<
    AssistPhotoClassification,
    "category" | "storeHints" | "items"
  >,
  candidates: readonly PhotoStoreCandidate[],
  origin?: { latitude: number; longitude: number } | null,
): PhotoStoreCandidate | null {
  return rankStoresForPhoto(classification, candidates, origin)[0] ?? null;
}
