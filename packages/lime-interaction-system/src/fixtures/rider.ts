/** Deterministic rider fixtures — no production domain types. */

export type RideTier = {
  id: string;
  title: string;
  detail: string;
  price: string;
  glyph: string;
  badge?: string;
  disabled?: boolean;
  disabledReason?: string;
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

export const RIDER_PICKUP = "Ontario, CA";
export const RIDER_DESTINATION = "Downtown Los Angeles";
export const RIDER_ROUTE = { miles: 38, minutes: 52 };

export const RIDE_TIERS: RideTier[] = [
  { id: "lime", title: "LimeGo", detail: "3 min away", price: "$18.40", glyph: "🚗", badge: "Cheapest" },
  { id: "comfort", title: "Comfort", detail: "5 min away", price: "$24.10", glyph: "🚙" },
  { id: "xl", title: "XL", detail: "Six seats · 8 min", price: "$31.75", glyph: "🚐", badge: "Fastest" },
  { id: "pickup", title: "Pickup", detail: "Unavailable in this area", price: "—", glyph: "🛻",
    disabled: true, disabledReason: "Not available here" },
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

export const PAYMENT = { label: "Visa", detail: "•••• 4242" };

export const PICKUP_SPOTS = [
  { id: "curb", label: "Curbside", detail: "Ontario St & 4th" },
  { id: "lot", label: "Parking lot", detail: "Behind the station" },
  { id: "door", label: "Main entrance", detail: "Use side door" },
];
