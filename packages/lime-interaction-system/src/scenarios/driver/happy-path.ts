import { sceneId, surfaceId } from "../../core/index.ts";
import type { MapMode, MapPoint } from "../../core/map.ts";
import type { SurfaceLayout } from "../../core/surface.ts";
import type { ScenarioDefinition } from "../../harness/flow-machine.ts";
import { DRIVER_JOB, DRIVER_OFFER, EARNINGS_TRIP } from "../../fixtures/driver.ts";

/**
 * The driver job, projected into interaction state.
 *
 * Driver fixtures and driver scenes both already existed, but the flow between them had never
 * been written down as a scenario — it only existed as the sequence a person clicked through in
 * Storybook. This is that sequence made deterministic and reconstructible, using the same
 * fixtures the web scenes render.
 *
 * The shape mirrors `rider/happy-path.ts` deliberately: same machine, same surface vocabulary,
 * different product. If driver needed its own machine, the extraction would have failed.
 */

const PRIMARY = surfaceId("primary");

const DRIVER: MapPoint = { id: "o", role: "subject", latitude: 34.06, longitude: -117.6, label: "You" };
const PICKUP: MapPoint = { id: "p", role: "origin", latitude: 34.055, longitude: -117.68, label: DRIVER_OFFER.pickup };
const DROP: MapPoint = { id: "d", role: "destination", latitude: 34.05, longitude: -118.25, label: DRIVER_OFFER.destination };

const peek = (): SurfaceLayout => ({
  [PRIMARY]: { emphasis: "primary", presentation: "peek", interaction: "active" },
});
const sheet = (): SurfaceLayout => ({
  [PRIMARY]: { emphasis: "primary", presentation: "sheet", interaction: "active" },
});
/** An offer arrives unbidden and owns the screen until answered — that is an interrupt. */
const offer = (): SurfaceLayout => ({
  [PRIMARY]: { emphasis: "interrupt", presentation: "compact-interrupt", interaction: "active" },
});

export type DriverStep =
  | "offline" | "online" | "offer" | "enRoute" | "arrived" | "inTrip" | "complete" | "earnings";

export interface DriverSceneData {
  eyebrow?: string;
  headline: string;
  supporting?: string;
  primaryAction?: string;
  secondaryAction?: string;
}

/** Copy lives beside the scenario so a renderer never invents product language. */
export const driverCopy: Record<DriverStep, DriverSceneData> = {
  offline: { eyebrow: "Offline", headline: "You're offline", supporting: "Go online to receive offers", primaryAction: "Go online" },
  online: { eyebrow: "Online", headline: "Waiting for offers", supporting: "Ontario, CA · high demand nearby", primaryAction: "Go offline" },
  offer: {
    eyebrow: `${DRIVER_OFFER.arrival} away`,
    headline: DRIVER_OFFER.total,
    supporting: `${DRIVER_OFFER.product} · ${DRIVER_OFFER.distance} · ${DRIVER_OFFER.duration}`,
    primaryAction: "Accept",
    secondaryAction: "Decline",
  },
  enRoute: { eyebrow: "To pickup", headline: DRIVER_JOB.pickup, supporting: `${DRIVER_OFFER.arrival} · ${DRIVER_JOB.meetingPoint}`, primaryAction: "Arrived" },
  arrived: { eyebrow: "At pickup", headline: "Waiting for rider", supporting: `PIN required · ${DRIVER_JOB.pickup}`, primaryAction: "Start trip" },
  inTrip: { eyebrow: "On trip", headline: DRIVER_OFFER.destination, supporting: `${DRIVER_OFFER.duration} remaining`, primaryAction: "Complete trip" },
  complete: { eyebrow: "Trip complete", headline: EARNINGS_TRIP.total, supporting: EARNINGS_TRIP.route, primaryAction: "See earnings" },
  earnings: { eyebrow: "Earnings", headline: EARNINGS_TRIP.total, supporting: EARNINGS_TRIP.headline, primaryAction: "Back online" },
};

const step = (
  id: DriverStep,
  surfaces: SurfaceLayout,
  points: MapPoint[],
  mode: MapMode,
  camera?: "fit" | "follow" | "center" | "preserve",
  announcement?: string,
) => ({
  frame: {
    scene: {
      id: sceneId(`driver.${id}`),
      surfaces,
      map: {
        mode,
        points,
        route: points.length >= 2 ? { originId: "p", destinationId: "d" } : undefined,
        ...(camera ? { camera: { intent: camera } } : {}),
      },
      metadata: { product: "driver", state: id },
    },
    // Driver drops app chrome entirely while working — the job owns the screen.
    shell: { navigationVisibility: "hidden" as const, topChrome: "driver" as const, bottomChrome: "driver" as const },
  },
  ...(announcement ? { announcement: { text: announcement, urgency: "polite" as const } } : {}),
});

export const driverHappyPath: ScenarioDefinition<DriverStep> = {
  id: "driver-happy-path",
  initial: "offline",
  order: ["offline", "online", "offer", "enRoute", "arrived", "inTrip", "complete", "earnings"],
  /** From accepting to completing, work continues whether or not the surface is on screen. */
  live: ["enRoute", "arrived", "inTrip"],
  steps: {
    offline: step("offline", peek(), [DRIVER], "home", "center"),
    online: { ...step("online", peek(), [DRIVER], "coverage", "center", "You are online."), intent: "progress" as const },
    offer: { ...step("offer", offer(), [DRIVER, PICKUP], "route_preview", "fit", "New offer. 18 dollars 40."), intent: "interrupt" as const },
    enRoute: { ...step("enRoute", sheet(), [DRIVER, PICKUP], "provider_arrival", "follow", "Offer accepted. Navigate to pickup."), intent: "progress" as const },
    arrived: { ...step("arrived", sheet(), [DRIVER, PICKUP], "provider_arrival", "center", "Arrived at pickup."), intent: "progress" as const },
    inTrip: { ...step("inTrip", sheet(), [PICKUP, DROP], "active_route", "follow", "Trip started."), intent: "progress" as const },
    complete: { ...step("complete", sheet(), [PICKUP, DROP], "results", "fit", "Trip complete."), intent: "progress" as const },
    earnings: { ...step("earnings", sheet(), [DRIVER], "results", "center"), intent: "expand" as const },
  },
};

export const driverInterrupts = [
  { id: "cancel", label: "Cancel this trip?" },
  { id: "support", label: "Contact support" },
] as const;
