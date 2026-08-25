/**
 * LimeCab domain model.
 *
 * Product types only. Nothing here is imported by the service-app kit — the
 * dependency runs one way: LimeCab knows about the kit, the kit knows nothing
 * about rides.
 */

import type { Location } from "@/lib/service-app/services";

/** A bookable ride tier. Priced and ETA'd per request, not per catalogue. */
export type RideProduct = {
  id: string;
  name: string;
  description: string;
  seats: number;
  etaMinutes: number;
  priceCents: number;
  status: "available" | "coming_soon";
};

export type Vehicle = {
  make: string;
  model: string;
  color: string;
  plate: string;
};

export type Driver = {
  id: string;
  name: string;
  rating: number;
  vehicle: Vehicle;
};

/**
 * Pickup is modelled separately from the rider's current position on purpose:
 * scheduled rides, airport curbs, and pickup correction all edit *this*, not
 * the device's GPS fix.
 */
export type Pickup = Location & {
  /** Rider-facing meeting instruction, e.g. "Front entrance". */
  meetingPoint?: string;
  /** True while pickup is simply following the device location. */
  followsDevice?: boolean;
};

export type Destination = Location;

export type RideRequest = {
  pickup: Pickup;
  destination: Destination;
  productId: string;
};

export type Fare = {
  baseCents: number;
  distanceCents: number;
  timeCents: number;
  bookingCents: number;
  totalCents: number;
};

export type Trip = {
  id: string;
  request: RideRequest;
  driver: Driver;
  fare: Fare;
  distanceMiles: number;
  /** Estimated in-car minutes, pickup → destination. */
  tripMinutes: number;
  /** Estimated minutes until the driver reaches the pickup. */
  arrivalMinutes: number;
};

export function vehicleLabel(vehicle: Vehicle): string {
  return `${vehicle.color} ${vehicle.make} ${vehicle.model} · ${vehicle.plate}`;
}

/**
 * Distance-and-time fare. Deterministic so a quote shown to the rider and the
 * receipt shown at the end are the same number.
 */
export function estimateFare(
  product: RideProduct,
  distanceMiles: number,
  tripMinutes: number,
): Fare {
  const rate = product.priceCents / 100;
  const baseCents = Math.round(180 * rate);
  const distanceCents = Math.round(distanceMiles * 165 * rate);
  const timeCents = Math.round(tripMinutes * 24 * rate);
  const bookingCents = 249;
  return {
    baseCents,
    distanceCents,
    timeCents,
    bookingCents,
    totalCents: baseCents + distanceCents + timeCents + bookingCents,
  };
}

/** Great-circle miles. Enough for an estimate; a routing provider replaces it. */
export function distanceMiles(a: Location, b: Location): number {
  if (
    a.latitude === undefined ||
    a.longitude === undefined ||
    b.latitude === undefined ||
    b.longitude === undefined
  ) {
    return 0;
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  // 3958.8 mi Earth radius; ×1.25 for the fact that streets are not straight.
  return 3958.8 * 2 * Math.asin(Math.sqrt(h)) * 1.25;
}

/** City driving, ~19 mph door to door. */
export function tripMinutes(miles: number): number {
  return Math.max(3, Math.round(miles * 3.15));
}
