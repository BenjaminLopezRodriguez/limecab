/**
 * The driver's duty session, as scenes.
 *
 * This is the *UI* machine: which question the driver is being asked right
 * now. The authoritative trip machine lives in `server/limecab/state.ts` and
 * decides which actions are legal — nothing here may contradict it.
 *
 * The rider's `ServiceAppState` is not reused: the questions are different.
 * A rider asks "where to?"; a driver asks "do you want work?".
 *
 * An incoming offer is deliberately **not** a scene. It is an interruption of
 * `online`: the peek is suspended and restored byte-for-byte when the offer is
 * declined or times out, and only an accept progresses the session. Modelling
 * it as a scene would make the decline path a backwards transition, which is
 * exactly the thing `back` must never be.
 */

import { isCourierProduct } from "./courier.ts";
import type { ProximityBand } from "./freight-schedule.ts";
import { isHelpProduct } from "./help.ts";
import { isShopTrip } from "./shop-list.ts";

/**
 * What kind of job the driver is doing. Not a scene and not a state: the six
 * duty scenes are the same for every job — only the words change.
 *
 * Derived from the trip, never stored: a courier trip carrying a list is a
 * Shop job, which is why Shop has no product id and no inbox flag of its own.
 */
export type DriverJobKind = "ride" | "courier" | "shop" | "help" | "freight";

export function driverJobKind(
  trip: { productId: string; itemList?: string | null } | null | undefined,
): DriverJobKind {
  if (!trip) return "ride";
  if (isHelpProduct(trip.productId)) return "help";
  if (!isCourierProduct(trip.productId)) return "ride";
  return isShopTrip(trip.itemList) ? "shop" : "courier";
}

export const DRIVER_APP_STATES = [
  "offline",
  "online",
  "to_pickup",
  "at_pickup",
  "on_trip",
  "complete",
] as const;

export type DriverAppState = (typeof DRIVER_APP_STATES)[number];

export type DriverAppEvent =
  | "go_online"
  | "go_offline"
  | "accepted"
  | "arrived"
  | "started"
  | "completed"
  | "released"
  | "done";

/** Scenes where a job is running. Duty cannot be dropped inside one. */
export function isDriving(state: DriverAppState): boolean {
  return (
    state === "to_pickup" || state === "at_pickup" || state === "on_trip"
  );
}

export function reduceDriverAppState(
  state: DriverAppState,
  event: DriverAppEvent,
): DriverAppState {
  switch (event) {
    case "go_online":
      return state === "offline" ? "online" : state;

    // Uber does not let a driver disappear mid-job, and neither does this:
    // the server would still hold them to the trip.
    case "go_offline":
      return isDriving(state) ? state : "offline";

    case "accepted":
      return state === "online" ? "to_pickup" : state;

    case "arrived":
      return state === "to_pickup" ? "at_pickup" : state;

    case "started":
      return state === "at_pickup" ? "on_trip" : state;

    case "completed":
      return state === "on_trip" ? "complete" : state;

    // The job dropped before start — back in the hunt, still online.
    case "released":
      return state === "to_pickup" || state === "at_pickup" ? "online" : state;

    // The fare splash is read, not dismissed into a dead end: Uber puts the
    // driver straight back in the hunt, still online.
    case "done":
      return state === "complete" ? "online" : state;
  }
}

/**
 * Back never unwinds a job — the trip is real and the server owns it. From
 * duty, back is a no-op; leaving the app is the way out.
 */
export function backDriverAppState(state: DriverAppState): DriverAppState {
  return state;
}

/**
 * The one question each scene asks, its answer, and its way out. Scene
 * components read this instead of hardcoding "I've arrived" in JSX.
 */
export function driverAppQuestion(
  state: DriverAppState,
  kind: DriverJobKind = "ride",
): { question: string; action: string; exit: string } {
  const courier = kind === "courier" || kind === "shop";
  const shop = kind === "shop";
  /**
   * Freight asks its question per *load status*, not per scene: `at_pickup`
   * covers both "are they loading you" and "are you loaded". The headline and
   * the CTA come from `freightLoadQuestion`, which reads the server's own
   * ladder — these are only the fallbacks the scene never shows.
   */
  const freight = kind === "freight";
  // A visit is not a pickup and not a delivery: the driver arrives at a house,
  // starts the visit, finishes it. PIN is the wrong object at every step.
  const help = kind === "help";
  switch (state) {
    case "offline":
      return {
        question: "Do you want work?",
        action: "Go online",
        exit: "Stay off duty",
      };
    case "online":
      return {
        question: "Looking for rides",
        action: "Wait",
        exit: "Go offline",
      };
    case "to_pickup":
      if (freight) {
        return {
          question: "Have you reached the shipper?",
          action: "Continue",
          exit: "None",
        };
      }
      return {
        question: help
          ? "Have you arrived at the house?"
          : shop
            ? "Have you reached the store?"
            : courier
              ? "Have you reached the merchant?"
              : "Have you arrived?",
        action: "I’ve arrived",
        exit: "Cancel this job",
      };
    case "at_pickup":
      if (freight) {
        return {
          question: "Are you loaded?",
          action: "Continue",
          exit: "None",
        };
      }
      // Shop has nothing sealed to take custody of — the courier bought the
      // list themselves, so the question is the list and not a code.
      return {
        question: help
          ? "Ready to start the visit?"
          : shop
            ? "Did you get everything on the list?"
            : courier
              ? "Do you have the package?"
              : "Is the rider with you?",
        action: help
          ? "Start visit"
          : shop
            ? "Got the list"
            : courier
              ? "Scan pickup"
              : "Start ride",
        exit: "Cancel this job",
      };
    case "on_trip":
      if (freight) {
        return {
          question: "Have you delivered?",
          action: "Continue",
          exit: "None",
        };
      }
      return {
        question: help ? "Have you finished the visit?" : "Have you finished?",
        action: help
          ? "Complete visit"
          : courier
            ? "Confirm delivery"
            : "Complete ride",
        exit: "None",
      };
    case "complete":
      return {
        question: "What did you earn?",
        action: "Done",
        exit: "Back online",
      };
  }
}

