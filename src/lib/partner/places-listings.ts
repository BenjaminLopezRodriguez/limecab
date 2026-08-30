/**
 * Partner-side listings for Lime Spaces (rooms, venues) and Lime Station
 * (parking). Mock inventory until persistence lands — the desk UI reads this
 * shape only.
 */

export type PlaceListingKind = "room" | "venue" | "parking";

export type PlaceListingStatus = "live" | "draft" | "paused";

export type PlaceListing = {
  id: string;
  kind: PlaceListingKind;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  status: PlaceListingStatus;
  /** Display price, e.g. "$45/hr" or "$18/day". */
  priceLabel: string;
  capacity?: number;
  spaces?: number;
  updatedAt: string;
};

export const PLACE_LISTING_KIND_LABEL: Record<PlaceListingKind, string> = {
  room: "Meeting room",
  venue: "Event venue",
  parking: "Parking lot",
};

export const MOCK_PARTNER_LISTINGS: PlaceListing[] = [
  {
    id: "pl_1",
    kind: "room",
    name: "Boardroom A",
    address: "Arts District, Los Angeles",
    latitude: 34.0412,
    longitude: -118.2324,
    status: "live",
    priceLabel: "$85/hr",
    capacity: 12,
    updatedAt: "2026-08-28",
  },
  {
    id: "pl_2",
    kind: "venue",
    name: "Rooftop Terrace",
    address: "Downtown LA",
    latitude: 34.0522,
    longitude: -118.2437,
    status: "live",
    priceLabel: "$450/event",
    capacity: 80,
    updatedAt: "2026-08-25",
  },
  {
    id: "pl_3",
    kind: "parking",
    name: "Lot 7 — Dodger Stadium",
    address: "Elysian Park Ave",
    latitude: 34.0739,
    longitude: -118.24,
    status: "live",
    priceLabel: "$18/day",
    spaces: 42,
    updatedAt: "2026-08-29",
  },
  {
    id: "pl_4",
    kind: "parking",
    name: "Garage B — Union Station",
    address: "800 N Alameda St",
    latitude: 34.0562,
    longitude: -118.2349,
    status: "draft",
    priceLabel: "$6/hr",
    spaces: 120,
    updatedAt: "2026-08-30",
  },
];

export function listingsByKind(
  listings: PlaceListing[],
  kind: PlaceListingKind | "all",
): PlaceListing[] {
  if (kind === "all") return listings;
  return listings.filter((row) => row.kind === kind);
}
