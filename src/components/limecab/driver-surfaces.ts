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
import type { DriverAppState } from "@/lib/limecab/driver-state";
import {
  createSurfaceManager,
  type SurfaceRecipe,
} from "@/lib/service-app/surface-manager";

export type DriverSurfaceId = "map" | "primary" | "offer" | "interrupt";

/** Map postures the driver app uses, and what the canvas draws for each. */
export const DRIVER_MAP_MODE: Record<string, MapMode> = {
  idle: "home",
  tracking: "provider_arrival",
  trip: "active_route",
  receipt: "results",
};

/** The offer takes the screen; everything under it is held, not torn down. */
const OFFER_UP = {
  map: { emphasis: "background", presentation: "tracking", interaction: "passive" },
  primary: { emphasis: "suspended" },
  offer: { emphasis: "interrupt", presentation: "sheet", interaction: "active" },
} as const;

const IDLE = {
  map: { emphasis: "background", presentation: "idle", interaction: "passive" },
  primary: { emphasis: "primary", presentation: "peek", interaction: "active" },
  offer: { emphasis: "hidden" },
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

export const driverSurfaces = createSurfaceManager({
  surfaces: {
    map: {
      role: "background",
      presentations: ["idle", "tracking", "trip", "receipt"],
      initial: {
        emphasis: "background",
        presentation: "idle",
        interaction: "passive",
      },
    },
    primary: {
      role: "primary",
      presentations: ["peek", "sheet"],
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
      presentations: ["compact-interrupt", "fullscreen"],
      initial: { emphasis: "hidden", presentation: null, interaction: "inert" },
    },
  },
  actions: {
    /** Duty taken. Same geometry, different copy — the map must not blink. */
    goOnline: { intent: "progress", surfaces: IDLE },
    goOffline: { intent: "progress", surfaces: IDLE },

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
        primary: { emphasis: "primary", presentation: "sheet", interaction: "active" },
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

    openHeading: { intent: "interrupt", surfaces: ASIDE },
    openSafety: { intent: "interrupt", surfaces: ASIDE },

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
  offline: IDLE,
  online: IDLE,
  to_pickup: {
    map: { emphasis: "background", presentation: "tracking" },
    primary: { emphasis: "primary", presentation: "sheet", interaction: "active" },
    offer: { emphasis: "hidden" },
  },
  at_pickup: {
    map: { emphasis: "background", presentation: "tracking" },
    primary: { emphasis: "primary", presentation: "sheet", interaction: "active" },
    offer: { emphasis: "hidden" },
  },
  on_trip: {
    map: { emphasis: "background", presentation: "trip" },
    primary: { emphasis: "primary", presentation: "sheet", interaction: "active" },
    offer: { emphasis: "hidden" },
  },
  complete: {
    map: { emphasis: "background", presentation: "receipt" },
    primary: { emphasis: "primary", presentation: "sheet", interaction: "active" },
    offer: { emphasis: "hidden" },
  },
};
