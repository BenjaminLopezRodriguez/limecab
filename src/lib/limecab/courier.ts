/**
 * Courier — same-day local delivery on the ride rails.
 *
 * Size is a product so dispatch can reuse ride matching. Quantity, recipient
 * and proof-of-delivery are options. LimeCab owns pickup → transport → proof;
 * it does not pack, broker freight, or talk to USPS.
 */

import type { RideProduct } from "./domain.ts";
import { HELP_PRODUCTS } from "./help.ts";
import type {
  ServiceOption,
  ServiceOptionValues,
} from "../service-app/options.ts";

export const COURIER_SERVICE = {
  id: "courier",
  title: "Courier",
  description: "Same-day delivery",
  status: "available" as const,
};

export const COURIER_PRODUCTS: RideProduct[] = [
  {
    id: "courier-small",
    name: "Courier",
    description: "Fits on the passenger seat",
    seats: 0,
    etaMinutes: 8,
    priceCents: 80,
    status: "available",
  },
  {
    id: "courier-medium",
    name: "Courier",
    description: "Fits in the trunk",
    seats: 0,
    etaMinutes: 8,
    priceCents: 118,
    status: "available",
  },
  {
    id: "courier-large",
    name: "Courier XL",
    description: "Needs a larger vehicle",
    seats: 0,
    etaMinutes: 12,
    priceCents: 168,
    status: "available",
  },
];

export type PackageSize = "small" | "medium" | "large";
export type DeliveryProof = "hand" | "door" | "signature";
export type CourierFulfillment = "packed" | "buy";

export type CourierDraft = {
  size: PackageSize;
  quantity: number;
  recipientName: string;
  recipientPhone: string;
  proof: DeliveryProof;
  instructions: string;
  fulfillment: CourierFulfillment;
  itemDescription: string;
};

export const COURIER_OPTIONS: ServiceOption[] = [
  {
    id: "fulfillment",
    kind: "choice",
    label: "What's at pickup?",
    choices: [
      { value: "packed", label: "Already packed" },
      { value: "buy", label: "Buy for me" },
    ],
    defaultValue: "packed",
  },
  {
    id: "size",
    kind: "choice",
    label: "What are we carrying?",
    description: "Sealed and ready at pickup.",
    choices: [
      { value: "small", label: "Small", hint: "Seat" },
      { value: "medium", label: "Medium", hint: "Trunk" },
      { value: "large", label: "Large", hint: "XL" },
    ],
    defaultValue: "small",
  },
  {
    id: "itemDescription",
    kind: "text",
    label: "What should they buy?",
    placeholder: "Snake plant, about 12 inches",
    maxLength: 160,
    rows: 2,
  },
  {
    id: "quantity",
    kind: "counter",
    label: "Packages",
    min: 1,
    max: 8,
    defaultValue: 1,
  },
  {
    id: "recipientName",
    kind: "text",
    label: "Recipient name",
    placeholder: "Who’s receiving this",
    maxLength: 80,
    rows: 1,
  },
  {
    id: "recipientPhone",
    kind: "text",
    label: "Recipient phone",
    placeholder: "Mobile number",
    maxLength: 20,
    rows: 1,
  },
  {
    id: "proof",
    kind: "choice",
    label: "Delivery",
    choices: [
      { value: "hand", label: "Hand over", hint: "PIN" },
      { value: "door", label: "Leave at door" },
      { value: "signature", label: "Signature" },
    ],
    defaultValue: "hand",
  },
  {
    id: "instructions",
    kind: "text",
    label: "Pickup or delivery notes",
    placeholder: "Buzzer, dock, side door…",
    maxLength: 160,
  },
];

/**
 * Lime Shop's options. Same courier rails minus the questions a list already
 * answers: there is no "already packed vs buy for me" to ask (the list *is*
 * buy-for-me), no one-line item field, and no package count — the list is the
 * count. Size still picks the `courier-*` product.
 */
export const SHOP_OPTIONS: ServiceOption[] = COURIER_OPTIONS.filter((option) =>
  ["size", "recipientName", "recipientPhone", "proof", "instructions"].includes(
    option.id,
  ),
).map((option) =>
  option.id === "size"
    ? {
        ...option,
        label: "How much is it?",
        description: "A courier buys the list, then brings it to the drop-off.",
      }
    : option,
);

const SIZE_PRODUCT: Record<PackageSize, string> = {
  small: "courier-small",
  medium: "courier-medium",
  large: "courier-large",
};

export function isCourierProduct(id: string | null | undefined): boolean {
  if (!id) return false;
  return COURIER_PRODUCTS.some((product) => product.id === id);
}

