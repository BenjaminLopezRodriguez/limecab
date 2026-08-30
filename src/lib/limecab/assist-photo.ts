/**
 * Assist photo → shop context.
 *
 * A vision model (or filename hint) classifies the image. Pure helpers turn
 * that into a pass-in Assist query and shop list. Bytes are also stored in
 * private Vercel Blob when configured so the server keeps a durable URL.
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
  /** Sentence Assist should plan from, e.g. "deliver hex nuts from Home Depot now". */
  query: string;
  items: ShopItem[];
  /** Chains or store names that sell this, e.g. Home Depot. */
  storeHints: string[];
  source: "model" | "filename";
};

export const STORE_HINTS_BY_CATEGORY: Record<
  AssistPhotoCategory,
  readonly string[]
> = {
  hardware: ["Home Depot", "Lowe's"],
  grocery: [],
  pharmacy: ["CVS", "Walgreens"],
  flowers: ["florist"],
  home: ["Home Depot", "Target"],
  other: [],
};

const CATEGORY_SET = new Set<string>(ASSIST_PHOTO_CATEGORIES);

/**
 * Hardware fasteners in a filename — "nut.jpg", "hex-nut.png". Avoids
 * "doughnut". Food nuts are a vision-model job, not a camera roll name.
 */
const FILENAME_HARDWARE =
  /(^|[-_\s])((hex[-_\s]?)?nuts?|bolts?|screws?|washers?|fasteners?|hardware)([-_\s.]|$)/i;

const FILENAME_FLOWERS = /(^|[-_\s])(flowers?|bouquet)([-_\s.]|$)/i;
const FILENAME_GROCERY =
  /(^|[-_\s])(milk|eggs|bread|grocer(?:y|ies)|bananas?)([-_\s.]|$)/i;
/** Stationery — stock PNGs often embed "pencil" / "pen" in the name. */
const FILENAME_STATIONERY =
  /(^|[-_\s])(pencils?|pens?|markers?|highlighters?|erasers?|stationery|notebooks?|staplers?)([-_\s.]|$)/i;

const STATIONERY_STORES = ["Target", "Home Depot"] as const;

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

/** "deliver hex nuts from Home Depot now" — enough for Assist to land shop. */
export function composeShopQuery(
  items?: readonly ShopItem[] | null,
  storeHints?: readonly string[] | null,
): string {
  const itemLine = cleanItems(items ?? undefined)
    .map((item) => item.label)
    .join(" and ");
  const store = cleanHints(storeHints ?? undefined)[0];
  if (itemLine && store) return `deliver ${itemLine} from ${store} now`;
  if (itemLine) return `deliver ${itemLine} now`;
  if (store) return `buy from ${store} now`;
  return "";
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

/**
 * When the vision model is missing or fails, a hardware-ish filename still
 * drives Shop (Home Depot). Generic IMG_1234 names return null.
 */
export function classifyPhotoFilename(
  filename: string,
): AssistPhotoClassification | null {
  const name = basename(filename);
  if (!name) return null;
  if (FILENAME_HARDWARE.test(name)) {
    const hex = /\bhex\b/i.test(name);
    const items: ShopItem[] = [
      { label: hex ? "hex nuts" : /\bnuts?\b/i.test(name) ? "hardware nuts" : "hardware" },
    ];
    if (/\bbolts?\b/i.test(name) && !/\bnuts?\b/i.test(name)) {
      items[0] = { label: "bolts" };
    }
    return {
      category: "hardware",
      query: composeShopQuery(items, STORE_HINTS_BY_CATEGORY.hardware),
      items,
      storeHints: [...STORE_HINTS_BY_CATEGORY.hardware],
      source: "filename",
    };
  }
  if (FILENAME_FLOWERS.test(name)) {
    const items = [{ label: "flowers" }];
    return {
      category: "flowers",
      query: composeShopQuery(items, STORE_HINTS_BY_CATEGORY.flowers),
      items,
      storeHints: [...STORE_HINTS_BY_CATEGORY.flowers],
      source: "filename",
    };
  }
  if (FILENAME_GROCERY.test(name)) {
    const items = [{ label: "groceries" }];
    return {
      category: "grocery",
      query: composeShopQuery(items, undefined),
      items,
      storeHints: [],
      source: "filename",
    };
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
    return {
      category: "home",
      query: composeShopQuery(items, STATIONERY_STORES),
      items,
      storeHints: [...STATIONERY_STORES],
      source: "filename",
    };
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
  if (/\bhome|household|furniture|stationer|office supply\b/.test(key)) return "home";
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
  const storeHints = hintsFromUnknown(
    record.storeHints ?? record.stores ?? record.store,
  );
  const hinted =
    storeHints.length > 0
      ? storeHints
      : [...STORE_HINTS_BY_CATEGORY[category]];
  const query =
    typeof record.query === "string" && record.query.trim()
      ? record.query.trim()
      : composeShopQuery(items, hinted);
  if (!query && items.length === 0 && hinted.length === 0) {
    return fallbackFilename ? classifyPhotoFilename(fallbackFilename) : null;
  }
  const source = record.source === "filename" ? "filename" : "model";
  return {
    category,
    query: withTiming(query),
    items,
    storeHints: hinted,
    source,
  };
}

export function shopItemsFromPhoto(
  classification: AssistPhotoClassification | null | undefined,
): ShopItem[] {
  return cleanItems(classification?.items);
}
