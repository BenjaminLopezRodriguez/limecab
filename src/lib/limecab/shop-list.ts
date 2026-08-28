/**
 * Lime Shop — the rider's list.
 *
 * Shop is courier with a store and a list. The list *is* the order: a courier
 * buys these lines at the pickup store, then delivers them. There is no
 * catalogue, no SKU, no price per line — item cost is paid in store and this
 * build has no reimbursement path.
 *
 * Stored on `trips.itemList` as a JSON array of `{label, note?}`, so Shop
 * needs no table and no product id of its own: a courier trip with a list is
 * a Shop trip.
 */

import { z } from "zod";

export type ShopItem = { label: string; note?: string };

export const SHOP_LIST_MAX = 12;
export const SHOP_LABEL_MAX = 80;
export const SHOP_NOTE_MAX = 80;

/** The wire shape. `trip.request` validates with this and stores the string. */
export const shopListSchema = z
  .array(
    z.object({
      label: z.string().trim().min(1).max(SHOP_LABEL_MAX),
      note: z.string().trim().max(SHOP_NOTE_MAX).optional(),
    }),
  )
  .min(1)
  .max(SHOP_LIST_MAX);

/** Draft rows the editor holds. Empty labels are not items yet. */
export function normalizeShopList(rows: readonly ShopItem[]): ShopItem[] {
  const items: ShopItem[] = [];
  for (const row of rows) {
    const label = row.label.trim().slice(0, SHOP_LABEL_MAX);
    if (!label) continue;
    const note = row.note?.trim().slice(0, SHOP_NOTE_MAX);
    items.push(note ? { label, note } : { label });
    if (items.length === SHOP_LIST_MAX) break;
  }
  return items;
}

/** Read the column back. A malformed or absent list is no list, never a throw. */
export function parseShopList(raw: string | null | undefined): ShopItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const checked = shopListSchema.safeParse(parsed);
    return checked.success ? checked.data : [];
  } catch {
    return [];
  }
}

export function serializeShopList(items: readonly ShopItem[]): string {
  return JSON.stringify(normalizeShopList(items));
}

/** "Oat milk, Bananas, Sourdough and 2 more" — the quote and the offer line. */
export function shopListSummary(items: readonly ShopItem[], show = 3): string {
  const shown = items.slice(0, show).map((item) => item.label);
  const rest = items.length - shown.length;
  if (shown.length === 0) return "";
  return rest > 0 ? `${shown.join(", ")} and ${rest} more` : shown.join(", ");
}

export function shopItemCountLabel(count: number): string {
  return count === 1 ? "1 item" : `${count} items`;
}