/** Every id the app can book: courier sizes, Help visits, then the rides. */
export function findBookableProduct(
  id: string,
  rides: readonly RideProduct[] = [],
): RideProduct | undefined {
  return (
    COURIER_PRODUCTS.find((product) => product.id === id) ??
    HELP_PRODUCTS.find((product) => product.id === id) ??
    rides.find((product) => product.id === id)
  );
}

export function courierProductFromOptions(
  values: ServiceOptionValues,
): RideProduct {
  const size = parseSize(values.size);
  return COURIER_PRODUCTS.find((product) => product.id === SIZE_PRODUCT[size])!;
}

export function courierDraftFromOptions(
  values: ServiceOptionValues,
): CourierDraft {
  return {
    size: parseSize(values.size),
    quantity: clampQuantity(values.quantity),
    recipientName:
      typeof values.recipientName === "string" ? values.recipientName.trim() : "",
    recipientPhone:
      typeof values.recipientPhone === "string"
        ? values.recipientPhone.trim()
        : "",
    proof: parseProof(values.proof),
    instructions:
      typeof values.instructions === "string" ? values.instructions.trim() : "",
    fulfillment: values.fulfillment === "buy" ? "buy" : "packed",
    itemDescription:
      typeof values.itemDescription === "string"
        ? values.itemDescription.trim()
        : "",
  };
}

export function courierDraftReady(draft: CourierDraft): boolean {
  if (draft.fulfillment === "buy" && draft.itemDescription.length === 0) {
    return false;
  }
  return draft.recipientName.length > 0 && digitCount(draft.recipientPhone) >= 7;
}

/**
 * The line the driver reads under the address. `itemCount` is Shop's: a list
 * is items, not sealed packages, and the sheet must not say "1 package" over
 * a list of six.
 */
export function courierMeetingPoint(
  values: ServiceOptionValues,
  itemCount?: number,
): string {
  const draft = courierDraftFromOptions(values);
  const count =
    itemCount !== undefined
      ? itemCount === 1
        ? "1 item"
        : `${itemCount} items`
      : draft.quantity === 1
        ? "1 package"
        : `${draft.quantity} packages`;
  const who = draft.recipientName || "recipient";
  const handoff =
    draft.proof === "door"
      ? `Leave at door for ${who}`
      : draft.proof === "signature"
        ? `Signature from ${who}`
        : `Hand to ${who}`;
  const buy =
    draft.fulfillment === "buy" && draft.itemDescription
      ? `Buy: ${draft.itemDescription} · `
      : "";
  return draft.instructions
    ? `${buy}${count} · ${handoff} · ${draft.instructions}`
    : `${buy}${count} · ${handoff}`;
}

export function courierOrderLabel(tripId: string): string {
  const compact = tripId.replace(/-/g, "").toUpperCase();
  return `LC-${compact.slice(-4)}`;
}

export type CustodyGate = { ok: true } | { ok: false; message: string };

export function courierStartAllowed(
  submitted: string | undefined,
  pickupPin: string,
): CustodyGate {
  if (submitted?.trim() !== pickupPin) {
    return { ok: false, message: "Scan the pickup code to take possession." };
  }
  return { ok: true };
}

export function courierCompleteAllowed(input: {
  proof: DeliveryProof;
  deliveryPin: string | null;
  submittedPin?: string;
  leftAtDoor?: boolean;
  signatureCaptured?: boolean;
}): CustodyGate {
  if (input.proof === "hand") {
    if (!input.deliveryPin || input.submittedPin !== input.deliveryPin) {
      return { ok: false, message: "Enter the recipient’s PIN to complete." };
    }
    return { ok: true };
  }
  if (input.proof === "door") {
    if (!input.leftAtDoor) {
      return { ok: false, message: "Confirm the package was left at the door." };
    }
    return { ok: true };
  }
  if (!input.signatureCaptured) {
    return { ok: false, message: "Capture a signature to complete." };
  }
  return { ok: true };
}

export function courierProofLabel(proof: DeliveryProof): string {
  switch (proof) {
    case "hand":
      return "Handed to recipient";
    case "door":
      return "Left at door";
    case "signature":
      return "Signature captured";
  }
}

function parseSize(value: unknown): PackageSize {
  if (value === "medium" || value === "large") return value;
  return "small";
}

function parseProof(value: unknown): DeliveryProof {
  if (value === "door" || value === "signature") return value;
  return "hand";
}

function clampQuantity(value: unknown): number {
  const n = typeof value === "number" ? value : 1;
  return Math.min(8, Math.max(1, Math.round(n)));
}

function digitCount(value: string): number {
  return value.replace(/\D/g, "").length;
}
