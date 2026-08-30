/**
 * Authoritative Lime Freight load state machine. Pure — no DB, no I/O.
 * Router must ask before writing `status`; nothing else decides legality.
 */

export const LOAD_STATUSES = [
  "DRAFT",
  "QUOTE_PENDING",
  "QUOTED",
  "AVAILABLE",
  "BOOKED",
  "DRIVER_ASSIGNED",
  "EN_ROUTE_TO_PICKUP",
  "AT_PICKUP",
  "LOADING",
  "IN_TRANSIT",
  "AT_DELIVERY",
  "UNLOADING",
  "DELIVERED",
  "POD_PENDING",
  "COMPLETED",
  "CANCELED",
  "REJECTED",
  "EXCEPTION",
] as const;

export type LoadStatus = (typeof LOAD_STATUSES)[number];

export const TERMINAL_LOAD_STATUSES: readonly LoadStatus[] = [
  "COMPLETED",
  "CANCELED",
  "REJECTED",
];

const ALLOWED: Record<LoadStatus, readonly LoadStatus[]> = {
  DRAFT: ["QUOTE_PENDING", "CANCELED"],
  QUOTE_PENDING: ["QUOTED", "REJECTED", "CANCELED"],
  QUOTED: ["AVAILABLE", "REJECTED", "CANCELED"],
  AVAILABLE: ["BOOKED", "CANCELED", "REJECTED"],
  BOOKED: ["DRIVER_ASSIGNED", "CANCELED"],
  DRIVER_ASSIGNED: ["EN_ROUTE_TO_PICKUP", "CANCELED", "EXCEPTION"],
  EN_ROUTE_TO_PICKUP: ["AT_PICKUP", "EXCEPTION", "CANCELED"],
  AT_PICKUP: ["LOADING", "EXCEPTION", "CANCELED"],
  LOADING: ["IN_TRANSIT", "EXCEPTION"],
  IN_TRANSIT: ["AT_DELIVERY", "EXCEPTION"],
  AT_DELIVERY: ["UNLOADING", "EXCEPTION"],
  UNLOADING: ["DELIVERED", "EXCEPTION"],
  DELIVERED: ["POD_PENDING", "EXCEPTION"],
  POD_PENDING: ["COMPLETED", "EXCEPTION"],
  COMPLETED: [],
  CANCELED: [],
  REJECTED: [],
  EXCEPTION: [
    "EN_ROUTE_TO_PICKUP",
    "AT_PICKUP",
    "LOADING",
    "IN_TRANSIT",
    "AT_DELIVERY",
    "UNLOADING",
    "POD_PENDING",
    "CANCELED",
  ],
};

export type ShipperAction = "request_quote" | "publish" | "cancel" | "reject";
export type CarrierAction = "book" | "assign_driver" | "cancel";
export type DriverAction =
  | "en_route_pickup"
  | "arrive_pickup"
  | "start_loading"
  | "depart_pickup"
  | "arrive_delivery"
  | "start_unloading"
  | "finish_delivery"
  | "submit_pod"
  | "report_exception";
export type SystemAction = "complete" | "expire_quote";

export type LoadAction =
  | ShipperAction
  | CarrierAction
  | DriverAction
  | SystemAction;

export type LoadActor = "shipper" | "carrier" | "driver" | "system";

const SHIPPER_ACTIONS: Record<LoadStatus, readonly ShipperAction[]> = {
  DRAFT: ["request_quote", "cancel"],
  QUOTE_PENDING: ["cancel"],
  QUOTED: ["publish", "reject", "cancel"],
  AVAILABLE: ["cancel"],
  BOOKED: ["cancel"],
  DRIVER_ASSIGNED: ["cancel"],
  EN_ROUTE_TO_PICKUP: ["cancel"],
  AT_PICKUP: ["cancel"],
  LOADING: [],
  IN_TRANSIT: [],
  AT_DELIVERY: [],
  UNLOADING: [],
  DELIVERED: [],
  POD_PENDING: [],
  COMPLETED: [],
  CANCELED: [],
  REJECTED: [],
  EXCEPTION: ["cancel"],
};

