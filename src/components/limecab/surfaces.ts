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
      // Payment is an interruption that happens to want the whole screen.
      presentations: ["compact-interrupt", "fullscreen", "overlay"],
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
    /**
     * Mic on Home or search. Same scene as Where? — listening lives inside
     * search, not a second ServiceAppState.
     */
    openVoiceBooking: {
      intent: "expand",
      surfaces: {
        map: { emphasis: "background", presentation: "locating" },
        primary: { emphasis: "hidden" },
        search: { emphasis: "primary", presentation: "fullscreen" },
      },
    },
    /** Parser committed a place. Same landing as typing a destination. */
    voiceResolved: {
      intent: "progress",
      surfaces: {
        map: { emphasis: "background", presentation: "route" },
        primary: { emphasis: "primary", presentation: "sheet" },
        search: { emphasis: "hidden" },
      },
    },
    /** Share trip from the live sheet. Same interrupt as Safety. */
    openTravelShare: {
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
    /** Comfort/Reserve quote: add a drink? Quote stays mounted. */
    openForTheWay: {
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
    skipForTheWay: {
      intent: "return",
      surfaces: { interrupt: { emphasis: "hidden" } },
    },
    addForTheWay: {
      intent: "return",
      surfaces: { interrupt: { emphasis: "hidden" } },
    },
    /**
     * "Which shop?" — Lime Shop's first question. Same prepared search scene
     * as any other place; the store it returns becomes the pickup.
     */
    openShopSearch: {
      intent: "expand",
      surfaces: {
        map: { emphasis: "background", presentation: "locating" },
        primary: { emphasis: "hidden" },
        search: { emphasis: "primary", presentation: "fullscreen" },
      },
    },
    /** A shop is chosen: the store pin appears and the list rises over it. */
    shopSelected: {
      intent: "progress",
      surfaces: {
        map: { emphasis: "background", presentation: "route" },
        primary: { emphasis: "primary", presentation: "expanded" },
        search: { emphasis: "hidden" },
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
    /**
     * Choosing how to pay. Still an interruption — the ride sheet is suspended
     * and comes back with the choice made — but a list plus "add a method" is
     * a prepared environment, not a yes/no drawer, so it takes the screen.
     */
    openPayment: {
      intent: "interrupt",
      surfaces: {
        primary: { emphasis: "suspended" },
        map: { emphasis: "background", interaction: "passive" },
        interrupt: {
          emphasis: "interrupt",
          presentation: "fullscreen",
          interaction: "active",
        },
      },
    },
    /**
     * Back on a committed ride. Not a step backwards and not a cancellation:
     * the ride keeps running, the sheet stands down to a pill, and Home comes
     * back. A surface emphasis change, nothing else.
     */
    minimizeRide: {
      intent: "collapse",
      surfaces: {
        map: {
          emphasis: "background",
          presentation: "bounded",
          interaction: "passive",
        },
        primary: { emphasis: "hidden", interaction: "inert" },
        search: { emphasis: "hidden" },
      },
    },
    /**
     * Leave a draft task. Home's recipe: bounded map, launcher sheet.
     * A live service uses `minimizeRide` instead — the request keeps running.
     */
    leaveTask: {
      intent: "progress",
      surfaces: {
        map: { emphasis: "background", presentation: "bounded" },
        primary: { emphasis: "primary", presentation: "sheet" },
        search: { emphasis: "hidden" },
      },
    },
    /** The pill, tapped. The scene's own recipe puts the map back. */
    restoreRide: {
      intent: "expand",
      surfaces: {
        primary: { emphasis: "primary", interaction: "active" },
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
    primary: { emphasis: "primary", presentation: "expanded" },
    search: { emphasis: "hidden" },
  },
  // Courier and Reserve both stop here; default Home rides skip it.
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
    primary: { emphasis: "primary", presentation: "expanded" },
  },
  provider_en_route: {
    map: { emphasis: "background", presentation: "tracking" },
    primary: { emphasis: "primary", presentation: "expanded" },
  },
  // Not peek: the driver card is the answer to "how is this going", and a
  // 22% strip cannot hold it. The canvas still owns most of the screen.
  active: {
    map: { emphasis: "background", presentation: "trip" },
    primary: { emphasis: "primary", presentation: "sheet" },
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
