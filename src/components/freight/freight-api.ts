/**
 * Lime Freight client helpers — shapes + labels over `api.freight`.
 */

import type { DriverAction, EquipmentType, LoadStatus } from "@/lib/freight";
import { driverMay } from "@/lib/freight";
import { formatMoney } from "@/lib/service-app/services";
import { api, type RouterOutputs } from "@/trpc/react";

export const freight = api.freight;

export type FreightPlace = {
  address: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
};

export type StopRow = {
  sequence: number;
  /**
   * Widened deliberately: a stop row crosses tRPC as whatever the column
   * holds. `"PICKUP" | "DROPOFF" | string` collapsed to `string` anyway, so
   * it promised a narrowing the compiler never enforced.
   */
  type: string;
  address: string;
  city?: string | null;
  region?: string | null;
  lat: number;
  lng: number;
  appointmentStart?: Date | string | null;
  appointmentEnd?: Date | string | null;
  /** Facility free text — check-in, gate, parking. Never amenity data. */
  instructions?: string | null;
};

/** Normalized card for lists / search hits. */
export type FreightLoadCard = {
  id: string;
  status: string;
  equipmentType: EquipmentType;
  totalWeight: number;
  weightUnit?: string | null;
  distanceMeters: number;
  /**
   * Withheld by role, not always present. `redactLoadForRole` on the server
   * omits the money a viewer may not read — a driver sees neither, a shipper
   * never sees the carrier's side of the spread — so every surface that
   * prints one of these must say something when it is absent. `formatMoney`
   * on `undefined` would be `$NaN`; use `formatMoneyOrDash`.
   */
  shipperPriceMinor?: number;
  carrierRateMinor?: number;
  currency: string;
  simulated: boolean;
  stops?: StopRow[];
  deadheadMeters?: number | null;
};

export type FreightQuote = {
  loadId: string;
  amountMinor: number;
  carrierRateMinor?: number;
  currency: string;
  distanceMeters: number;
  equipmentType: EquipmentType;
  pricingVersion: string;
  simulated: boolean;
  expiresAt?: Date | string | null;
};

export type SearchHit = RouterOutputs["freight"]["searchLoads"][number];
export type GetQuoteResult = RouterOutputs["freight"]["getQuote"];

/** Seed ids from `src/server/freight/seed.ts` — demo assign defaults. */
export const FREIGHT_SEED = {
  driverUserId: "seed_freight_driver",
  vehicleId: "seed_freight_vehicle_dv101",
  carrierId: "seed_freight_carrier",
} as const;

export function authBlocked(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const data = "data" in error ? (error as { data?: { code?: string } | null }).data : null;
  const code = data?.code;
  return code === "UNAUTHORIZED" || code === "FORBIDDEN";
}

export function milesFromMeters(meters: number) {
  return meters / 1609.344;
}

export function formatMiles(meters: number) {
  return `${milesFromMeters(meters).toFixed(0)} mi`;
}

export function formatRatePerMile(
  rateMinor: number | undefined,
  meters: number,
) {
  const miles = milesFromMeters(meters);
  if (rateMinor == null || miles <= 0) return "—";
  return `$${(rateMinor / miles / 100).toFixed(2)}/mi`;
}

/**
 * Money that the viewer's role may have withheld. An em dash says "not yours
 * to see"; `$0.00` would say "this load pays nothing", which is a lie.
 */
export function formatMoneyOrDash(
  minor: number | undefined,
  currency?: string,
) {
  return minor == null ? "—" : formatMoney(minor, currency);
}

export const EQUIPMENT_LABEL: Record<EquipmentType, string> = {
  DRY_VAN: "Dry van",
  REEFER: "Reefer",
  FLATBED: "Flatbed",
};

export const DRIVER_CTA: Record<DriverAction, string> = {
  en_route_pickup: "En route to pickup",
  arrive_pickup: "Arrived at pickup",
  start_loading: "Start loading",
  depart_pickup: "Depart pickup",
  arrive_delivery: "Arrived at delivery",
  start_unloading: "Start unloading",
  finish_delivery: "Finish delivery",
  submit_pod: "Submit POD",
  report_exception: "Report exception",
};

const DRIVER_PRIMARY: DriverAction[] = [
  "en_route_pickup",
  "arrive_pickup",
  "start_loading",
  "depart_pickup",
  "arrive_delivery",
  "start_unloading",
  "finish_delivery",
  "submit_pod",
];

export function primaryDriverAction(status: string): DriverAction | null {
  return (
    DRIVER_PRIMARY.find((a) => driverMay(status as LoadStatus, a)) ?? null
  );
}

/**
 * The one question a load asks its driver right now, and the one action that
 * answers it.
 *
 * Freight's ladder is finer than a ride's, so the question belongs to the
 * *status*, not to the duty scene: `at_pickup` covers both "are they loading
 * you" and "are you loaded". The action is whatever the server says is legal
 * — never a label this file invented — so the sheet can never offer a step
 * the load machine would refuse.
 *
 * `POD_PENDING` and `EXCEPTION` have no driver action. They get a status line
 * and no button, because there is nothing for the driver to do.
 */
