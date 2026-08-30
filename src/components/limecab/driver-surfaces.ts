/**
 * The driver app's surface composition.
 *
 * Separate from the rider's `surfaces.ts` on purpose: the two products share
 * the kit, not the choreography. A driver's screen is a map with one sheet on
 * it, and the loudest thing that ever happens to it is an offer arriving.
 *
 * Presentations stay semantic — AdaptiveSurface decides that a "sheet" is a
 * drawer on a phone and a floating card on a desktop.
 */

import type { MapMode } from "@/lib/service-app/map-adapter";
import type {
  DriverAppState,
  FreightMapScene,
} from "@/lib/limecab/driver-state";
import {
  createSurfaceManager,
  type SurfaceRecipe,
} from "@/lib/service-app/surface-manager";

export type DriverSurfaceId = "map" | "primary" | "offer" | "interrupt";

/** Map postures the driver app uses, and what the canvas draws for each. */
export const DRIVER_MAP_MODE: Record<string, MapMode> = {
  idle: "home",
  locating: "select_location",
  tracking: "provider_arrival",
  trip: "active_route",
  receipt: "results",
  /**
   * The lane. `route_preview` is the one mode that is *not* a follow-cam, so
   * the canvas fits the whole corridor with camera padding and the driver can
   * read Ontario → Phoenix as one shape. No new map mode, no map inset.
   */
  linehaul: "route_preview",
};

/** The offer takes the screen; everything under it is held, not torn down. */
const OFFER_UP = {
  map: {
    emphasis: "background",
    presentation: "tracking",
    interaction: "passive",
  },
  primary: { emphasis: "suspended" },
  offer: {
    emphasis: "interrupt",
    presentation: "sheet",
    interaction: "active",
  },
} as const;

/**
 * Online and hunting: the map is the app, the peek is a status line. The
 * canvas takes gestures — a hunting driver looks around; only a live job
 * hands the camera to the follow-cam.
 */
const IDLE = {
  map: { emphasis: "primary", presentation: "idle", interaction: "active" },
  primary: { emphasis: "primary", presentation: "peek", interaction: "active" },
  offer: { emphasis: "hidden" },
} as const;

/**
 * Off duty is a *home*, not a dimmer version of the dash. The driver is
 * reading a document with a live map card in it, so `primary` is the page
 * itself — the "launcher" posture the shell draws as `layout="home"` — and
 * there is no drawer over anything.
 */
const HOME = {
  map: { emphasis: "background", presentation: "idle", interaction: "passive" },
  primary: {
    emphasis: "primary",
    presentation: "launcher",
    interaction: "active",
  },
  offer: { emphasis: "hidden" },
} as const;

/**
 * The offline map, opened out. Still off duty: this is "let me look at where
 * it is busy", which is a question about the map and never a duty change.
 */
const IDLE_MAP = {
  map: { emphasis: "primary", presentation: "idle", interaction: "active" },
  primary: { emphasis: "hidden" },
  offer: { emphasis: "hidden" },
} as const;

/** The hunting peek, opened out. Where duty ends — and only here. */
const RECOMMENDED = {
  map: { emphasis: "background", presentation: "idle", interaction: "passive" },
  primary: {
    emphasis: "primary",
    presentation: "expanded",
    interaction: "active",
  },
} as const;

/**
 * Trends. A question *about* the marketplace, so it suspends whatever idle
 * posture the driver was in and `return` puts them back in it exactly —
 * offline home or the hunting peek, without either one being named here.
 */
const TRENDS = {
  map: { emphasis: "primary", presentation: "idle", interaction: "active" },
  primary: {
    emphasis: "primary",
    presentation: "sheet",
    interaction: "active",
  },
} as const;

/** A question *about* the duty session: the peek is held behind it. */
const ASIDE = {
  primary: { emphasis: "suspended" },
  map: { emphasis: "background", interaction: "passive" },
  interrupt: {
    emphasis: "interrupt",
    presentation: "compact-interrupt",
    interaction: "active",
  },
} as const;

/**
 * Heading is search — keyboard plus suggestions — so the interrupt drawer
 * slides up to fill the screen rather than sitting as a compact stub.
 */
const HEADING = {
  primary: { emphasis: "suspended" },
  map: { emphasis: "background", interaction: "passive" },
  interrupt: {
    emphasis: "interrupt",
    presentation: "overlay",
    interaction: "active",
  },
} as const;

/**
 * "Set heading with pin" — the heading interrupt recedes, the canvas is the
 * subject, and a confirm strip names the point under the pin.
 */
const HEADING_PIN = {
  interrupt: { emphasis: "hidden" },
  map: {
    emphasis: "primary",
    presentation: "locating",
    interaction: "active",
  },
  primary: { emphasis: "primary", presentation: "peek", interaction: "active" },
  offer: { emphasis: "hidden" },
} as const;

/**
 * Freight's map scenes. Local framing at both ends of the lane; the corridor
 * in between. Only the map is named — the sheet is the duty scene's business.
 */
const FREIGHT_LOCAL = {
  map: {
    emphasis: "background",
    presentation: "tracking",
    interaction: "passive",
  },
} as const;

