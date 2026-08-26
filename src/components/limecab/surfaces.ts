/**
 * LimeCab's surface composition.
 *
 * The whole "how do the surfaces sit" configuration for the ride flow. The
 * kit's SurfaceManager knows none of these ids or action names; it only moves
 * whatever this file declares.
 *
 * Presentations are semantic, never per-viewport — AdaptiveSurface decides
 * that a "sheet" is a drawer on a phone and a floating panel on a desktop.
 */

import type { MapMode } from "@/lib/service-app/map-adapter";
import type { ServiceAppState } from "@/lib/service-app/state";
import {
  createSurfaceManager,
  type SurfaceRecipe,
} from "@/lib/service-app/surface-manager";

export type LimeCabSurfaceId = "map" | "primary" | "search" | "interrupt";

/** Map postures LimeCab uses, and what the canvas draws for each. */
export const LIMECAB_MAP_MODE: Record<string, MapMode> = {
  bounded: "home",
  locating: "select_location",
  dispatch: "coverage",
  route: "route_preview",
  tracking: "provider_arrival",
  trip: "active_route",
  receipt: "results",
};

export const limeCabSurfaces = createSurfaceManager({
  surfaces: {
    map: {
      role: "background",
      presentations: [
        "bounded",
        "locating",
        "dispatch",
        "route",
        "tracking",
        "trip",
        "receipt",
      ],
      initial: {
        emphasis: "background",
        presentation: "bounded",
        interaction: "passive",
      },
    },
    primary: {
      role: "primary",
      presentations: ["peek", "sheet", "expanded", "fullscreen"],
      initial: {
        emphasis: "primary",
        presentation: "sheet",
        interaction: "active",
      },
    },
    search: {
      role: "secondary",
      presentations: ["fullscreen"],
      initial: { emphasis: "hidden", presentation: null, interaction: "inert" },
    },
    interrupt: {
      role: "interrupt",
      presentations: ["compact-interrupt"],
      initial: { emphasis: "hidden", presentation: null, interaction: "inert" },
    },
  },
  actions: {
    /**
     * "Set location with pin" — search recedes, the canvas is the subject,
     * and a confirm strip holds the address.
     */
    chooseOnMap: {
      intent: "expand",
      surfaces: {
        map: {
          emphasis: "primary",
          presentation: "locating",
          interaction: "active",
        },
        primary: { emphasis: "primary", presentation: "peek" },
        search: { emphasis: "hidden" },
      },
    },
    /** "Where to?" — the search scene takes the screen; the map stays put. */
    openDestinationSearch: {
      intent: "expand",
      surfaces: {
        map: { emphasis: "background", presentation: "locating" },
        primary: { emphasis: "hidden" },
        search: { emphasis: "primary", presentation: "fullscreen" },
      },
    },
    /** Correcting the pickup. Same scene, different question. */
    openPickupSearch: {
      intent: "expand",
      surfaces: {
        map: { emphasis: "background", presentation: "locating" },
        primary: { emphasis: "hidden" },
        search: { emphasis: "primary", presentation: "fullscreen" },
      },
    },
    /** Destination chosen: the route appears, ride options rise over it. */
    destinationSelected: {
      intent: "progress",
      surfaces: {
        map: { emphasis: "background", presentation: "route" },
        primary: { emphasis: "primary", presentation: "sheet" },
        search: { emphasis: "hidden" },
      },
    },
    /** A ride tier is picked: one price, one action, nothing competing. */
    chooseRide: {
      intent: "progress",
      surfaces: {
        map: { emphasis: "background", presentation: "route" },
        primary: { emphasis: "primary", presentation: "sheet" },
        search: { emphasis: "hidden" },
      },
    },
    /**
     * "Request Lime" tapped. The quote leaves immediately and the canvas takes
     * over while dispatch runs — no "Requesting…" pinned to a dead screen.
     */
    requestRide: {
      intent: "progress",
      surfaces: {
        map: { emphasis: "primary", presentation: "dispatch" },
        primary: { emphasis: "hidden" },
      },
    },
    /** Dispatch found nobody: the quote comes back with its selections intact. */
    requestFailed: {
      intent: "progress",
      surfaces: {
        map: { emphasis: "background", presentation: "route" },
        primary: { emphasis: "primary", presentation: "sheet" },
      },
    },
    /**
     * Detail disclosed. Same interruption mechanics as a confirmation — the
     * ride surface is suspended and restored, never rebuilt — because a
     * receipt or a driver sheet is a temporary look away from the task, not a
     * new step in it.
     */
    openDetails: {
      intent: "interrupt",
      surfaces: {
        primary: { emphasis: "suspended" },
        map: { emphasis: "background", interaction: "passive" },
        interrupt: {
          emphasis: "interrupt",
          presentation: "compact-interrupt",
          interaction: "active",
        },
      },
    },
    /** Cancel asked: the live ride recedes, it is not torn down. */
    interruptCancel: {
      intent: "interrupt",
      surfaces: {
        primary: { emphasis: "suspended" },
        map: { emphasis: "background", interaction: "passive" },
        interrupt: {
          emphasis: "interrupt",
          presentation: "compact-interrupt",
          interaction: "active",
        },
      },
    },
    /** "Keep ride" — the captured layout returns exactly as it was. */
    resumeRide: {
      intent: "return",
      surfaces: { interrupt: { emphasis: "hidden" } },
    },
  },
});

