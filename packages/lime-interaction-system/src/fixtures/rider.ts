/** Deterministic rider fixtures — no production domain types. */

export type RideTier = {
  id: string;
  title: string;
  description: string;
  seats: number;
  detail: string;
  fareCents: number;
  glyph: "car" | "clock" | "people" | "sparkle";
  badge?: "Fastest" | "Cheapest";
};

export type RideAddOn = {
  id: string;
  label: string;
  priceCents: number;
};

export type SavedPlace = {
  id: string;
  label: string;
  address: string;
  glyph?: string;
};

export type ServiceTile = {
  id: string;
  title: string;
  description: string;
  glyph: string;
  status: "available" | "unavailable";
  meta?: { value?: string; note?: string };
};

export const RIDER_PICKUP = "Current location";
export const RIDER_DESTINATION = "Pinned location";
export const RIDER_ROUTE = { miles: 38, minutes: 52 };

export const RIDE_TIERS: RideTier[] = [
  { id: "lime", title: "Lime", description: "Everyday ride", seats: 4, detail: "4 min away · 9:09 PM dropoff", fareCents: 501, glyph: "car", badge: "Fastest" },
  { id: "wait-save", title: "Wait & Save", description: "Wait longer and save", seats: 4, detail: "Wait up to 12 min · 9:17 PM dropoff", fareCents: 470, glyph: "clock" },
  { id: "xl", title: "Lime XL", description: "Room for more people", seats: 6, detail: "7 min away · 9:12 PM dropoff", fareCents: 607, glyph: "people" },
  { id: "comfort", title: "Lime Comfort", description: "Newer cars, quiet ride", seats: 4, detail: "6 min away · 9:11 PM dropoff", fareCents: 571, glyph: "sparkle" },
  { id: "pool", title: "Lime Pool", description: "Share the ride", seats: 2, detail: "9 min away · 9:14 PM dropoff", fareCents: 431, glyph: "people", badge: "Cheapest" },
];

export const RIDE_ADD_ONS: RideAddOn[] = [
  { id: "coffee", label: "Coffee", priceCents: 500 },
  { id: "tea", label: "Tea", priceCents: 500 },
  { id: "sparkling-water", label: "Sparkling water", priceCents: 500 },
];

export const SAVED_PLACES: SavedPlace[] = [
  { id: "home", label: "Home", address: "1247 Maple Ave, Ontario", glyph: "🏠" },
  { id: "work", label: "Work", address: "400 S Hope St, Los Angeles", glyph: "💼" },
  { id: "lax", label: "LAX", address: "1 World Way, Los Angeles", glyph: "✈️" },
];

export const RECENT_PLACES: SavedPlace[] = [
  { id: "r1", label: "Trader Joe's", address: "3450 E Imperial Hwy, Lynwood", glyph: "🕐" },
  { id: "r2", label: "Staples Center", address: "1111 S Figueroa St, Los Angeles", glyph: "🕐" },
];

export const SERVICE_TILES: ServiceTile[] = [
  { id: "ride", title: "Ride", description: "Get there", glyph: "🚗", status: "available" },
  { id: "courier", title: "Send", description: "Packages & food", glyph: "📦", status: "available" },
  { id: "help", title: "Help", description: "Errands & care", glyph: "🤝", status: "available" },
  { id: "spaces", title: "Spaces", description: "Park & store", glyph: "🅿️", status: "available",
    meta: { note: "From $4/hr" } },
  { id: "shop", title: "Shop", description: "Buy for me", glyph: "🛒", status: "unavailable" },
  { id: "freight", title: "Freight", description: "Ship loads", glyph: "🚛", status: "available" },
];

export const QUOTE_LINES = [
  { label: "Base fare", value: "$14.20" },
  { label: "Distance", value: "$3.80" },
  { label: "Time", value: "$2.40" },
  { label: "Service fee", value: "$1.50" },
];

export const DRIVER = {
  name: "Rosa Alvarez",
  vehicle: "Silver Toyota Prius",
  plate: "8KJT402",
  rating: "4.9",
  eta: "4 min",
};

export const TRIP_MILESTONES = [
  { label: "Driver assigned", done: true },
  { label: "En route to pickup", done: true },
  { label: "Arriving", done: false },
  { label: "Pickup", done: false },
  { label: "Drop-off", done: false },
];

export const COMPLETION = {
  headline: "You arrived",
  total: "$22.90",
  lines: [
    { label: "5.2 mi", value: "18 min" },
    { label: "Payment", value: "Visa ·••• 4242" },
  ],
};

export const PAYMENT = { label: "Visa", detail: "···· 4412" };

export type PickupSpot = {
  id: string;
  label: string;
  detail?: string;
  latitude: number;
  longitude: number;
};

/**
 * Curb options for one address. Production calls these pickup candidates and derives them from
 * the place; here they are deterministic, because the interaction being reproduced is choosing
 * between them and revising the address — not how a server ranks them.
 */
export const PICKUP_SPOTS: PickupSpot[] = [
  { id: "front", label: "Front entrance", detail: "Current location", latitude: 34.06, longitude: -117.6 },
];
