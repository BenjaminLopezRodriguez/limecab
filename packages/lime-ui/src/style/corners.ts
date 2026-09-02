import type { Style } from "../platform/types.ts";

/**
 * iOS squircle easing. Applied to every rounded shape that is not a capsule — on a capsule the
 * corner is a semicircle and there is nothing left to ease. Web drops it; the difference is a
 * few pixels of corner and not worth emulating.
 */
export const continuousCorners: Style = { borderCurve: "continuous" };
