import { surfaceId, type SurfaceId } from "../core/surface.ts";
import type { SurfaceRecipe } from "../core/surface-manager.ts";

/**
 * Reusable surface choreography.
 *
 * A recipe says *what happens to the surfaces*; the renderer decides how that physically
 * moves, and a scenario decides when it happens. Nothing here knows a product state name.
 *
 * Extracted from production's `surfaces.ts` (26 rider actions) and `driver-surfaces.ts`
 * (38 driver actions) by **de-duplication**, not transcription: those 64 actions collapse to
 * the handful of distinct compositions below, because most of them differ only in which
 * product question is being asked, never in how the surfaces sit. `openDestinationSearch`,
 * `openPickupSearch`, `openShopSearch`, `openAssistSearch` and `openVoiceBooking` are one
 * recipe — `openSearch` — asked five times.
 *
 * The map's *posture* is deliberately absent. Production stores it in
 * `SurfaceState.presentation` because its presentation type is `string | null`; our contract
 * separates the two properly — a surface's emphasis and interaction here, the canvas posture
 * in `MapSceneState.mode`. Recipes therefore set only how present and how interactive the
 * map is, and the scene sets what it is showing.
 */

/** The four surfaces production composes. Renderers key their registry off these. */
export const SURFACES = {
  /** The world. Always mounted; sometimes the subject. */
  map: surfaceId("map"),
  /** The current task. */
  primary: surfaceId("primary"),
  /** A prepared environment beside the task — search, configuration. */
  secondary: surfaceId("secondary"),
  /** A temporary question in front of everything. */
  interrupt: surfaceId("interrupt"),
} as const satisfies Record<string, SurfaceId>;

export type LimeSurfaceId = (typeof SURFACES)[keyof typeof SURFACES];

const { map, primary, secondary, interrupt } = SURFACES;

type Recipe = SurfaceRecipe<string>;

/* ── Task progression ──────────────────────────────────────────────────────── */

/** Resting: the world is context, the task is a sheet over it. */
export const restingTask: Recipe = {
  [map]: { emphasis: "background", interaction: "passive" },
  [primary]: { emphasis: "primary", presentation: "sheet", interaction: "active" },
  [secondary]: { emphasis: "hidden" },
};

/**
 * A prepared environment takes the screen while the task stands down — but the world stays
 * mounted behind it, so returning is a move rather than a rebuild.
 */
export const openSearch: Recipe = {
  [map]: { emphasis: "background", interaction: "passive" },
  [primary]: { emphasis: "hidden" },
  [secondary]: { emphasis: "primary", presentation: "fullscreen", interaction: "active" },
};

/** The environment answered. The task comes back holding what it returned. */
export const searchResolved: Recipe = {
  [map]: { emphasis: "background", interaction: "passive" },
  [primary]: { emphasis: "primary", presentation: "sheet", interaction: "active" },
  [secondary]: { emphasis: "hidden" },
};

/**
 * The world becomes the subject: the task shrinks to a strip that names what the map is
 * pointing at, and the canvas itself takes the gestures. This is the composition that makes
 * pin-drop possible, and the one a renderer treating the map as scenery cannot express.
 */
export const chooseOnMap: Recipe = {
  [map]: { emphasis: "primary", interaction: "active" },
  [primary]: { emphasis: "primary", presentation: "peek", interaction: "active" },
  [secondary]: { emphasis: "hidden" },
};

/** Same subject-map composition, but the task keeps a full sheet to name the choice in. */
export const confirmOnMap: Recipe = {
  [map]: { emphasis: "primary", interaction: "active" },
  [primary]: { emphasis: "primary", presentation: "sheet", interaction: "active" },
  [secondary]: { emphasis: "hidden" },
};

/**
 * Work committed and running. The task surface leaves rather than showing a spinner pinned to
 * a dead screen — the canvas carries the waiting.
 */
export const committing: Recipe = {
  [map]: { emphasis: "primary", interaction: "passive" },
  [primary]: { emphasis: "hidden" },
};

/** A deeper look at the task, without leaving it. */
export const expandTask: Recipe = {
  [map]: { emphasis: "background", interaction: "passive" },
  [primary]: { emphasis: "primary", presentation: "expanded", interaction: "active" },
  [secondary]: { emphasis: "hidden" },
};

/** The surface is the page and the world is a card inside it. Off-duty home. */
export const launcher: Recipe = {
  [map]: { emphasis: "background", interaction: "passive" },
  [primary]: { emphasis: "primary", presentation: "launcher", interaction: "active" },
  [secondary]: { emphasis: "hidden" },
};

/* ── Interruption ──────────────────────────────────────────────────────────── */

/**
 * A temporary question. The task is *suspended*, never torn down — production is explicit
 * that drafts, scroll and map state survive an interruption — so `return` restores the exact
 * layout the interrupt pushed.
 */
const interruptWith = (presentation: "compact-interrupt" | "sheet" | "fullscreen" | "overlay"): Recipe => ({
  [primary]: { emphasis: "suspended" },
  [map]: { emphasis: "background", interaction: "passive" },
  [interrupt]: { emphasis: "interrupt", presentation, interaction: "active" },
});

/** A yes/no drawer: cancel, details, share. */
export const askQuestion = interruptWith("compact-interrupt");
/** Unbidden work arriving — a driver offer. Larger than a question, still an interruption. */
export const offerArriving = interruptWith("sheet");
/** A prepared environment as an interruption: a payment list with "add a method". */
export const interruptFullscreen = interruptWith("fullscreen");
/** A thread plus a keyboard. */
export const interruptOverlay = interruptWith("overlay");

/** The question is answered. `return` pops the layout the interrupt captured. */
export const dismissInterrupt: Recipe = {
  [interrupt]: { emphasis: "hidden" },
};

/* ── Live work ─────────────────────────────────────────────────────────────── */

/**
 * Live work stands down. Not a step back and not a cancellation — the work keeps running and
 * the world comes forward. The surface is hidden, never destroyed.
 */
export const minimizeLiveWork: Recipe = {
  [map]: { emphasis: "background", interaction: "passive" },
  [primary]: { emphasis: "hidden", interaction: "inert" },
  [secondary]: { emphasis: "hidden" },
};

/** The same surface comes back, not a new one. */
export const restoreLiveWork: Recipe = {
  [primary]: { emphasis: "primary", interaction: "active" },
};

/** The world, opened out: no task on screen, the canvas takes the gestures. */
export const worldOnly: Recipe = {
  [map]: { emphasis: "primary", interaction: "active" },
  [primary]: { emphasis: "hidden" },
  [secondary]: { emphasis: "hidden" },
};

/**
 * A prepared environment opened *over* live work — adding a stop to a running ride. It is an
 * interruption (the ride is suspended and returns intact) that happens to want a search scene
 * rather than a drawer.
 */
export const interruptWithSearch: Recipe = {
  [primary]: { emphasis: "suspended" },
  [map]: { emphasis: "background", interaction: "passive" },
  [secondary]: { emphasis: "primary", presentation: "fullscreen", interaction: "active" },
};
