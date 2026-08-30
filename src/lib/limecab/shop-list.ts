/**
 * Lime Shop — the rider's list.
 *
 * Shop is courier with a store and a list. The list *is* the order: a courier
 * buys these lines at the pickup store, then delivers them. There is no
 * catalogue, no SKU, no price per line — item cost is paid in store and this
 * build has no reimbursement path.
 *
 * Stored on `trips.itemList` as a JSON array of `{label, note?, qty?}`, so
 * Shop needs no table and no product id of its own: a courier trip with a
 * list is a Shop trip. `qty` is how many of that line; 1 is omitted.
 */

import { z } from "zod";

export type ShopItem = { label: string; note?: string; qty?: number };

export const SHOP_LIST_MAX = 12;
export const SHOP_LABEL_MAX = 80;
export const SHOP_NOTE_MAX = 80;
export const SHOP_QTY_MAX = 20;

/** The wire shape. `trip.request` validates with this and stores the string. */
export const shopListSchema = z
  .array(
    z.object({
      label: z.string().trim().min(1).max(SHOP_LABEL_MAX),
      note: z.string().trim().max(SHOP_NOTE_MAX).optional(),
      qty: z.number().int().min(1).max(SHOP_QTY_MAX).optional(),
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
    const qty = clampQty(row.qty);
    const item: ShopItem = { label };
    if (note) item.note = note;
    if (qty > 1) item.qty = qty;
    items.push(item);
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

/** A courier trip carrying a list is a Shop cart — the only discriminator. */
export function isShopTrip(itemList: string | null | undefined): boolean {
  return parseShopList(itemList).length > 0;
}

export function serializeShopList(items: readonly ShopItem[]): string {
  return JSON.stringify(normalizeShopList(items));
}

/** "2× Oat milk, Bananas, Sourdough and 2 more" — the quote and the offer line. */
export function shopListSummary(items: readonly ShopItem[], show = 3): string {
  const shown = items.slice(0, show).map(shopItemLine);
  const rest = items.length - shown.length;
  if (shown.length === 0) return "";
  return rest > 0 ? `${shown.join(", ")} and ${rest} more` : shown.join(", ");
}

export function shopItemQty(item: Pick<ShopItem, "qty">): number {
  return item.qty ?? 1;
}

/** How many units the courier is buying, not how many lines. */
export function shopListUnitCount(items: readonly ShopItem[]): number {
  return items.reduce((sum, item) => sum + shopItemQty(item), 0);
}

export function shopItemLine(item: ShopItem): string {
  const qty = shopItemQty(item);
  return qty > 1 ? `${qty}× ${item.label}` : item.label;
}

export function shopItemCountLabel(count: number): string {
  return count === 1 ? "1 item" : `${count} items`;
}

function clampQty(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.min(SHOP_QTY_MAX, Math.max(1, Math.round(value)));
}