const LOAD_QUESTION: Record<string, string> = {
  DRIVER_ASSIGNED: "Head to pickup?",
  EN_ROUTE_TO_PICKUP: "Have you reached the shipper?",
  AT_PICKUP: "Are they loading you?",
  LOADING: "Are you loaded?",
  IN_TRANSIT: "Have you reached the receiver?",
  AT_DELIVERY: "Are they unloading you?",
  UNLOADING: "Is the trailer empty?",
  DELIVERED: "Do you have the paperwork?",
  POD_PENDING: "Paperwork is in",
  EXCEPTION: "This load is on hold",
};

export function freightLoadQuestion(status: string): {
  question: string;
  action: DriverAction | null;
  actionLabel: string | null;
} {
  const action = primaryDriverAction(status);
  return {
    question: LOAD_QUESTION[status] ?? status.replaceAll("_", " "),
    action,
    actionLabel: action ? DRIVER_CTA[action] : null,
  };
}

export function loadLaneLabel(load: {
  stops?: StopRow[] | null;
  originLabel?: string;
  destLabel?: string;
}) {
  if (load.originLabel && load.destLabel) {
    return `${load.originLabel} → ${load.destLabel}`;
  }
  const stops = load.stops ?? [];
  const pickup = stops.find((s) => s.type === "PICKUP");
  const drop = [...stops].reverse().find((s) => s.type === "DROPOFF");
  const a = pickup?.city ?? pickup?.address ?? "Origin";
  const b = drop?.city ?? drop?.address ?? "Destination";
  return `${a} → ${b}`;
}

export function nextStop(load: { stops?: StopRow[] | null; status: string }) {
  const stops = [...(load.stops ?? [])].sort((a, b) => a.sequence - b.sequence);
  const pickup = stops.find((s) => s.type === "PICKUP");
  const drop = stops.find((s) => s.type === "DROPOFF");
  const status = load.status;
  if (
    status === "DRIVER_ASSIGNED" ||
    status === "EN_ROUTE_TO_PICKUP" ||
    status === "AT_PICKUP" ||
    status === "LOADING"
  ) {
    return pickup ?? null;
  }
  return drop ?? pickup ?? null;
}

export function toStopInput(place: FreightPlace, appointmentStart?: Date) {
  return {
    address: place.address,
    city: place.city,
    region: place.region,
    lat: place.latitude,
    lng: place.longitude,
    appointmentStart,
  };
}

/** Guess city/region from a freeform address line. */
export function placeFromLocation(loc: {
  address: string;
  latitude?: number;
  longitude?: number;
  shortName?: string;
}): FreightPlace {
  const parts = loc.address.split(",").map((p) => p.trim());
  const city =
    parts.length >= 2 ? parts[parts.length - 2]! : (parts[0] ?? "Unknown");
  const regionPart = parts[parts.length - 1] ?? "XX";
  const region = regionPart.split(/\s+/)[0] ?? "XX";
  return {
    address: loc.address,
    city: city.slice(0, 128) || "Unknown",
    region: region.slice(0, 64) || "XX",
    latitude: loc.latitude ?? 34.05,
    longitude: loc.longitude ?? -118.25,
  };
}

export function quoteFromResult(result: GetQuoteResult): FreightQuote {
  const quote = result.quote;
  if (!quote) {
    throw new Error("Quote missing from getQuote result");
  }
  return {
    loadId: result.load.id,
    amountMinor: quote.amountMinor,
    carrierRateMinor: result.load.carrierRateMinor,
    currency: quote.currency,
    distanceMeters: result.load.distanceMeters,
    equipmentType: result.load.equipmentType,
    pricingVersion: quote.pricingVersion,
    simulated: result.load.simulated,
    expiresAt: quote.expiresAt,
  };
}

export function hitToLoad(hit: SearchHit): FreightLoadCard {
  const load = hit.load;
  return {
    id: load.id,
    status: load.status,
    equipmentType: load.equipmentType,
    totalWeight: load.totalWeight,
    weightUnit: load.weightUnit,
    distanceMeters: load.distanceMeters,
    shipperPriceMinor: load.shipperPriceMinor,
    carrierRateMinor: load.carrierRateMinor,
    currency: load.currency,
    simulated: load.simulated,
    stops: load.stops,
    deadheadMeters: hit.deadheadMeters,
  };
}

export function asLoadCard(
  load: {
    id: string;
    status: string;
    equipmentType: EquipmentType;
    totalWeight: number;
    weightUnit?: string | null;
    distanceMeters: number;
    shipperPriceMinor?: number;
    carrierRateMinor?: number;
    currency: string;
    simulated: boolean;
    stops?: StopRow[] | null;
  },
): FreightLoadCard {
  return {
    id: load.id,
    status: load.status,
    equipmentType: load.equipmentType,
    totalWeight: load.totalWeight,
    weightUnit: load.weightUnit,
    distanceMeters: load.distanceMeters,
    shipperPriceMinor: load.shipperPriceMinor,
    carrierRateMinor: load.carrierRateMinor,
    currency: load.currency,
    simulated: load.simulated,
    stops: load.stops ?? undefined,
  };
}

export function stopPoint(stop: StopRow | null | undefined) {
  if (!stop) return null;
  return { latitude: stop.lat, longitude: stop.lng };
}
