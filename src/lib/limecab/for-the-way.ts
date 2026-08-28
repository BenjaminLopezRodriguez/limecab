/**
 * Rider add-on: a drink waiting in the car.
 *
 * Uses the existing stop slot. Driver app is unchanged — this is rider
 * geometry and copy only.
 */

import type { Location } from "@/lib/service-app/services";

export const FOR_THE_WAY_CAFE: Location = {
  address: "Grand Central Market, S Broadway, Los Angeles",
  shortName: "Grand Central Market",
  latitude: 34.0508,
  longitude: -118.249,
};

export const FOR_THE_WAY_ITEMS = [
  { id: "coffee", label: "Coffee", priceCents: 500 },
  { id: "tea", label: "Tea", priceCents: 500 },
  { id: "sparkling", label: "Sparkling water", priceCents: 500 },
] as const;

export type ForTheWayItemId = (typeof FOR_THE_WAY_ITEMS)[number]["id"];

export function forTheWayItem(id: string) {
  return FOR_THE_WAY_ITEMS.find((item) => item.id === id) ?? null;
}

export function forTheWayEligible(productId: string | null | undefined): boolean {
  return productId === "lime-comfort" || productId === "lime-reserve";
}
