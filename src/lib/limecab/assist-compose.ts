/**
 * Assist compose extras — photo / stops / person chips, and ChatGPT-style
 * @-mentions for plugins (and optional place names).
 *
 * Pure helpers so the overlay and tests share one parser.
 */

import {
  assistQueryFromPhoto,
  type AssistPhotoClassification,
} from "./assist-photo.ts";
import type { AssistServiceId } from "./assist-textcon.ts";

export type AssistMentionKind = "plugin" | "place";

export type AssistMention = {
  /** Token after `@`, e.g. "shop" or "the-grande-hotel". */
  id: string;
  label: string;
  kind: AssistMentionKind;
  service?: AssistServiceId;
  /** Short hint under the label in the picker. */
  hint?: string;
};

/** Services the rider can pin with @ — same set as the Assist ribbon. */
export const ASSIST_PLUGIN_MENTIONS: readonly AssistMention[] = [
  {
    id: "ride",
    label: "Ride",
    kind: "plugin",
    service: "ride",
    hint: "Go somewhere",
  },
  {
    id: "shop",
    label: "Shop",
    kind: "plugin",
    service: "shop",
    hint: "Buy and deliver",
  },
  {
    id: "send",
    label: "Send",
    kind: "plugin",
    service: "courier",
    hint: "Packages and pickups",
  },
  {
    id: "help",
    label: "Help",
    kind: "plugin",
    service: "help",
    hint: "Someone at the door",
  },
  {
    id: "reserve",
    label: "Reserve",
    kind: "plugin",
    service: "reserve",
    hint: "Book ahead",
  },
];

/** Example place tags — freeform @text still works without a catalog hit. */
export const ASSIST_PLACE_MENTIONS: readonly AssistMention[] = [
  {
    id: "the-grande-hotel",
    label: "The Grande Hotel",
    kind: "place",
    hint: "Place",
  },
  {
    id: "griffith-observatory",
    label: "Griffith Observatory",
    kind: "place",
    hint: "Place",
  },
  {
    id: "grand-central-market",
    label: "Grand Central Market",
    kind: "place",
    hint: "Store",
  },
];

export const ASSIST_MENTIONS: readonly AssistMention[] = [
  ...ASSIST_PLUGIN_MENTIONS,
  ...ASSIST_PLACE_MENTIONS,
];

export type ActiveMention = {
  /** Index of the `@` in the string. */
  start: number;
  /** Text after `@` up to the caret (no spaces). */
  query: string;
};

/**
 * Mentions start at `@` after a start/whitespace boundary and run until
 * whitespace or another `@`. Caret must sit inside that span.
 */
export function activeMentionAt(
  text: string,
  caret: number,
): ActiveMention | null {
  const pos = Math.max(0, Math.min(caret, text.length));
  const before = text.slice(0, pos);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(text[at - 1]!)) return null;
  const body = before.slice(at + 1);
  if (/\s/.test(body)) return null;
  return { start: at, query: body };
}

/** Append or insert `@` at the caret so the rider can type a plugin name. */
export function insertMentionTrigger(
  text: string,
  caret = text.length,
): { text: string; caret: number } {
  const pos = Math.max(0, Math.min(caret, text.length));
  const needSpace = pos > 0 && !/\s/.test(text[pos - 1]!);
  const insert = `${needSpace ? " " : ""}@`;
  return {
    text: text.slice(0, pos) + insert + text.slice(pos),
    caret: pos + insert.length,
  };
}

/** Replace the active `@partial` with `@id ` (trailing space to keep typing). */
export function applyMention(
  text: string,
  caret: number,
  mention: AssistMention,
): { text: string; caret: number } {
  const active = activeMentionAt(text, caret);
  if (!active) {
    const seeded = insertMentionTrigger(text, caret);
    return applyMention(seeded.text, seeded.caret, mention);
  }
  const token = `@${mention.id} `;
  const next =
    text.slice(0, active.start) + token + text.slice(caret);
  return { text: next, caret: active.start + token.length };
}

export function filterMentions(
  query: string,
  catalog: readonly AssistMention[] = ASSIST_MENTIONS,
): AssistMention[] {
  const q = query.trim().toLowerCase().replace(/^@/, "");
  if (!q) return [...catalog];
  return catalog.filter((entry) => {
    const id = entry.id.toLowerCase();
    const label = entry.label.toLowerCase();
    return id.includes(q) || label.includes(q) || label.replace(/\s+/g, "-").includes(q);
  });
}

/**
 * While an `@` mention is open, suppress Assist/geocode lookup so the
 * picker owns the keystroke.
 */
export function assistLookupQuery(query: string): string {
  if (activeMentionAt(query, query.length)) return "";
  return query;
}

export type AssistComposeDraft = {
  photoName: string | null;
  /** Private Blob URL after upload — durable handle for the server. */
  photoUrl: string | null;
  /**
   * Displayable preview for the chip (`blob:` / data URL from the File).
   * Private Blob URLs often cannot load in `<img>` without a signed proxy.
   */
  photoPreviewUrl: string | null;
  wantsStops: boolean;
  recipientName: string | null;
  /** Vision / filename classification — drives shop items and stores. */
  photoClassification: AssistPhotoClassification | null;
};

export const EMPTY_ASSIST_COMPOSE: AssistComposeDraft = {
  photoName: null,
  photoUrl: null,
  photoPreviewUrl: null,
  wantsStops: false,
  recipientName: null,
  photoClassification: null,
};

function includesIgnoreCase(hay: string, needle: string): boolean {
  if (!needle) return true;
  return hay.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Typed notes that refer to the attached photo ("need more of these") — not
 * a place name to geocode alone.
 */
export function isPhotoReferentialNote(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return /\b(need|get|buy|order|want|more)\b[\s\w]*\b(these|those|them|this|it)\b/i.test(
    t,
  ) || /^(more of )?(these|those|them)$/i.test(t);
}

/**
 * Prefix chips that travel with the typed query into Assist.
 *
 * A classified photo becomes a prepared shop sentence alongside (or instead
 * of) the rider's typed text. Photo + referential notes ("need more of these")
 * always keep the shop sentence first so Assist does not geocode the note.
 */
export function composeAssistQuery(
  typed: string,
  draft: AssistComposeDraft,
): string {
  const bits: string[] = [];
  if (draft.recipientName?.trim()) {
    bits.push(`for ${draft.recipientName.trim()}`);
  }
  if (draft.wantsStops) bits.push("with stops");

  const classified = draft.photoClassification
    ? assistQueryFromPhoto(draft.photoClassification)
    : "";
  const body = typed.trim();
  const hasPhoto = Boolean(draft.photoName || draft.photoUrl);
  let shop = "";

  if (classified) {
    if (!body || includesIgnoreCase(classified, body)) {
      shop = classified;
    } else if (includesIgnoreCase(body, classified)) {
      shop = body;
    } else {
      // Prefer prepared shop sentence + rider note (e.g. "need more of these").
      shop = `${classified}: ${body}`;
    }
  } else if (body && hasPhoto && isPhotoReferentialNote(body)) {
    // Photo attached but unclassified — still a shop ask, not a place name.
    shop = `buy what is in the photo now: ${body}`;
  } else if (body) {
    shop = body;
  } else if (draft.photoName) {
    bits.push(`photo:${draft.photoName}`);
  }

  const head = bits.join(", ");
  if (!head) return shop;
  if (!shop) return head;
  return `${head}: ${shop}`;
}
