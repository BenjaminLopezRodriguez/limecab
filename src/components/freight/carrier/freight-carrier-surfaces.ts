/**
 * Carrier surface composition — hunt map + results + location interrupt.
 */

import {
  createSurfaceManager,
  type SurfaceRecipe,
} from "@/lib/service-app/surface-manager";

export type CarrierSurfaceId = "map" | "primary" | "interrupt";

const HUNT = {
  map: { emphasis: "primary", presentation: "idle", interaction: "active" },
  primary: {
    emphasis: "primary",
    presentation: "sheet",
    interaction: "active",
  },
  interrupt: { emphasis: "hidden" },
} as const;

const RESULTS = {
  map: {
    emphasis: "background",
    presentation: "idle",
    interaction: "passive",
  },
  primary: {
    emphasis: "primary",
    presentation: "expanded",
    interaction: "active",
  },
  interrupt: { emphasis: "hidden" },
} as const;

const LOC_SEARCH = {
  primary: { emphasis: "suspended" },
  map: { emphasis: "background", interaction: "passive" },
  interrupt: {
    emphasis: "interrupt",
    presentation: "fullscreen",
    interaction: "active",
  },
} as const;

export const carrierSurfaces = createSurfaceManager({
  surfaces: {
    map: {
      role: "background",
      presentations: ["idle", "route"],
      initial: {
        emphasis: "primary",
        presentation: "idle",
        interaction: "active",
      },
    },
    primary: {
      role: "primary",
      presentations: ["peek", "sheet", "expanded"],
      initial: {
        emphasis: "primary",
        presentation: "sheet",
        interaction: "active",
      },
    },
    interrupt: {
      role: "interrupt",
      presentations: ["fullscreen"],
      initial: { emphasis: "hidden", presentation: null, interaction: "inert" },
    },
  },
  actions: {
    showHunt: { intent: "progress", surfaces: HUNT },
    showResults: { intent: "progress", surfaces: RESULTS },
    openLocSearch: { intent: "interrupt", surfaces: LOC_SEARCH },
    closeLocSearch: {
      intent: "return",
      surfaces: { interrupt: { emphasis: "hidden" } },
    },
  },
});

export type CarrierSurfaceAction = keyof typeof carrierSurfaces.actions;

export const CARRIER_HUNT: SurfaceRecipe<CarrierSurfaceId> = HUNT;
export const CARRIER_RESULTS: SurfaceRecipe<CarrierSurfaceId> = RESULTS;