const FREIGHT_LINEHAUL = {
  map: {
    emphasis: "background",
    presentation: "linehaul",
    interaction: "passive",
  },
} as const;

const FREIGHT_ARRIVING = {
  map: { emphasis: "background", presentation: "trip", interaction: "passive" },
} as const;

export const driverSurfaces = createSurfaceManager({
  surfaces: {
    map: {
      role: "background",
      presentations: [
        "idle",
        "locating",
        "tracking",
        "trip",
        "receipt",
        "linehaul",
      ],
      initial: {
        emphasis: "background",
        presentation: "idle",
        interaction: "passive",
      },
    },
    primary: {
      role: "primary",
      presentations: ["launcher", "peek", "sheet", "expanded", "overlay"],
      initial: {
        emphasis: "primary",
        presentation: "peek",
        interaction: "active",
      },
    },
    /**
     * The offer. Its own surface rather than a rung of `primary`, because it
     * must be able to sit *over* an untouched idle peek and leave without a
     * trace when the countdown runs out.
     */
    offer: {
      role: "interrupt",
      presentations: ["sheet"],
      initial: { emphasis: "hidden", presentation: null, interaction: "inert" },
    },
    /** Heading, safety, confirmations. Never up at the same time as an offer. */
    interrupt: {
      role: "interrupt",
      presentations: ["compact-interrupt", "fullscreen", "overlay"],
      initial: { emphasis: "hidden", presentation: null, interaction: "inert" },
    },
  },
  actions: {
    /**
     * Duty taken. The composition changes — a map card becomes the canvas —
     * but it is the same mounted map: `layout` is the only switch.
     */
    goOnline: { intent: "progress", surfaces: IDLE },
    goOffline: { intent: "progress", surfaces: HOME },

    /** Off duty, looking around. The pill is still the only way on duty. */
    expandIdleMap: { intent: "expand", surfaces: IDLE_MAP },
    collapseIdleMap: { intent: "collapse", surfaces: HOME },

    /** The list icon on the hunting peek. */
    openRecommended: { intent: "interrupt", surfaces: RECOMMENDED },
    closeRecommended: { intent: "return", surfaces: {} },

    /** The charts icon, the Opportunities row, the Recommended row. */
    openTrends: { intent: "interrupt", surfaces: TRENDS },
    closeTrends: { intent: "return", surfaces: {} },

    /** Trends, read as a list. Overlay — the map recedes, the list is the question. */
    openTrendCharts: {
      intent: "expand",
      surfaces: {
        map: {
          emphasis: "background",
          presentation: "idle",
          interaction: "passive",
        },
        primary: {
          emphasis: "primary",
          presentation: "overlay",
          interaction: "active",
        },
      },
    },
    closeTrendCharts: {
      intent: "collapse",
      surfaces: TRENDS,
    },

    /** Recommended, opened out to the viewport. Same list, overlay chrome. */
    expandRecommended: {
      intent: "expand",
      surfaces: {
        map: {
          emphasis: "background",
          presentation: "idle",
          interaction: "passive",
        },
        primary: {
          emphasis: "primary",
          presentation: "overlay",
          interaction: "active",
        },
      },
    },
    collapseRecommended: {
      intent: "collapse",
      surfaces: RECOMMENDED,
    },

    /** A ride the driver can take. The whole screen turns to it. */
    offerIncoming: { intent: "interrupt", surfaces: OFFER_UP },

    /** Declined, or the countdown ran out. The peek comes back untouched. */
    offerDismissed: {
      intent: "return",
      surfaces: { offer: { emphasis: "hidden" } },
    },

    /** Accepted. There is no going back to the offer, so the history clears. */
    accepted: {
      intent: "progress",
      surfaces: {
        map: {
          emphasis: "background",
          presentation: "tracking",
          interaction: "passive",
        },
        primary: {
          emphasis: "primary",
          presentation: "sheet",
          interaction: "active",
        },
        offer: { emphasis: "hidden" },
      },
    },

    /** At the curb. Same sheet, new question. */
    arrived: {
      intent: "progress",
      surfaces: {
        map: { emphasis: "background", presentation: "tracking" },
        primary: { emphasis: "primary", presentation: "sheet" },
      },
    },

    /**
     * Start ride, and this rider has a PIN. The job sheet grows into an
     * overlay so the driver can type what they are told — never the digits.
     */
    openPickupPin: {
      intent: "expand",
      surfaces: {
        map: {
          emphasis: "background",
          presentation: "tracking",
          interaction: "passive",
        },
        primary: {
          emphasis: "primary",
          presentation: "overlay",
          interaction: "active",
        },
        offer: { emphasis: "hidden" },
      },
    },
    /** Back from the PIN overlay revises the curb sheet. */
    closePickupPin: {
      intent: "collapse",
      surfaces: {
        map: { emphasis: "background", presentation: "tracking" },
        primary: {
          emphasis: "primary",
          presentation: "sheet",
          interaction: "active",
        },
      },
    },

    /** Rider on board: the canvas turns to the destination. */
    started: {
      intent: "progress",
      surfaces: {
        map: { emphasis: "background", presentation: "trip" },
        primary: { emphasis: "primary", presentation: "sheet" },
      },
    },

    /** The fare, for a beat. */
    completed: {
      intent: "progress",
      surfaces: {
        map: { emphasis: "background", presentation: "receipt" },
        primary: { emphasis: "primary", presentation: "sheet" },
      },
    },

    /** Back in the hunt, still online. The next offer may land immediately. */
    resumeIdle: { intent: "progress", surfaces: IDLE },

    /** Cancel asked: the live job recedes, it is not torn down. */
    askCancelJob: { intent: "interrupt", surfaces: ASIDE },
    /** "Keep this job" — the captured layout returns exactly as it was. */
    dismissCancelJob: {
      intent: "return",
      surfaces: { interrupt: { emphasis: "hidden" } },
    },
    /**
     * The accepted job is gone. History clears — there is no curb to return
     * to — and the hunt peek comes back.
     */
    jobReleased: {
      intent: "progress",
      surfaces: { ...IDLE, interrupt: { emphasis: "hidden" } },
    },

    /**
     * Freight's three map scenes. Map-only recipes on purpose: which picture
     * the camera is taking is a different question from where the sheet sits,
     * and keeping them apart is what lets a minimized load keep its lane.
     *
     * Neither intent is `progress`, so a camera move can never tear down an
     * exception or POD interrupt that is standing over the job.
     */
    freightToPickup: { intent: "collapse", surfaces: FREIGHT_LOCAL },
    /** `Depart pickup`: the camera pulls outward until the lane is legible. */
    freightLinehaul: { intent: "expand", surfaces: FREIGHT_LINEHAUL },
    freightNearDelivery: { intent: "collapse", surfaces: FREIGHT_ARRIVING },

    /**
     * A 795-mile load runs twelve hours; the driver is not held in one sheet
     * for it. The job is not ended and duty is not dropped — only the sheet
     * leaves, and the corridor stays on the canvas behind the affordance.
     */
    minimizeFreightJob: {
      intent: "collapse",
      surfaces: { primary: { emphasis: "hidden", interaction: "inert" } },
    },
    restoreFreightJob: {
      intent: "expand",
      surfaces: {
        primary: {
          emphasis: "primary",
          presentation: "sheet",
          interaction: "active",
        },
      },
    },

    /** "Report an issue" — the job sheet is suspended, never unmounted. */
    openFreightException: { intent: "interrupt", surfaces: ASIDE },
    /** POD capture is a document, so it takes the screen like search does. */
    openFreightPod: { intent: "interrupt", surfaces: HEADING },

    openHeading: { intent: "interrupt", surfaces: HEADING },
    openSafety: { intent: "interrupt", surfaces: ASIDE },
    /** Same thread the rider sees. Overlay — keyboard plus the messages. */
    openTripChat: { intent: "interrupt", surfaces: HEADING },

    /** Search recedes; the driver drops a pin for the heading filter. */
    chooseHeadingOnMap: { intent: "expand", surfaces: HEADING_PIN },
    /** Back from the pin revises the overlay, rather than clearing the heading. */
    closeHeadingPin: { intent: "collapse", surfaces: HEADING },

    /** The aside is answered; the duty session returns exactly as it was. */
    closeAside: {
      intent: "return",
      surfaces: { interrupt: { emphasis: "hidden" } },
    },
  },
});

