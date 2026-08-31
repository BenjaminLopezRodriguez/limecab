import { sceneId } from "../../core/index.ts";
import type { MapPoint } from "../../core/map.ts";
import type { SurfaceLayout } from "../../core/surface.ts";
import { surfaceId } from "../../core/index.ts";
import type { ScenarioDefinition } from "../../harness/flow-machine.ts";

/**
 * The §32 architecture test, as data.
 *
 * Scenario PROJECTION types only — no FreightLoad, no Drizzle row, no tRPC. The design system
 * must not know every business field; production maps its domain into this shape later.
 * All money is mock/demo.
 */
const PRIMARY = surfaceId("primary");

const ONT: MapPoint = { id: "o", role: "origin", latitude: 34.06, longitude: -117.6, label: "Ontario, CA" };
const PHX: MapPoint = { id: "d", role: "destination", latitude: 33.45, longitude: -112.07, label: "Phoenix, AZ" };
const TRUCK: MapPoint = { id: "s", role: "subject", latitude: 33.8, longitude: -114.5, label: "Truck" };

const sheet = (): SurfaceLayout => ({
  [PRIMARY]: { emphasis: "primary", presentation: "sheet", interaction: "active" },
});

export type FreightStep =
  | "assigned" | "toPickup" | "atPickup" | "loading" | "loaded"
  | "linehaul" | "atDelivery" | "unloading" | "pod" | "complete";

/** What a freight surface actually renders. Nothing more. */
export interface FreightSceneData {
  eyebrow: string;
  headline: string;
  supporting?: string;
  primaryAction?: string;
}

export const freightCopy: Record<FreightStep, FreightSceneData> = {
  assigned:   { eyebrow: "Assigned", headline: "Load LC-4417", supporting: "Ontario → Phoenix · 795 mi · Dry van", primaryAction: "Start trip" },
  toPickup:   { eyebrow: "En route to pickup", headline: "Ontario, CA", supporting: "ETA 42m", primaryAction: "Arrived at pickup" },
  atPickup:   { eyebrow: "At pickup", headline: "Dock 14", supporting: "Check in with the gate", primaryAction: "Begin loading" },
  loading:    { eyebrow: "Loading", headline: "34,000 lb", supporting: "Dry van · seal 88213", primaryAction: "Loaded" },
  loaded:     { eyebrow: "Loaded", headline: "Ready to depart", supporting: "Seal verified", primaryAction: "Depart" },
  linehaul:   { eyebrow: "In transit", headline: "Linehaul", supporting: "ETA 6h 12m · 512 mi remaining", primaryAction: "Arrived at delivery" },
  atDelivery: { eyebrow: "At delivery", headline: "Phoenix, AZ", supporting: "Dock 3", primaryAction: "Begin unloading" },
  unloading:  { eyebrow: "Unloading", headline: "In progress", supporting: "Seal broken 14:22", primaryAction: "Capture POD" },
  pod:        { eyebrow: "Proof of delivery", headline: "Signature captured", supporting: "R. Alvarez", primaryAction: "Complete" },
  complete:   { eyebrow: "Complete", headline: "$1,840.00", supporting: "Demo data · settles in 3 days" },
};

const step = (
  id: FreightStep,
  points: MapPoint[],
  mode: "route_preview" | "provider_arrival" | "active_route" | "results",
  camera: "fit" | "follow" = "fit",
  announcement?: string,
) => ({
  frame: {
    scene: {
      id: sceneId(`freight.${id}`),
      surfaces: sheet(),
      map: { mode, points, route: { originId: "o", destinationId: "d" }, camera: { intent: camera } },
      metadata: { product: "freight", state: id },
    },
  },
  ...(announcement ? { announcement: { text: announcement, urgency: "polite" as const } } : {}),
});

export const freightHappyPath: ScenarioDefinition<FreightStep> = {
  id: "freight-happy-path",
  initial: "assigned",
  order: ["assigned", "toPickup", "atPickup", "loading", "loaded",
          "linehaul", "atDelivery", "unloading", "pod", "complete"],
  /** A 12-hour lane MUST be minimizable. This is why minimize is not optional. */
  live: ["toPickup", "atPickup", "loading", "loaded", "linehaul", "atDelivery", "unloading"],
  steps: {
    assigned:   step("assigned", [ONT, PHX], "route_preview"),
    toPickup:   step("toPickup", [ONT, PHX, TRUCK], "provider_arrival", "follow", "En route to pickup."),
    atPickup:   step("atPickup", [ONT, PHX], "provider_arrival", "fit", "Arrived at pickup."),
    loading:    step("loading", [ONT, PHX], "provider_arrival", "fit", "Loading."),
    loaded:     step("loaded", [ONT, PHX], "route_preview", "fit", "Loaded."),
    linehaul:   step("linehaul", [ONT, PHX, TRUCK], "active_route", "follow", "Linehaul. En route to Phoenix."),
    atDelivery: step("atDelivery", [ONT, PHX], "active_route", "fit", "Arrived at delivery."),
    unloading:  step("unloading", [ONT, PHX], "active_route", "fit", "Unloading."),
    pod:        step("pod", [ONT, PHX], "active_route", "fit", "Proof of delivery captured."),
    complete:   step("complete", [ONT, PHX], "results", "fit", "Delivered."),
  },
};

/** Exception interrupts, layered over live work without tearing it down. */
export const freightExceptions = [
  { id: "detention", label: "Detention started" },
  { id: "damage", label: "Damage found" },
  { id: "reschedule", label: "Appointment missed" },
] as const;
