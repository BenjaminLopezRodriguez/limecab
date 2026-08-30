/**
 * Assist omnisearch — structured plans the overlay can render or land.
 *
 * The model runs on the server. This module is the shared shape plus the
 * heuristic fallback used when DeepSeek is missing or times out.
 */

import { splitAssistMessage } from "./assist-message.ts";
import {
  pickClosestStoreForPhoto,
  type AssistPhotoCategory,
} from "./assist-photo.ts";
import {
  resolveAssistTextcon,
  textconIdForPlan,
  type AssistServiceId,
} from "./assist-textcon.ts";
import { formatPickupClock, upcomingHalfHours } from "./reserve.ts";
import {
  classifySearchQuery,
  type ClassifiedQuery,
  type SearchIntent,
} from "./search-intent.ts";
import type { ShopItem } from "./shop-list.ts";

/** Heuristic pins only. Live Assist still resolves through Mapbox/Google. */
const KNOWN_PLACES: AssistPlace[] = [
  {
    address: "Griffith Observatory, Los Angeles",
    latitude: 34.1184,
    longitude: -118.3004,
    label: "Los Feliz",
  },
  {
    address: "LAX Terminal 4, Los Angeles",
    latitude: 33.9416,
    longitude: -118.4085,
    label: "Airport",
  },
  {
    address: "Santa Monica Pier, Santa Monica",
    latitude: 34.0094,
    longitude: -118.4973,
    label: "Beach",
  },
  {
    address: "Dodger Stadium, Los Angeles",
    latitude: 34.0739,
    longitude: -118.24,
    label: "Elysian Park",
  },
  {
    address: "Echo Park Ave, Los Angeles",
    latitude: 34.0782,
    longitude: -118.2606,
    label: "Echo Park",
  },
];

const KNOWN_STORES: AssistPlace[] = [
  {
    address: "Grand Central Market, S Broadway, Los Angeles",
    latitude: 34.0508,
    longitude: -118.249,
    label: "Grand Central Market",
  },
  {
    address: "Vons, 1430 S Fair Oaks Ave, Pasadena",
    latitude: 34.1288,
    longitude: -118.1497,
    label: "Vons",
  },
  {
    address: "Ralphs, 645 W 9th St, Los Angeles",
    latitude: 34.0435,
    longitude: -118.2609,
    label: "Ralphs",
  },
  {
    address: "Trader Joe's, 610 S Arroyo Pkwy, Pasadena",
    latitude: 34.1385,
    longitude: -118.1489,
    label: "Trader Joe's",
  },
  {
    address: "Sunset Plant Shop, Sunset Blvd, Los Angeles",
    latitude: 34.0869,
    longitude: -118.2694,
    label: "Florist",
  },
  {
    address: "The Home Depot, 500 S Alameda St, Los Angeles",
    latitude: 34.0407,
    longitude: -118.2384,
    label: "Home Depot",
  },
  {
    address: "Lowe's, 4550 E Olympic Blvd, Los Angeles",
    latitude: 34.0194,
    longitude: -118.1756,
    label: "Lowe's",
  },
  {
    address: "Target, 735 S Figueroa St, Los Angeles",
    latitude: 34.0485,
    longitude: -118.2606,
    label: "Target",
  },
];

export type { AssistServiceId };
export type AssistKind = "ride" | "shop" | "courier" | "help" | "reserve";

/** Whether a shop plan is immediate delivery or scheduled for later. */
export type AssistTiming = "now" | "scheduled";

export type AssistPlace = {
  address: string;
  latitude?: number;
  longitude?: number;
  label?: string;
};

export type AssistPlan = {
  kind: AssistKind;
  confidence: "high" | "low";
  title: string;
  subtitle?: string;
  /** Shop only: deliver now vs reserve for later. */
  timing?: AssistTiming;
  destination?: AssistPlace;
  pickup?: AssistPlace;
  store?: AssistPlace;
  items?: ShopItem[];
};

export type AssistCard = {
  id: string;
  plan: AssistPlan;
};

