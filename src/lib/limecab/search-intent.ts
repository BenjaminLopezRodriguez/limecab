/**
 * One Search classifier. Local keywords only — no food, hotels, or vendors.
 *
 * A query that is clearly an address stays a ride. Ambiguous queries can
 * return ride / send / get-from-store together so the search scene can group.
 */

export type SearchIntent = "ride" | "send" | "store";

export type ClassifiedQuery = {
  intents: SearchIntent[];
  /** Address-shaped remainder to feed the geocoder. */
  placeQuery: string;
  /** True when more than one intent is plausible. */
  ambiguous: boolean;
};

const SEND =
  /\b(send|package|parcel|courier|deliver(?:ing|y)?)\b/i;
const STORE =
  /\b(store|butcher|plant|gift|shop|grocery)\b|\b(get from|pick up from|pickup from|buy (?:me|for me))\b/i;
const ADDRESS =
  /\b(ave|avenue|st|street|blvd|boulevard|rd|road|dr|drive|way|ln|lane|ct|court)\b/i;

const INTENT_WORDS =
  /\b(send|this|package|parcel|courier|deliver(?:ing|y)?|get from|pick up from|pickup from|buy me|buy for me|to)\b/gi;

export function classifySearchQuery(text: string): ClassifiedQuery {
  const raw = text.trim();
  const send = SEND.test(raw);
  const store = STORE.test(raw);
  const addressLike = ADDRESS.test(raw);

  const intents: SearchIntent[] = [];
  if (send) intents.push("send");
  if (store) intents.push("store");
  if (!send && !store) intents.push("ride");
  else if (!addressLike) {
    // "send this to work" is courier-first but still a place someone could
    // ride to; keep ride as a sibling so the grouping is honest.
    intents.unshift("ride");
  }

  const unique = [...new Set(intents)];
  const placeQuery = placeQueryFrom(raw);

  return {
    intents: unique,
    placeQuery,
    ambiguous: unique.length > 1,
  };
}

function placeQueryFrom(text: string): string {
  return text
    .replace(INTENT_WORDS, " ")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Street-shaped queries keep a flat place list — no padded courier rows. */
export function isAddressQuery(text: string): boolean {
  return ADDRESS.test(text) && !SEND.test(text) && !STORE.test(text);
}
