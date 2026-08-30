/**
 * Freight driver app surfaces — mobile duty session.
 * Map dominant; sheet = current load / find board (Uber Freight app posture).
 */

import {
  createSurfaceManager,
  type SurfaceRecipe,
} from "@/lib/service-app/surface-manager";

export type FreightDriverSurfaceId = "map" | "primary" | "interrupt";

const JOB = {
  map: {
    emphasis: "primary",
    presentation: "tracking",
    interaction: "active",
  },
  primary: {
    emphasis: "primary",
    presentation: "sheet",
    interaction: "active",
  },
  interrupt: { emphasis: "hidden" },
} as const;

const FIND = {
  map: { emphasis: "primary", presentation: "idle", interaction: "active" },
  primary: {
    emphasis: "primary",
    presentation: "sheet",
    interaction: "active",
  },
  interrupt: { emphasis: "hidden" },
} as const;

const IDLE = {
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

const LOC_SEARCH = {
  primary: { emphasis: "suspended" },
  map: { emphasis: "background", interaction: "passive" },
  interrupt: {
    emphasis: "interrupt",
    presentation: "fullscreen",
    interaction: "active",
  },
} as const;

export const freightDriverSurfaces = createSurfaceManager({
  surfaces: {
    map: {
      role: "background",
      presentations: ["idle", "tracking", "route"],
      initial: {
        emphasis: "primary",
        presentation: "idle",
        interaction: "active",
      },
    },
    primary: {
      role: "primary",
      presentations: ["launcher", "peek", "sheet", "expanded"],
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
    showJob: { intent: "progress", surfaces: JOB },
    showFind: { intent: "progress", surfaces: FIND },
    showIdle: { intent: "progress", surfaces: IDLE },
    openLocSearch: { intent: "interrupt", surfaces: LOC_SEARCH },
    closeLocSearch: {
      intent: "return",
      surfaces: { interrupt: { emphasis: "hidden" } },
    },
  },
});

export type FreightDriverSurfaceAction =
  keyof typeof freightDriverSurfaces.actions;

export const FREIGHT_DRIVER_JOB: SurfaceRecipe<FreightDriverSurfaceId> = JOB;
export const FREIGHT_DRIVER_FIND: SurfaceRecipe<FreightDriverSurfaceId> = FIND;