const CARRIER_ACTIONS: Record<LoadStatus, readonly CarrierAction[]> = {
  DRAFT: [],
  QUOTE_PENDING: [],
  QUOTED: [],
  AVAILABLE: ["book"],
  BOOKED: ["assign_driver", "cancel"],
  DRIVER_ASSIGNED: ["cancel"],
  EN_ROUTE_TO_PICKUP: ["cancel"],
  AT_PICKUP: ["cancel"],
  LOADING: [],
  IN_TRANSIT: [],
  AT_DELIVERY: [],
  UNLOADING: [],
  DELIVERED: [],
  POD_PENDING: [],
  COMPLETED: [],
  CANCELED: [],
  REJECTED: [],
  EXCEPTION: ["cancel"],
};

const DRIVER_ACTIONS: Record<LoadStatus, readonly DriverAction[]> = {
  DRAFT: [],
  QUOTE_PENDING: [],
  QUOTED: [],
  AVAILABLE: [],
  BOOKED: [],
  DRIVER_ASSIGNED: ["en_route_pickup", "report_exception"],
  EN_ROUTE_TO_PICKUP: ["arrive_pickup", "report_exception"],
  AT_PICKUP: ["start_loading", "report_exception"],
  LOADING: ["depart_pickup", "report_exception"],
  IN_TRANSIT: ["arrive_delivery", "report_exception"],
  AT_DELIVERY: ["start_unloading", "report_exception"],
  UNLOADING: ["finish_delivery", "report_exception"],
  DELIVERED: ["submit_pod", "report_exception"],
  POD_PENDING: ["report_exception"],
  COMPLETED: [],
  CANCELED: [],
  REJECTED: [],
  EXCEPTION: [],
};

const SYSTEM_ACTIONS: Record<LoadStatus, readonly SystemAction[]> = {
  DRAFT: [],
  QUOTE_PENDING: ["expire_quote"],
  QUOTED: [],
  AVAILABLE: [],
  BOOKED: [],
  DRIVER_ASSIGNED: [],
  EN_ROUTE_TO_PICKUP: [],
  AT_PICKUP: [],
  LOADING: [],
  IN_TRANSIT: [],
  AT_DELIVERY: [],
  UNLOADING: [],
  DELIVERED: [],
  POD_PENDING: ["complete"],
  COMPLETED: [],
  CANCELED: [],
  REJECTED: [],
  EXCEPTION: [],
};

export const ACTION_TARGET: Record<LoadAction, LoadStatus> = {
  request_quote: "QUOTE_PENDING",
  publish: "AVAILABLE",
  cancel: "CANCELED",
  reject: "REJECTED",
  book: "BOOKED",
  assign_driver: "DRIVER_ASSIGNED",
  en_route_pickup: "EN_ROUTE_TO_PICKUP",
  arrive_pickup: "AT_PICKUP",
  start_loading: "LOADING",
  depart_pickup: "IN_TRANSIT",
  arrive_delivery: "AT_DELIVERY",
  start_unloading: "UNLOADING",
  finish_delivery: "DELIVERED",
  submit_pod: "POD_PENDING",
  report_exception: "EXCEPTION",
  complete: "COMPLETED",
  expire_quote: "REJECTED",
};

export function isLoadStatus(value: string): value is LoadStatus {
  return (LOAD_STATUSES as readonly string[]).includes(value);
}

export function isTerminalStatus(status: LoadStatus): boolean {
  return TERMINAL_LOAD_STATUSES.includes(status);
}

export function canTransition(from: LoadStatus, to: LoadStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function shipperMay(status: LoadStatus, action: string): boolean {
  return (
    (SHIPPER_ACTIONS[status] as readonly string[])?.includes(action) ?? false
  );
}

export function carrierMay(status: LoadStatus, action: string): boolean {
  return (
    (CARRIER_ACTIONS[status] as readonly string[])?.includes(action) ?? false
  );
}

export function driverMay(status: LoadStatus, action: string): boolean {
  return (
    (DRIVER_ACTIONS[status] as readonly string[])?.includes(action) ?? false
  );
}

export function systemMay(status: LoadStatus, action: string): boolean {
  return (
    (SYSTEM_ACTIONS[status] as readonly string[])?.includes(action) ?? false
  );
}

export function actorMay(
  actor: LoadActor,
  status: LoadStatus,
  action: string,
): boolean {
  switch (actor) {
    case "shipper":
      return shipperMay(status, action);
    case "carrier":
      return carrierMay(status, action);
    case "driver":
      return driverMay(status, action);
    case "system":
      return systemMay(status, action);
  }
}
