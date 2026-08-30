import { TRPCError } from "@trpc/server";

import {
  ACTION_TARGET,
  canTransition,
  driverMay,
  type DriverAction,
  type LoadStatus,
  systemMay,
} from "../../lib/freight/load-state.ts";

export function assertDriverAdvance(
  status: LoadStatus,
  action: DriverAction,
): LoadStatus {
  const to = ACTION_TARGET[action];
  if (!driverMay(status, action) || !canTransition(status, to)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `A ${status} load cannot ${action}.`,
    });
  }
  return to;
}

export function assertSystemComplete(status: LoadStatus): LoadStatus {
  const to = ACTION_TARGET.complete;
  if (!systemMay(status, "complete") || !canTransition(status, to)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `A ${status} load cannot complete.`,
    });
  }
  return to;
}

/** Which stop sequence to stamp for a driver action (0=pickup, 1=dropoff). */
export function stopTouchForAction(
  action: DriverAction,
): {
  sequence: 0 | 1;
  field:
    | "arrivalAt"
    | "checkInAt"
    | "loadingStartedAt"
    | "loadingFinishedAt"
    | "departedAt";
} | null {
  switch (action) {
    case "arrive_pickup":
      return { sequence: 0, field: "arrivalAt" };
    case "start_loading":
      return { sequence: 0, field: "loadingStartedAt" };
    case "depart_pickup":
      return { sequence: 0, field: "departedAt" };
    case "arrive_delivery":
      return { sequence: 1, field: "arrivalAt" };
    case "start_unloading":
      return { sequence: 1, field: "loadingStartedAt" };
    case "finish_delivery":
      return { sequence: 1, field: "departedAt" };
    default:
      return null;
  }
}