export type LimeCabAction = keyof typeof limeCabSurfaces.actions;

/**
 * Scene → surface posture. The state machine owns which step the rider is on;
 * this owns how the surfaces sit around that step.
 */
export const LIMECAB_SCENE_SURFACES: Record<
  ServiceAppState,
  SurfaceRecipe<LimeCabSurfaceId>
> = {
  home: {
    map: { emphasis: "background", presentation: "bounded" },
    primary: { emphasis: "primary", presentation: "sheet" },
    search: { emphasis: "hidden" },
  },
  location_search: {
    map: { emphasis: "background", presentation: "locating" },
    primary: { emphasis: "hidden" },
    search: { emphasis: "primary", presentation: "fullscreen" },
  },
  location_pin: {
    map: {
      emphasis: "primary",
      presentation: "locating",
      interaction: "active",
    },
    primary: { emphasis: "primary", presentation: "peek" },
    search: { emphasis: "hidden" },
  },
  service_select: {
    map: { emphasis: "background", presentation: "route" },
    primary: { emphasis: "primary", presentation: "sheet" },
    search: { emphasis: "hidden" },
  },
  // LimeCab has nothing to configure between tier and quote; the scene is
  // never entered (`needsConfigure: false`), but the map is kept coherent.
  configure: {
    map: { emphasis: "background", presentation: "route" },
    primary: { emphasis: "primary", presentation: "expanded" },
    search: { emphasis: "hidden" },
  },
  quote: {
    map: { emphasis: "background", presentation: "route" },
    primary: { emphasis: "primary", presentation: "sheet" },
    search: { emphasis: "hidden" },
  },
  matching: {
    map: { emphasis: "background", presentation: "dispatch" },
    primary: { emphasis: "primary", presentation: "sheet" },
  },
  assigned: {
    map: { emphasis: "background", presentation: "tracking" },
    primary: { emphasis: "primary", presentation: "sheet" },
  },
  provider_en_route: {
    map: { emphasis: "background", presentation: "tracking" },
    primary: { emphasis: "primary", presentation: "sheet" },
  },
  active: {
    map: { emphasis: "background", presentation: "trip" },
    primary: { emphasis: "primary", presentation: "peek" },
  },
  completing: {
    map: { emphasis: "background", presentation: "trip" },
    primary: { emphasis: "primary", presentation: "sheet" },
  },
  complete: {
    map: { emphasis: "background", presentation: "receipt" },
    primary: { emphasis: "primary", presentation: "expanded" },
  },
};