/**
 * A live trip's server status is the truth about which scene the driver is
 * in — a refresh mid-job lands on the job, never on the GO button. Statuses
 * with no live scene (an unclaimed offer, a cancellation) return null.
 */
export function driverSceneForTripStatus(
  status: string,
): DriverAppState | null {
  switch (status) {
    case "matched":
      return "to_pickup";
    case "arriving":
      return "at_pickup";
    case "in_progress":
      return "on_trip";
    default:
      return null;
  }
}

/**
 * A live freight load's status, as a duty scene.
 *
 * The freight ladder is finer than the ride one — arrive, load, depart,
 * arrive, unload, deliver, POD — so several statuses share a scene. That is
 * the point: the scene decides only where the surfaces sit and what the map
 * draws. Which question is being asked, and which single action answers it,
 * comes from the server's own legal-action list.
 *
 * Statuses before a driver is assigned, and terminal ones, have no scene: the
 * driver is not on the road for them.
 */
export function freightSceneForLoadStatus(
  status: string,
): DriverAppState | null {
  switch (status) {
    case "DRIVER_ASSIGNED":
    case "EN_ROUTE_TO_PICKUP":
      return "to_pickup";
    case "AT_PICKUP":
    case "LOADING":
      return "at_pickup";
    case "IN_TRANSIT":
    case "AT_DELIVERY":
    case "UNLOADING":
    case "DELIVERED":
    case "POD_PENDING":
    case "EXCEPTION":
      return "on_trip";
    default:
      return null;
  }
}

/**
 * First paint for `/driver` — derived from the inbox the page already loaded.
 * Multiple live jobs: the current leg, not the newest accept.
 */
const LIVE_RANK: Record<string, number> = {
  in_progress: 0,
  arriving: 1,
  matched: 2,
};

function requestedTime(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }
  return 0;
}

/**
 * Live jobs as a queue: the one in progress first, then oldest matched.
 * Incoming accepts stack behind; they do not steal the current leg.
 */
export function rankLiveJobs<T extends { status: string; requestedAt?: unknown }>(
  jobs: readonly T[],
): T[] {
  return [...jobs].sort((a, b) => {
    const rank = (LIVE_RANK[a.status] ?? 9) - (LIVE_RANK[b.status] ?? 9);
    if (rank !== 0) return rank;
    return requestedTime(a.requestedAt) - requestedTime(b.requestedAt);
  });
}

export function currentJob<T extends { status: string; requestedAt?: unknown }>(
  jobs: readonly T[],
): T | undefined {
  return rankLiveJobs(jobs)[0];
}

export function driverSceneFromInbox(
  inbox:
    | {
        driver?: { available: boolean } | null;
        active?: { status: string; requestedAt?: unknown }[];
      }
    | null
    | undefined,
): DriverAppState {
  const activeStatus = currentJob(inbox?.active ?? [])?.status;
  if (activeStatus) {
    const fromTrip = driverSceneForTripStatus(activeStatus);
    if (fromTrip) return fromTrip;
  }
  return inbox?.driver?.available ? "online" : "offline";
}

/**
 * The map scene a live load is in. Not a duty scene: it changes what the
 * *camera* is a picture of, never which question the driver is answering.
 *
 * A ride has one spatial grammar — the block you are on — and freight has
 * three. `Ontario → Phoenix · 795 mi` drawn as a street-level route around
 * the driver's own block is the wrong picture: the job is a lane.
 *
 * - `to_pickup`      driver + shipper. Local, operational.
 * - `linehaul`       truck + receiver, whole corridor legible.
 * - `near_delivery`  local navigation again, at the far end.
 */
export type FreightMapScene = "to_pickup" | "linehaul" | "near_delivery";

export function freightMapScene(
  status: string,
  proximity: ProximityBand | null,
): FreightMapScene | null {
  const scene = freightSceneForLoadStatus(status);
  if (!scene) return null;
  if (scene !== "on_trip") return "to_pickup";
  // Only the road itself is a corridor. Once the server says the truck is at
  // the receiver the framing is local again, whatever the fix claims.
  if (status !== "IN_TRANSIT") return "near_delivery";
  // An unknown proximity keeps the lane: a corridor is the honest picture of
  // a truck in transit, and a guessed arrival is not.
  return proximity === "near" || proximity === "arrived"
    ? "near_delivery"
    : "linehaul";
}
