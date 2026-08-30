/**
 * Textcon ids the Assist model can drop into a reply as {{textcon:id}}.
 * Icons live in the client component; this registry is server-safe.
 */

export type AssistServiceId =
  | "ride"
  | "shop"
  | "courier"
  | "help"
  | "reserve"
  | "assist";

export type AssistTextconId =
  | AssistServiceId
  | "store"
  | "place"
  | "flowers";

export type AssistTextconDef = {
  id: AssistTextconId;
  service: AssistServiceId;
  label: string;
};

export const ASSIST_TEXTCONS: Record<AssistTextconId, AssistTextconDef> = {
  ride: { id: "ride", service: "ride", label: "Ride" },
  shop: { id: "shop", service: "shop", label: "Shop" },
  courier: { id: "courier", service: "courier", label: "Send" },
  help: { id: "help", service: "help", label: "Help" },
  reserve: { id: "reserve", service: "reserve", label: "Reserve" },
  assist: { id: "assist", service: "assist", label: "Assist" },
  store: { id: "store", service: "shop", label: "Store" },
  place: { id: "place", service: "ride", label: "Place" },
  flowers: { id: "flowers", service: "shop", label: "Flowers" },
};

/** Ids the LLM may reference in {{textcon:…}} markers. */
export const ASSIST_TEXTCON_IDS = Object.keys(
  ASSIST_TEXTCONS,
) as AssistTextconId[];

export function isAssistTextconId(id: string): id is AssistTextconId {
  return id in ASSIST_TEXTCONS;
}

export function resolveAssistTextcon(id: string): AssistTextconDef | undefined {
  return isAssistTextconId(id) ? ASSIST_TEXTCONS[id] : undefined;
}

export function textconIdForPlan(plan: {
  kind: AssistServiceId | string;
  items?: { label: string }[];
  store?: { label?: string };
  destination?: unknown;
}): AssistTextconId {
  const items =
    plan.items?.map((item) => item.label.toLowerCase()).join(" ") ?? "";
  if (/\b(flowers?|bouquet)\b/.test(items)) return "flowers";
  if (plan.kind === "shop" && plan.store) return "store";
  if (plan.kind === "ride" && plan.destination) return "place";
  return isAssistTextconId(plan.kind) ? plan.kind : "assist";
}
