import type { AccessibilityUrgency } from "./accessibility.ts";
import type { SurfaceId } from "./surface.ts";

/**
 * One-shot effects. NEVER durable scene state — this is where recenterNonce died.
 * Split by semantic level: focus/scrollTo are renderer affordances, not shared concepts.
 */

export type MapCommand =
  | { type: "map.recenter"; target?: { lat: number; lng: number } }
  | { type: "map.fit"; pointIds: string[] };

export type AccessibilityCommand =
  | { type: "a11y.announce"; message: string; urgency: AccessibilityUrgency; eventId: string };

/** Cross-platform. Every renderer must express these somehow. */
export type ExperienceCommand = MapCommand | AccessibilityCommand;

/**
 * Renderer-specific — NOT in the shared union, composed by the web renderer only.
 * `anchor: string` is document-flavored; native gets its own shape.
 */
export type WebRendererCommand =
  | { type: "web.focus"; surfaceId: SurfaceId; field?: string }
  | { type: "web.scrollTo"; surfaceId: SurfaceId; anchor: string };