export type DriverSurfaceAction = keyof typeof driverSurfaces.actions;

/**
 * Scene → surface posture. The scene machine owns which question the driver
 * is being asked; this owns how the surfaces sit around it.
 */
export const DRIVER_SCENE_SURFACES: Record<
  DriverAppState,
  SurfaceRecipe<DriverSurfaceId>
> = {
  offline: HOME,
  online: IDLE,
  to_pickup: {
    map: { emphasis: "background", presentation: "tracking" },
    primary: {
      emphasis: "primary",
      presentation: "sheet",
      interaction: "active",
    },
    offer: { emphasis: "hidden" },
  },
  at_pickup: {
    map: { emphasis: "background", presentation: "tracking" },
    primary: {
      emphasis: "primary",
      presentation: "sheet",
      interaction: "active",
    },
    offer: { emphasis: "hidden" },
  },
  on_trip: {
    map: { emphasis: "background", presentation: "trip" },
    primary: {
      emphasis: "primary",
      presentation: "sheet",
      interaction: "active",
    },
    offer: { emphasis: "hidden" },
  },
  complete: {
    map: { emphasis: "background", presentation: "receipt" },
    primary: {
      emphasis: "primary",
      presentation: "sheet",
      interaction: "active",
    },
    offer: { emphasis: "hidden" },
  },
};

/**
 * Freight map scene → the action that takes the camera there. One named
 * action per scene, so nothing in the app sets a map posture by hand.
 */
export const DRIVER_FREIGHT_MAP_ACTION: Record<
  FreightMapScene,
  DriverSurfaceAction
> = {
  to_pickup: "freightToPickup",
  linehaul: "freightLinehaul",
  near_delivery: "freightNearDelivery",
};
