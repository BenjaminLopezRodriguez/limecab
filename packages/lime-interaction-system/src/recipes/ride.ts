import { createSurfaceManager, type SurfaceManagerConfig } from "../core/surface-manager.ts";
import type { MapMode } from "../core/map.ts";
import * as recipe from "./surfaces.ts";
import { SURFACES } from "./surfaces.ts";

/**
 * The Ride marketplace, both sides of it.
 *
 * Two configurations, not one: the rider and the driver share the kit, not the choreography.
 * Production keeps them in separate files for exactly this reason and the separation is worth
 * preserving — a driver's screen is a map with one sheet on it, and the loudest thing that
 * happens to it is an offer arriving.
 *
 * Every action below is a name for a composition in `surfaces.ts`. Nothing here decides how a
 * transition moves; the `intent` says what kind of change it is and the renderer owns the rest.
 */

const { map, primary, secondary, interrupt } = SURFACES;

const surfaces = {
  [map]: {
    role: "background" as const,
    initial: { emphasis: "background" as const, presentation: null, interaction: "passive" as const },
  },
  [primary]: {
    role: "primary" as const,
    presentations: ["peek", "sheet", "expanded", "launcher", "fullscreen"],
    initial: { emphasis: "primary" as const, presentation: "sheet", interaction: "active" as const },
  },
  [secondary]: {
    role: "secondary" as const,
    presentations: ["fullscreen"],
    initial: { emphasis: "hidden" as const, presentation: null, interaction: "inert" as const },
  },
  [interrupt]: {
    role: "interrupt" as const,
    // Payment is an interruption that happens to want the whole screen.
    presentations: ["compact-interrupt", "sheet", "fullscreen", "overlay"],
    initial: { emphasis: "hidden" as const, presentation: null, interaction: "inert" as const },
  },
};

export const rideSurfaces = createSurfaceManager({
  surfaces,
  actions: {
    /** "Where to?" and "correct the pickup" are one composition asked twice. */
    openSearch: { intent: "expand", surfaces: recipe.openSearch },
    /** A place came back. The route appears and the options rise over it. */
    placeSelected: { intent: "progress", surfaces: recipe.searchResolved },
    /** Set the pickup with a pin: the canvas is the subject, the sheet a strip. */
    chooseOnMap: { intent: "expand", surfaces: recipe.chooseOnMap },
    /** Pickup is the last unknown — map still the subject, sheet names the curb. */
    confirmPickup: { intent: "progress", surfaces: recipe.confirmOnMap },
    /** A tier is picked: one price, one action, nothing competing. */
    chooseRide: { intent: "progress", surfaces: recipe.restingTask },
    /** Requested. The quote leaves and the canvas carries the wait. */
    requestRide: { intent: "progress", surfaces: recipe.committing },
    /** Dispatch found nobody; the quote returns with its selections intact. */
    requestFailed: { intent: "progress", surfaces: recipe.restingTask },
    /** The in-car surface is tools and the driver, not a curb strip. */
    expandRide: { intent: "expand", surfaces: recipe.expandTask },
    /** A look away from the task: details, receipt, share. Never a new step. */
    askQuestion: { intent: "interrupt", surfaces: recipe.askQuestion },
    /** A list plus "add a method" is a prepared environment, not a drawer. */
    openPayment: { intent: "interrupt", surfaces: recipe.interruptFullscreen },
    /** Keyboard plus a thread. */
    openTripChat: { intent: "interrupt", surfaces: recipe.interruptOverlay },
    /** Add a stop to a running ride. The ride is held, not left. */
    addRideStop: { intent: "interrupt", surfaces: recipe.interruptWithSearch },
    /** "Keep ride" — the captured layout returns exactly as it was. */
    resume: { intent: "return", surfaces: recipe.dismissInterrupt },
    /** Back on a committed ride: it keeps running, the sheet stands down. */
    minimizeRide: { intent: "collapse", surfaces: recipe.minimizeLiveWork },
    /** The pill, tapped. */
    restoreRide: { intent: "expand", surfaces: recipe.restoreLiveWork },
    /** Leave a draft. A live ride minimizes instead — the request keeps running. */
    leaveTask: { intent: "progress", surfaces: recipe.restingTask },
  },
});

export const driverRideSurfaces = createSurfaceManager({
  surfaces,
  actions: {
    /** Off duty is a home, not a dimmer dash: the surface is the page. */
    goOffline: { intent: "collapse", surfaces: recipe.launcher },
    /** Online and hunting: the map is the app, the peek is a status line. */
    goOnline: { intent: "progress", surfaces: recipe.chooseOnMap },
    /** "Let me look at where it is busy." A question about the map, never a duty change. */
    expandIdleMap: { intent: "expand", surfaces: recipe.worldOnly },
    collapseIdleMap: { intent: "collapse", surfaces: recipe.chooseOnMap },
    /** The loudest thing that happens to a driver's screen. */
    offerIncoming: { intent: "interrupt", surfaces: recipe.offerArriving },
    offerDismissed: { intent: "return", surfaces: recipe.dismissInterrupt },
    /** Accepted, arrived, started, completed — one working composition throughout. */
    working: { intent: "progress", surfaces: recipe.restingTask },
    /** A question about the duty session: the sheet is held behind it. */
    askQuestion: { intent: "interrupt", surfaces: recipe.askQuestion },
    openTripChat: { intent: "interrupt", surfaces: recipe.interruptOverlay },
    resume: { intent: "return", surfaces: recipe.dismissInterrupt },
    /** A live job stands down; it never disappears. */
    minimizeJob: { intent: "collapse", surfaces: recipe.minimizeLiveWork },
    restoreJob: { intent: "expand", surfaces: recipe.restoreLiveWork },
  },
});

export type RideAction = keyof (typeof rideSurfaces)["actions"];
export type DriverRideAction = keyof (typeof driverRideSurfaces)["actions"];

/**
 * What the canvas is showing, per product state.
 *
 * Kept apart from the surface recipes because it answers a different question: the recipes say
 * how present the map is, this says what it is drawing. Production conflates the two into
 * `SurfaceState.presentation`; the contract separates them, so this maps straight onto
 * `MapSceneState.mode`.
 */
export const RIDE_MAP_MODE = {
  home: "home",
  locating: "select_location",
  dispatch: "coverage",
  route: "route_preview",
  tracking: "provider_arrival",
  trip: "active_route",
  receipt: "results",
} as const satisfies Record<string, MapMode>;

export type RidePosture = keyof typeof RIDE_MAP_MODE;

export type RideSurfaceConfig = SurfaceManagerConfig<string, string>;
