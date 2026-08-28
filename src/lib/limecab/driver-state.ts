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
  courier = false,
): { question: string; action: string; exit: string } {
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
      return {
        question: courier ? "Have you reached the merchant?" : "Have you arrived?",
        action: "I’ve arrived",
        exit: "Cancel this job",
      };
    case "at_pickup":
      return {
        question: courier
          ? "Do you have the package?"
          : "Is the rider with you?",
        action: courier ? "Scan pickup" : "Start ride",
        exit: "Cancel this job",
      };
    case "on_trip":
      return {
        question: "Have you finished?",
        action: courier ? "Confirm delivery" : "Complete ride",
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

/** First paint for `/driver` — derived from the inbox the page already loaded. */
export function driverSceneFromInbox(
  inbox:
    | {
        driver?: { available: boolean } | null;
        active?: { status: string }[];
      }
    | null
    | undefined,
): DriverAppState {
  const activeStatus = inbox?.active?.[0]?.status;
  if (activeStatus) {
    const fromTrip = driverSceneForTripStatus(activeStatus);
    if (fromTrip) return fromTrip;
  }
  return inbox?.driver?.available ? "online" : "offline";
}
