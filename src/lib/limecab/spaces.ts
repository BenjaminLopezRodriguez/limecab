/**
 * Lime Spaces — a room or a venue, near a place, at a time.
 *
 * Pure. Lime is the concierge here, not the hotel: this file knows how to
 * price and order what a partner or the spatial index offers, and nothing
 * about inventory, availability calendars, or holds.
 *
 * The unit matters more than the number. A meeting room is priced by the
 * hour and a stay by the night, so a total is meaningless without the span
 * the rider chose — which is why `spacesTotalCents` refuses to guess one.
 */

import { formatMoney } from "../service-app/services.ts";

export const SPACE_KINDS = [
  { id: "meeting", label: "Meeting room", unit: "hour" },
  { id: "venue", label: "Event venue", unit: "hour" },
  { id: "stay", label: "Stay overnight", unit: "night" },
] as const;

export type SpaceKind = (typeof SPACE_KINDS)[number]["id"];
export type SpaceUnit = (typeof SPACE_KINDS)[number]["unit"];

export function spaceKindLabel(kind: SpaceKind): string {
  return SPACE_KINDS.find((k) => k.id === kind)?.label ?? "Space";
}

export function spaceKindUnit(kind: SpaceKind): SpaceUnit {
  return SPACE_KINDS.find((k) => k.id === kind)?.unit ?? "hour";
}

export type SpaceOption = {
  id: string;
  name: string;
  kind: SpaceKind;
  /** Per hour for meeting/venue, per night for stay. */
  priceCents: number;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  capacity?: number;
};

/**
 * How long the rider is booking for. Hours for a room, nights for a stay —
 * one number, read against the option's own unit.
 */
export const SPACES_SPANS = [
  { id: "1", label: "1", spans: 1 },
  { id: "2", label: "2", spans: 2 },
  { id: "4", label: "4", spans: 4 },
  { id: "8", label: "8", spans: 8 },
] as const;

export type SpacesSpanId = (typeof SPACES_SPANS)[number]["id"];

export function spacesSpan(id: SpacesSpanId): number {
  return SPACES_SPANS.find((s) => s.id === id)?.spans ?? 1;
}

export function spacesTotalCents(
  option: Pick<SpaceOption, "priceCents">,
  spanId: SpacesSpanId,
): number {
  return option.priceCents * spacesSpan(spanId);
}

export function spacesPriceLabel(
  option: Pick<SpaceOption, "priceCents">,
  spanId: SpacesSpanId,
): string {
  return formatMoney(spacesTotalCents(option, spanId));
}

/** "$180/hr · seats 12" — capacity only when the partner told us. */
export function spacesRateLabel(option: SpaceOption): string {
  const unit = spaceKindUnit(option.kind) === "night" ? "night" : "hr";
  const rate = `${formatMoney(option.priceCents)}/${unit}`;
  return option.capacity ? `${rate} · seats ${option.capacity}` : rate;
}

/** Cheapest first within a kind: the rider filtered, now they compare price. */
export function rankSpaceOptions(
  options: readonly SpaceOption[],
  kind: SpaceKind | null,
): SpaceOption[] {
  return options
    .filter((option) => (kind ? option.kind === kind : true))
    .sort((a, b) => a.priceCents - b.priceCents);
}

/**
 * Demo density for a thin index. Real Los Angeles buildings, invented rates
 * and capacities — the surface labels these as simulated.
 */
export const SPACES_FIXTURES: SpaceOption[] = [
  {
    id: "space-bradbury",
    name: "Bradbury Building · Room 3",
    kind: "meeting",
    priceCents: 6_500,
    latitude: 34.0505,
    longitude: -118.2478,
    distanceMeters: 260,
    capacity: 8,
  },
  {
    id: "space-spring-loft",
    name: "Spring Street Loft",
    kind: "meeting",
    priceCents: 4_800,
    latitude: 34.0472,
    longitude: -118.2495,
    distanceMeters: 640,
    capacity: 14,
  },
  {
    id: "space-grand-central-room",
    name: "Grand Central Market · Mezzanine",
    kind: "meeting",
    priceCents: 5_500,
    latitude: 34.0507,
    longitude: -118.2487,
    distanceMeters: 410,
    capacity: 10,
  },
  {
    id: "space-union-hall",
    name: "Union Station Ticket Hall",
    kind: "venue",
    priceCents: 24_000,
    latitude: 34.0561,
    longitude: -118.2365,
    distanceMeters: 1_100,
    capacity: 200,
  },
  {
    id: "space-arts-warehouse",
    name: "Arts District Warehouse",
    kind: "venue",
    priceCents: 18_500,
    latitude: 34.0407,
    longitude: -118.2337,
    distanceMeters: 1_800,
    capacity: 120,
  },
  {
    id: "space-broadway-theatre",
    name: "Broadway Theatre Lobby",
    kind: "venue",
    priceCents: 15_000,
    latitude: 34.0464,
    longitude: -118.2506,
    distanceMeters: 1_250,
    capacity: 90,
  },
  {
    id: "space-grand-hotel",
    name: "Grand Avenue Hotel",
    kind: "stay",
    priceCents: 21_000,
    latitude: 34.0532,
    longitude: -118.2506,
    distanceMeters: 520,
  },
  {
    id: "space-bunker-hill-suites",
    name: "Bunker Hill Suites",
    kind: "stay",
    priceCents: 18_200,
    latitude: 34.0549,
    longitude: -118.2512,
    distanceMeters: 760,
  },
  {
    id: "space-little-tokyo-inn",
    name: "Little Tokyo Inn",
    kind: "stay",
    priceCents: 16_400,
    latitude: 34.0505,
    longitude: -118.2400,
    distanceMeters: 980,
  },
];