/** Chip/mosaic entry. Same payload as a card; title lives on the plan. */
export type AssistSuggestion = AssistCard;

export type AssistTextconRef = {
  id: string;
  service: AssistServiceId;
  label?: string;
};

export type AssistResponse = {
  mode: "land" | "cards" | "reply";
  query: string;
  /** Conversational reply; may include {{textcon:id}} markers. */
  message: string;
  textcons?: AssistTextconRef[];
  suggestions: AssistSuggestion[];
  plan?: AssistPlan;
  /** @deprecated same as suggestions — kept so older clients still parse. */
  cards: AssistCard[];
};

const SHOP_ITEM =
  /\b(beef|milk|eggs|bread|bananas?|groceries|chicken|rice|oat milk|apples?|coffee|water|flowers?|bouquet|pencils?|pens?|markers?|stationery|notebooks?)\b/i;
/** Fasteners — "nuts" alone is food; require hex/hardware or bolt/screw. */
const HARDWARE_ITEM =
  /\b((?:hex|lag|machine|wood|cap|lock)[\s-]?nuts?|hardware nuts?|bolts?|screws?|washers?|fasteners?|hardware)\b/i;
const FLOWERS = /\b(flowers?|bouquet)\b/i;
const BUY = /\b(buy|get me|pick up some|need some|need a|need more|order)\b/i;
const STORE_NAME =
  /\b(vons|ralphs|trader joe'?s?|cvs|walgreens|whole foods|superior grocers|grand central|florist|home depot|lowe'?s|ace hardware|hardware store|target)\b/i;
