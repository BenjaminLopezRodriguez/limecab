import { sceneId, surfaceId } from "../../core/index.ts";
import type { MapMode, MapPoint } from "../../core/map.ts";
import type { SurfaceLayout } from "../../core/surface.ts";
import type { ScenarioDefinition } from "../../harness/flow-machine.ts";

const PRIMARY = surfaceId("primary");

const ONT: MapPoint = { id: "o", role: "origin", latitude: 34.06, longitude: -117.6, label: "Current location" };
const LA: MapPoint = { id: "d", role: "destination", latitude: 34.05, longitude: -118.25, label: "Pinned location" };
const CAR: MapPoint = { id: "c", role: "subject", latitude: 34.0, longitude: -117.9, label: "Driver" };

const peek = (): SurfaceLayout => ({
  [PRIMARY]: { emphasis: "primary", presentation: "peek", interaction: "active" },
});
const sheet = (): SurfaceLayout => ({
  [PRIMARY]: { emphasis: "primary", presentation: "sheet", interaction: "active" },
});

export type RiderStep =
  | "home" | "rideSelect" | "confirmPickup" | "matching" | "assigned" | "complete";

export type RiderInterrupt = "rideExtras" | "cancel" | "payment";

export interface RiderSceneData {
  eyebrow?: string;
  headline: string;
  supporting?: string;
  primaryAction?: string;
}

export const riderCopy: Record<RiderStep, RiderSceneData> = {
  home: { headline: "Where to?", supporting: "Ontario, CA" },
  rideSelect: { headline: "Choose a ride" },
  /** Pricing already happened on ride select; this scene only answers where the car stops. */
  confirmPickup: { headline: "Confirm pickup", supporting: "Current location", primaryAction: "Confirm pickup" },
  matching: { eyebrow: "Finding a driver", headline: "Matching your ride" },
  assigned: { eyebrow: "Driver assigned", headline: "Arriving in 4 min", supporting: "Rosa · Silver Prius", primaryAction: "Contact driver" },
  complete: { headline: "You arrived", supporting: "$22.90", primaryAction: "Done" },
};

const step = (
  id: RiderStep,
  surfaces: SurfaceLayout,
  points: MapPoint[],
  mode: MapMode,
  announcement?: string,
) => ({
  frame: {
    scene: {
      id: sceneId(`rider.${id}`),
      surfaces,
      map: { mode, points, route: points.length >= 2 ? { originId: "o", destinationId: "d" } : undefined,
        // Choosing a curb is a question about one point, so the camera goes to it rather than
        // fitting the whole route — at route zoom, moving between spots 100m apart is invisible.
        camera:
          mode === "active_route"
            ? { intent: "follow" as const }
            : mode === "select_location"
              ? { intent: "center" as const }
              : undefined },
      metadata: { product: "rider", state: id },
    },
  },
  ...(announcement ? { announcement: { text: announcement, urgency: "polite" as const } } : {}),
});

export const riderHappyPath: ScenarioDefinition<RiderStep> = {
  id: "rider-happy-path",
  initial: "home",
  order: ["home", "rideSelect", "confirmPickup", "matching", "assigned", "complete"],
  live: ["matching", "assigned"],
  steps: {
    home: step("home", peek(), [ONT], "home"),
    rideSelect: { ...step("rideSelect", sheet(), [ONT, LA], "route_preview"), intent: "progress" as const },
    /** The map is the subject here: the sheet names the curb, the canvas chooses it. */
    confirmPickup: { ...step("confirmPickup", sheet(), [ONT, LA], "select_location"), intent: "progress" as const },
    matching: step("matching", sheet(), [ONT, LA], "active_route", "Matching your ride."),
    assigned: step("assigned", sheet(), [ONT, LA, CAR], "active_route", "Driver assigned. Arriving in 4 minutes."),
    complete: step("complete", sheet(), [ONT, LA], "route_preview", "Trip complete."),
  },
};

export const riderInterrupts: readonly { id: RiderInterrupt; label: string }[] = [
  { id: "rideExtras", label: "Add something for the ride?" },
  { id: "cancel", label: "Cancel ride?" },
  { id: "payment", label: "Change payment" },
] as const;
