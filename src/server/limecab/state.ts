/**
 * Authoritative LimeCab trip state machine. Pure — no DB, no I/O.
 * The router must ask this before writing `status`; nothing else decides
 * whether a transition is legal.
 */

export const TRIP_STATUSES = [
  "requested",
  "matched",
  "arriving",
  "in_progress",
  "complete",
  "cancelled",
] as const;

export type TripStatus = (typeof TRIP_STATUSES)[number];

export const TERMINAL_TRIP_STATUSES: readonly TripStatus[] = [
  "complete",
  "cancelled",
];

const ALLOWED: Record<TripStatus, readonly TripStatus[]> = {
  requested: ["matched", "cancelled"],
  matched: ["arriving", "cancelled"],
  arriving: ["in_progress", "cancelled"],
  // Once the rider is in the car the ride ends by finishing, not by cancelling.
  in_progress: ["complete"],
  complete: [],
  cancelled: [],
};

export type RiderAction = "cancel";
export type DriverAction = "accept" | "arrive" | "start" | "complete" | "cancel";

const RIDER_ACTIONS: Record<TripStatus, readonly RiderAction[]> = {
  requested: ["cancel"],
  matched: ["cancel"],
  arriving: ["cancel"],
  in_progress: [],
  complete: [],
  cancelled: [],
};

const DRIVER_ACTIONS: Record<TripStatus, readonly DriverAction[]> = {
  requested: ["accept"],
  matched: ["arrive", "cancel"],
  arriving: ["start", "cancel"],
  in_progress: ["complete"],
  complete: [],
  cancelled: [],
};

/** Status a given action moves the trip to. */
export const RIDER_ACTION_TARGET: Record<RiderAction, TripStatus> = {
  cancel: "cancelled",
};

export const DRIVER_ACTION_TARGET: Record<DriverAction, TripStatus> = {
  accept: "matched",
  arrive: "arriving",
  start: "in_progress",
  complete: "complete",
  cancel: "cancelled",
};

export function isTripStatus(value: string): value is TripStatus {
  return (TRIP_STATUSES as readonly string[]).includes(value);
}

export function isTerminalStatus(status: TripStatus): boolean {
  return TERMINAL_TRIP_STATUSES.includes(status);
}

export function canTransition(from: TripStatus, to: TripStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function riderMay(status: TripStatus, action: string): boolean {
  return (
    (RIDER_ACTIONS[status] as readonly string[])?.includes(action) ?? false
  );
}

export function driverMay(status: TripStatus, action: string): boolean {
  return (
    (DRIVER_ACTIONS[status] as readonly string[])?.includes(action) ?? false
  );
}