const HARDWARE_CUE =
  /\b(home depot|lowe'?s|ace hardware|hardware store|hardware)\b/i;
/** Assist-only. Must not catch "help me get to LAX" (that's a ride). */
const HELP_TASK =
  /\b(help me (?:move|lift|carry)|move (?:a |the )?(?:couch|sofa|furniture)|heavy lifting)\b/i;
const IMMEDIATE =
  /\b(now|asap|right away|immediately|this moment|deliver now|order now)\b/i;
const SCHEDULED =
  /\b(later|tonight|tomorrow|this evening|schedule|book ahead|for tonight|for later)\b/i;

const ITEM_SPLIT = /(?:,|\band\b|\bthen\b)/i;

/** Parse whether the rider wants delivery now or scheduled for later. */
export function parseAssistTiming(query: string): AssistTiming {
  if (IMMEDIATE.test(query)) return "now";
  if (SCHEDULED.test(query)) return "scheduled";
  if (/\border\b/i.test(query)) return "scheduled";
  if (/\bdeliver(?:y|ing)?\b/i.test(query)) return "now";
  return "now";
}

/** Best-effort half-hour slot from words like "tonight" or "tomorrow". */
export function scheduledTimeFromQuery(
  query: string,
  from = new Date(),
): Date | null {
  if (/\btomorrow\b/i.test(query)) {
    return upcomingHalfHours("tomorrow", 1, from)[0] ?? null;
  }
  const today = upcomingHalfHours("today", 48, from);
  if (/\b(tonight|this evening)\b/i.test(query)) {
    return today.find((slot) => slot.getHours() >= 18) ?? today.at(-1) ?? null;
  }
  if (SCHEDULED.test(query)) {
    return today[0] ?? null;
  }
  return null;
}

/** Assist-only extras on top of the shared classifier. Ride search is unchanged. */
export function classifyAssistQuery(text: string): ClassifiedQuery {
  const base = classifySearchQuery(text);
  const shopItem = SHOP_ITEM.test(text) || HARDWARE_ITEM.test(text);
  const shopCue = shopItem || BUY.test(text) || STORE_NAME.test(text);
  const helpTask = HELP_TASK.test(text);

  let intents = [...base.intents];
  if (shopCue && !intents.includes("store")) intents.push("store");
  if (helpTask && !intents.includes("help")) intents.push("help");
  if (
    helpTask &&
    /\b(couch|sofa|furniture)\b/i.test(text) &&
    !intents.includes("send")
  ) {
    intents.push("send");
  }
  // Grocery delivery is Shop, not Send — unless the rider named a parcel.
  if (shopItem && !/\b(package|parcel|this)\b/i.test(text)) {
    intents = intents.filter((intent) => intent !== "send");
  }
  if (
    intents.includes("store") &&
    intents.includes("ride") &&
    !base.placeQuery
  ) {
    intents = intents.filter((intent) => intent !== "ride");
  }
  const placeQuery = helpTask
    ? stripHelpTask(base.placeQuery)
    : base.placeQuery;
  if (helpTask && !placeQuery) {
    intents = intents.filter((intent) => intent !== "ride");
  }
  if (!shopCue && !helpTask) return base;
  const unique = [...new Set(intents)];
  return {
    intents: unique,
    placeQuery,
    ambiguous: unique.length > 1,
  };
}

function stripHelpTask(placeQuery: string): string {
  return placeQuery
    .replace(HELP_TASK, " ")
    .replace(/\b(help|me|a|the|move|lift|carry|couch|sofa|furniture)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isShopItemLabel(label: string): boolean {
  return SHOP_ITEM.test(label) || HARDWARE_ITEM.test(label);
}

export function shopItemsFromQuery(text: string): ShopItem[] {
  const raw = text
    .replace(/\bphoto:[^\s,]+/gi, " ")
    .replace(/\bwith stops\b/gi, " ")
    .trim();
  if (!raw) return [];
  const parts = raw
    .split(ITEM_SPLIT)
    .map((part) =>
      part
        .replace(BUY, " ")
        .replace(/\bdeliver(?:y|ing)?\b/gi, " ")
        .replace(STORE_NAME, " ")
        .replace(SCHEDULED, " ")
        .replace(IMMEDIATE, " ")
        .replace(/\b(at|from|the|a|an|some|store|shop|grocery|groceries)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((label) => label.length > 1 && isShopItemLabel(label))
    .map((label) => {
      const hardware = HARDWARE_ITEM.exec(label);
      if (hardware) return { label: hardware[0].toLowerCase() };
      const grocery = SHOP_ITEM.exec(label);
      return { label: (grocery?.[0] ?? label).toLowerCase() };
    });
  if (parts.length > 0) return parts;
  const hardware = HARDWARE_ITEM.exec(raw);
  if (hardware) return [{ label: hardware[0].toLowerCase() }];
  const match = SHOP_ITEM.exec(raw);
  return match ? [{ label: match[0].toLowerCase() }] : [];
}

export function placeFromFixtures(query: string): AssistPlace | null {
  return matchPlace(query, KNOWN_PLACES);
}

export function storeFromFixtures(query: string): AssistPlace | null {
  const needle = query.trim().toLowerCase();
  if (!needle) return nearestShop();
  for (const place of KNOWN_STORES) {
    const label = (place.label ?? "").toLowerCase();
    if (label && needle.includes(label)) return place;
  }
  return matchPlace(query, KNOWN_STORES);
}

export function nearestShop(): AssistPlace | null {
  return (
    KNOWN_STORES.find(
      (place) =>
        place.label !== "Florist" &&
        place.label !== "Home Depot" &&
        place.label !== "Lowe's",
    ) ??
    KNOWN_STORES[0] ??
    null
  );
}

export function hardwareStore(): AssistPlace | null {
  return (
    KNOWN_STORES.find((place) => place.label === "Home Depot") ??
    KNOWN_STORES.find((place) => place.label === "Lowe's") ??
    nearestShop()
  );
}

function floristPlace(): AssistPlace | null {
  return (
    KNOWN_STORES.find((place) => place.label === "Florist") ?? nearestShop()
  );
}

function matchPlace(query: string, places: readonly AssistPlace[]): AssistPlace | null {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return null;
  for (const place of places) {
    const label = place.label ?? "";
    const hay = `${label} ${place.address}`.toLowerCase();
    if (hay.includes(needle)) return place;
  }
  return null;
}

export function planFromIntent(
  intent: SearchIntent,
  query: string,
  classified: ClassifiedQuery,
): AssistPlan | null {
  const placeQuery = classified.placeQuery || query;
  const destination = placeFromFixtures(placeQuery);
  const items = shopItemsFromQuery(query);
  const namedStore = storeFromFixtures(query);

  if (intent === "help") {
    const moving = HELP_TASK.test(query);
    return {
      kind: "help",
      confidence: "high",
      title: moving ? "Help moving" : "Help at home",
      subtitle: destination?.address ?? "A helper comes here",
      destination: destination ?? undefined,
    };
  }

  if (intent === "send") {
    const moving = HELP_TASK.test(query);
    const dropoff =
      destination ??
      (!moving && placeQuery ? { address: placeQuery } : undefined);
    if (!dropoff && !moving) return null;
    return {
      kind: "courier",
      confidence: dropoff && destination ? "high" : "low",
      title: moving ? "Send it instead" : "Send a package",
      subtitle: dropoff?.address ?? "Courier pickup",
      destination: dropoff,
    };
  }

  if (intent === "store") {
    const flowers = items.some((item) => FLOWERS.test(item.label));
    const hardware =
      HARDWARE_CUE.test(query) ||
      items.some((item) => HARDWARE_ITEM.test(item.label));
    const store = flowers
      ? floristPlace()
      : hardware
        ? (namedStore ?? hardwareStore())
        : (namedStore ?? nearestShop());
    const itemLine = items.map((item) => item.label).join(", ");
    let timing = parseAssistTiming(query);
    if (
      flowers &&
      timing === "now" &&
      !IMMEDIATE.test(query) &&
      !/\bdeliver(?:y|ing)?\b/i.test(query)
    ) {
      timing = "scheduled";
    }
    const when =
      timing === "scheduled" ? scheduledTimeFromQuery(query) : null;
    const whenLabel = when ? formatPickupClock(when) : null;
    return {
      kind: "shop",
      confidence: items.length > 0 || namedStore ? "high" : "low",
      timing,
      title: itemLine
        ? timing === "scheduled"
          ? `Order ${itemLine}${whenLabel ? ` for ${whenLabel.toLowerCase()}` : " for later"}`
          : `Deliver ${itemLine}`
        : timing === "scheduled"
          ? "Order for later"
          : "Shop nearby",
      subtitle:
        timing === "scheduled"
          ? whenLabel
            ? `${whenLabel} · ${store?.label ?? "Schedule delivery"}`
            : (store?.label ?? "Schedule delivery")
          : (store?.label ?? store?.address),
      store: store ?? undefined,
      items: items.length > 0 ? items : undefined,
    };
  }

  if (!destination) return null;
  const label = destination.label ?? destination.address;
  return {
    kind: "ride",
    confidence: "high",
    title: `Ride to ${label}`,
    subtitle: destination.address,
    destination,
  };
}

/** Local fallback when the model is missing, slow, or returns nothing usable. */
export function planAssistHeuristic(query: string): AssistResponse {
  const trimmed = query.trim();
  const classified = classifyAssistQuery(trimmed);
  let plans = classified.intents
    .map((intent) => planFromIntent(intent, trimmed, classified))
    .filter((plan): plan is AssistPlan => plan !== null);
  plans = expandAmbiguousPlans(trimmed, plans);
  return assistResponseFromPlans(trimmed, plans);
}

function expandAmbiguousPlans(query: string, plans: AssistPlan[]): AssistPlan[] {
  const hasTimingCue = IMMEDIATE.test(query) || SCHEDULED.test(query);
  const items = shopItemsFromQuery(query);
  const next = [...plans];
  const shop = next.find((plan) => plan.kind === "shop");

  if (shop && items.length > 0) {
    const flowers = items.some((item) => FLOWERS.test(item.label));
    const store = flowers
      ? floristPlace()
      : HARDWARE_CUE.test(query)
        ? (shop.store ?? hardwareStore())
        : shop.store;
    const buyNow =
      HARDWARE_CUE.test(query) ||
      items.some((item) => HARDWARE_ITEM.test(item.label));
    if (
      store &&
      !next.some((plan) => plan.kind === "ride") &&
      !buyNow
    ) {
      next.push({
        kind: "ride",
        confidence: "low",
        title: flowers
          ? "Ride to a florist"
          : `Ride to ${store.label ?? "the store"}`,
        subtitle: store.address,
        destination: store,
      });
    }
    if (flowers && !next.some((plan) => plan.kind === "courier")) {
      next.push({
        kind: "courier",
        confidence: "low",
        title: "Send flowers",
        subtitle: "Courier to a door",
      });
    }
    const kinds = new Set(next.map((plan) => plan.kind));
    if (
      kinds.size === 1 &&
      kinds.has("shop") &&
      !hasTimingCue &&
      next.length === 1
    ) {
      const itemLine = items.map((item) => item.label).join(", ");
      const storeLabel = shop.store?.label ?? "nearby";
      return [
        {
          ...shop,
          timing: "now",
          confidence: "high",
          title: `Deliver ${itemLine} now`,
          subtitle: storeLabel,
        },
        {
          ...shop,
          timing: "scheduled",
          confidence: "high",
          title: `Order ${itemLine} for later`,
          subtitle: "Schedule delivery",
        },
      ];
    }
    return next;
  }

  return next;
}

function messageForPlans(query: string, plans: AssistPlan[]): string {
  if (plans.length === 0) {
    return "I couldn't match that to a ride, shop, send, or help. Try a place or what you need.";
  }
  if (plans.length === 1) {
    const plan = plans[0]!;
    const tc = textconIdForPlan(plan);
    if (plan.kind === "ride") {
      const label =
        plan.destination?.label ?? plan.title.replace(/^Ride to /i, "");
      return `I'll take you to {{textcon:place}} ${label}.`;
    }
    if (plan.kind === "help") {
      return `I can send {{textcon:help}} to your home.`;
    }
    if (plan.kind === "courier") {
      return `I can {{textcon:courier}} that for you.`;
    }
    if (plan.kind === "reserve") {
      return `I can {{textcon:reserve}} that ride ahead.`;
    }
    if (plan.kind === "shop") {
      if (plan.timing === "scheduled") {
        return `I can {{textcon:shop}} order {{textcon:${tc}}} for later.`;
      }
      return `I can {{textcon:shop}} deliver {{textcon:${tc}}} now.`;
    }
    return `Here's what I found for "${query.trim()}".`;
  }

  const kinds = new Set(plans.map((plan) => plan.kind));
  const shopPlans = plans.filter((plan) => plan.kind === "shop");
  const hasFlowers = shopPlans.some((plan) =>
    plan.items?.some((item) => FLOWERS.test(item.label)),
  );

  if (hasFlowers) {
    return `You could {{textcon:shop}} order flowers, {{textcon:ride}} to a florist nearby, or {{textcon:courier}} send them.`;
  }
  if (kinds.has("help") && kinds.has("courier")) {
    return `I can send {{textcon:help}} to move it, or {{textcon:courier}} haul it instead.`;
  }
  if (kinds.size === 1 && kinds.has("shop") && shopPlans.length >= 2) {
    const itemLine =
      shopPlans[0]?.items?.map((item) => item.label).join(", ") ?? "that";
    return `You can {{textcon:shop}} ${itemLine} now or schedule it for later.`;
  }
  if (kinds.has("ride") && kinds.has("courier")) {
    return `That could be a {{textcon:ride}} or a {{textcon:courier}} — pick what fits.`;
  }
  if (kinds.has("shop") && kinds.has("ride")) {
    return `I can {{textcon:shop}} for you or get you a {{textcon:ride}} there.`;
  }

  const labels = [...kinds].map((kind) => `{{textcon:${kind}}}`).join(", ");
  return `A few ways to help — ${labels}. Tap one to continue.`;
}

function textconsFromMessage(
  message: string,
  plans: AssistPlan[],
): AssistTextconRef[] {
  const seen = new Set<string>();
  const refs: AssistTextconRef[] = [];
  const add = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const def = resolveAssistTextcon(id);
    refs.push({
      id,
      service: def?.service ?? "assist",
      label: def?.label,
    });
  };
  for (const segment of splitAssistMessage(message)) {
    if (segment.type === "textcon") add(segment.id);
  }
  for (const plan of plans) add(textconIdForPlan(plan));
  return refs;
}

export function assistEntries(response: AssistResponse): AssistSuggestion[] {
  if (response.suggestions?.length) return response.suggestions;
  return response.cards ?? [];
}

export function assistResponseFromPlans(
  query: string,
  plans: AssistPlan[],
): AssistResponse {
  const suggestions: AssistSuggestion[] = plans.map((plan, index) => ({
    id: `assist:${plan.kind}:${index}`,
    plan,
  }));
  const [only] = plans;
  const land =
    plans.length === 1 &&
    only?.confidence === "high" &&
    (only.kind === "help" ||
      Boolean(only.destination) ||
      Boolean(only.store) ||
      (only.items?.length ?? 0) > 0);
  const message = messageForPlans(query, plans);

  return {
    query,
    message,
    textcons: textconsFromMessage(message, plans),
    suggestions,
    cards: suggestions,
    mode: land ? "land" : "reply",
    plan: land ? only : undefined,
  };
}

/**
 * Keep live model copy when it is useful, but never let a single-plan land
 * hide a heuristic mosaic (flowers → shop + ride + send).
 */
export function reconcileAssistResponse(
  query: string,
  model: AssistResponse,
): AssistResponse {
  const heuristic = planAssistHeuristic(query);
  const heuristicKinds = new Set(
    heuristic.suggestions.map((entry) => entry.plan.kind),
  );
  const modelKinds = new Set(model.suggestions.map((entry) => entry.plan.kind));
  if (heuristicKinds.size > 1 && modelKinds.size <= 1) {
    if (model.message.includes("{{textcon:")) {
      return {
        ...heuristic,
        message: model.message,
        textcons: textconsFromMessage(
          model.message,
          heuristic.suggestions.map((entry) => entry.plan),
        ),
      };
    }
    return heuristic;
  }
  const shopHint = heuristic.suggestions.find(
    (entry) => entry.plan.kind === "shop",
  )?.plan;
  const plans = model.suggestions.map((entry) => {
    const plan = entry.plan;
    if (plan.kind !== "shop" || !shopHint) return plan;
    return {
      ...plan,
      timing: shopHint.timing ?? plan.timing,
      title: shopHint.title,
      subtitle: shopHint.subtitle ?? plan.subtitle,
      items: plan.items?.length ? plan.items : shopHint.items,
      store: plan.store ?? shopHint.store,
    };
  });
  if (plans.length === 0) return model;
  const rebuilt = assistResponseFromPlans(query, plans);
  return {
    ...rebuilt,
    message: model.message.trim() ? model.message : rebuilt.message,
    textcons: model.textcons?.length ? model.textcons : rebuilt.textcons,
  };
}

/** Photo shop ask — compose stamp, referential note, or explicit photo payload. */
export function isAssistPhotoShopAsk(
  query: string,
  extras: {
    items?: ShopItem[];
    storeHints?: string[];
    hasPhoto?: boolean;
  } = {},
): boolean {
  if (extras.hasPhoto) return true;
  if ((extras.items?.length ?? 0) > 0 || (extras.storeHints?.length ?? 0) > 0) {
    return true;
  }
  if (/\bbuy what is in the photo\b/i.test(query)) return true;
  return false;
}

/**
 * Overlay photo-classifier items and soft store hints onto an Assist response.
 * Picks the closest real candidate that might sell the item — not a canned
 * chain from a product→store matrix. Photo asks suppress ride geocode of the
 * typed note alone.
 */
export function applyAssistPhotoContext(
  query: string,
  response: AssistResponse,
  extras: {
    items?: ShopItem[];
    storeHints?: string[];
    category?: AssistPhotoCategory;
    origin?: { latitude: number; longitude: number };
    candidates?: AssistPlace[];
    /** Attached photo even when vision/filename classification is empty. */
    hasPhoto?: boolean;
  } = {},
): AssistResponse {
  const items = (extras.items ?? []).filter((item) => item.label.trim());
  const hints = (extras.storeHints ?? [])
    .map((hint) => hint.trim())
    .filter(Boolean);
  const photoAsk = isAssistPhotoShopAsk(query, {
    items,
    storeHints: hints,
    hasPhoto: extras.hasPhoto,
  });
  if (!photoAsk) return response;

  const category =
    extras.category ??
    (items.some((item) => HARDWARE_ITEM.test(item.label))
      ? "hardware"
      : items.some((item) => FLOWERS.test(item.label))
        ? "flowers"
        : items.some((item) =>
              /\b(pencils?|pens?|markers?|stationery|notebooks?)\b/i.test(
                item.label,
              ),
            )
          ? "home"
          : hints.some((hint) => /hardware|home improvement/i.test(hint))
            ? "hardware"
            : hints.some((hint) => /florist|flower/i.test(hint))
              ? "flowers"
              : hints.some((hint) =>
                    /office|merchandise|home goods|target/i.test(hint),
                  )
                ? "home"
                : "other");

  const candidates = extras.candidates ?? KNOWN_STORES;
  const picked =
    items.length > 0 || hints.length > 0
      ? pickClosestStoreForPhoto(
          { category, storeHints: hints, items },
          candidates,
          extras.origin,
        )
      : null;
  // Exact chain name in a soft hint still resolves via fixtures.
  const namedHint =
    hints
      .map((hint) => storeFromFixtures(hint))
      .find((place) => place != null) ?? null;
  const rawStore = picked ?? namedHint ?? null;
  const resolvedStore: AssistPlace | null = rawStore
    ? {
        address: rawStore.address,
        latitude: rawStore.latitude,
        longitude: rawStore.longitude,
        label: rawStore.label,
      }
    : null;

  let plans = response.suggestions.map((entry) => entry.plan);
  if (!plans.some((plan) => plan.kind === "shop")) {
    const seed = [query, ...items.map((item) => item.label)]
      .filter(Boolean)
      .join(" ");
    const seeded = planAssistHeuristic(
      /\b(buy|deliver|order)\b/i.test(seed) ? seed : `deliver ${seed} now`,
    );
    const shopPlans = seeded.suggestions
      .map((entry) => entry.plan)
      .filter((plan) => plan.kind === "shop");
    if (shopPlans.length > 0) plans = [...shopPlans, ...plans];
  }

  plans = plans.map((plan) => {
    if (plan.kind !== "shop") return plan;
    const nextItems = items.length ? items : (plan.items ?? []);
    // Photo match wins over heuristic "nearest grocery" / hardware defaults.
    const store = resolvedStore ?? plan.store ?? undefined;
    const subtitle =
      store && resolvedStore
        ? (store.label ?? store.address ?? plan.subtitle)
        : plan.subtitle;
    return {
      ...plan,
      items: nextItems.length ? nextItems : plan.items,
      store: store ?? plan.store,
      subtitle,
      confidence: nextItems.length || store ? "high" : plan.confidence,
    };
  });

  if (!plans.some((plan) => plan.kind === "shop")) {
    const store = resolvedStore ?? nearestShop();
    const itemLine = items.map((item) => item.label).join(", ");
    plans = [
      {
        kind: "shop",
        confidence: "high",
        timing: "now",
        title: itemLine ? `Deliver ${itemLine}` : "Shop nearby",
        subtitle: store?.label ?? store?.address,
        store: store ?? undefined,
        items: items.length ? items : undefined,
      },
      ...plans,
    ];
  }

  // Photo shop asks drop ride POIs from geocode / DeepSeek resolve_place.
  const stripRides =
    /\b(these|those|them)\b/i.test(query) ||
    /\bdeliver\b.+\bnow\b/i.test(query) ||
    /\bbuy what is in the photo\b/i.test(query) ||
    extras.hasPhoto === true ||
    items.length > 0;
  if (stripRides) {
    const shopOnly = plans.filter((plan) => plan.kind === "shop");
    if (shopOnly.length > 0) plans = shopOnly;
  }

  return assistResponseFromPlans(query, plans);
}
