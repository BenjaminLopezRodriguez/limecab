/**
 * Lime Station — parking, priced by how long the rider needs it.
 *
 * Pure. The scene renders what this returns and asks nothing else: a lot's
 * price is a function of its hourly rate and a duration the rider already
 * chose, so there is nothing here for a component to recompute differently.
 *
 * Walk time is the honest part. We have straight-line metres and no routing
 * for pedestrians, so `walkMinutes` is derived from distance at a walking
 * pace and the surface must label it as an estimate — never as a measured
 * walk down a real sidewalk.
 */

import { formatMoney } from "../service-app/services.ts";

/** Metres per minute at an unhurried walk with a bag. */
const WALK_M_PER_MIN = 75;

export const STATION_DURATIONS = [
  { id: "1h", label: "1 hr", hours: 1 },
  { id: "2h", label: "2 hr", hours: 2 },
  { id: "4h", label: "4 hr", hours: 4 },
  { id: "day", label: "All day", hours: 12 },
] as const;

export type StationDurationId = (typeof STATION_DURATIONS)[number]["id"];

export function stationDuration(id: StationDurationId) {
  return STATION_DURATIONS.find((d) => d.id === id) ?? STATION_DURATIONS[0];
}

export type StationOption = {
  id: string;
  name: string;
  /** Hourly rate in cents. All-day is capped, not multiplied out. */
  hourlyCents: number;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  /** Display only, e.g. "10 PM". Absent when we do not know. */
  openUntil?: string;
};

export function walkMinutes(distanceMeters: number): number {
  return Math.max(1, Math.round(distanceMeters / WALK_M_PER_MIN));
}

/**
 * A day is not twelve times an hour anywhere that sells parking, so the
 * all-day price is capped at six hours' worth. Invented, and labelled as a
 * simulated rate wherever it is shown.
 *
 * ponytail: flat cap, no tiered rate card. Swap in real lot pricing when
 * there is any — the shape below does not change.
 */
const DAY_CAP_HOURS = 6;

export function stationTotalCents(
  option: Pick<StationOption, "hourlyCents">,
  durationId: StationDurationId,
): number {
  const { hours } = stationDuration(durationId);
  const billed = Math.min(hours, DAY_CAP_HOURS);
  return option.hourlyCents * billed;
}

export function stationPriceLabel(
  option: Pick<StationOption, "hourlyCents">,
  durationId: StationDurationId,
): string {
  return formatMoney(stationTotalCents(option, durationId));
}

/** "6 min walk · until 10 PM" — the second half only when it is known. */
export function stationMetaLabel(option: StationOption): string {
  const walk = `${walkMinutes(option.distanceMeters)} min walk`;
  return option.openUntil ? `${walk} · until ${option.openUntil}` : walk;
}

/** Nearest first: a rider choosing parking is choosing a walk. */
export function rankStationOptions(
  options: readonly StationOption[],
): StationOption[] {
  return [...options].sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/**
 * Demo density for a thin index. Real Los Angeles lots, invented rates —
 * the surface says "Simulated rate" wherever one of these is priced.
 */
export const STATION_FIXTURES: StationOption[] = [
  {
    id: "station-grand-central",
    name: "Grand Central Market Garage",
    hourlyCents: 350,
    latitude: 34.0507,
    longitude: -118.2487,
    distanceMeters: 210,
    openUntil: "10 PM",
  },
  {
    id: "station-pershing",
    name: "Pershing Square Garage",
    hourlyCents: 300,
    latitude: 34.0486,
    longitude: -118.2528,
    distanceMeters: 480,
    openUntil: "11 PM",
  },
  {
    id: "station-union",
    name: "Union Station Lot B",
    hourlyCents: 275,
    latitude: 34.0561,
    longitude: -118.2365,
    distanceMeters: 900,
  },
  {
    id: "station-arts-district",
    name: "Arts District Surface Lot",
    hourlyCents: 225,
    latitude: 34.0407,
    longitude: -118.2337,
    distanceMeters: 1400,
    openUntil: "9 PM",
  },
];
