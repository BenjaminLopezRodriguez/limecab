/**
 * Accessibility semantics — shared meaning, per-renderer delivery.
 *
 * Audit proved a11y is not renderer decoration: production ALREADY maps a core enum to a
 * renderer attribute — SurfaceInteraction "inert" -> DOM inert (surface-manager.tsx:184),
 * progress.locked -> aria-busy (service-sheet.tsx:198). This is that mapping, generalized.
 *
 * Scope is deliberately small: label / role / state / announcement. Not all ~410 production
 * usages; aria-hidden and id-ref wiring stay renderer concerns.
 */

export type AccessibilityUrgency = "polite" | "assertive";
export type SemanticRole = "option" | "alert" | "status" | "image" | "list" | "step";
export type SemanticState = "busy" | "pressed" | "checked" | "selected" | "current" | "disabled";

export interface AccessibilitySemantics {
  label?: string;
  description?: string;
  role?: SemanticRole;
  state?: SemanticState[];
}
