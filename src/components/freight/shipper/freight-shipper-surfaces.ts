/**
 * Shipper surface composition — map + primary + location interrupt.
 */

import {
  createSurfaceManager,
  type SurfaceRecipe,
} from "@/lib/service-app/surface-manager";

export type ShipperSurfaceId = "map" | "primary" | "interrupt";

const HOME = {
  map: {
    emphasis: "background",
    presentation: "idle",
    interaction: "passive",
  },
  primary: {
    emphasis: "primary",
    presentation: "launcher",
    interaction: "active",
  },
  interrupt: { emphasis: "hidden" },
} as const;

const QUOTE = {
  map: {
    emphasis: "background",
    presentation: "route",
    interaction: "passive",
  },
  primary: {
    emphasis: "primary",
    presentation: "sheet",
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

export const shipperSurfaces = createSurfaceManager({
  surfaces: {
    map: {
      role: "background",
      presentations: ["idle", "route"],
      initial: {
        emphasis: "background",
        presentation: "idle",
        interaction: "passive",
      },
    },
    primary: {
      role: "primary",
      presentations: ["launcher", "sheet"],
      initial: {
        emphasis: "primary",
        presentation: "launcher",
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
    showHome: { intent: "progress", surfaces: HOME },
    showQuote: { intent: "progress", surfaces: QUOTE },
    openLocSearch: { intent: "interrupt", surfaces: LOC_SEARCH },
    closeLocSearch: {
      intent: "return",
      surfaces: { interrupt: { emphasis: "hidden" } },
    },
  },
});

export type ShipperSurfaceAction = keyof typeof shipperSurfaces.actions;

export const SHIPPER_HOME: SurfaceRecipe<ShipperSurfaceId> = HOME;
export const SHIPPER_QUOTE: SurfaceRecipe<ShipperSurfaceId> = QUOTE;
