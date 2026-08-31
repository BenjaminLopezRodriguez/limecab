import type { ExperienceFrame } from "./frame.ts";

/**
 * Back is COORDINATION, not one reducer operation.
 *
 * The audit found 16 backward mechanisms and no arbiter — at least five unrelated meanings of
 * "backward". `handleBack(): "handled" | "unhandled"` was rejected: it hides all 16 behind one
 * word, which is invention dressed as extraction.
 *
 * So: RESOLVE a disposition, do NOT execute it. The app or harness decides mechanism.
 *   minimize-live-work -> setRideMinimized() on web
 *                      -> persistent job presentation on native
 * Same meaning, different mechanism.
 *
 * Ownership stays split so SurfaceManager does not become the new god abstraction:
 *   transient renderer state  -> dismiss-transient
 *   SurfaceManager            -> return-interrupt
 *   product workflow          -> regress-scene
 *   live-work controller      -> minimize-live-work
 *   host navigation           -> delegate-to-host
 */
export type BackDisposition =
  | { type: "dismiss-transient" }
  | { type: "return-interrupt" }
  | { type: "regress-scene" }
  | { type: "minimize-live-work" }
  | { type: "exit-product" }
  | { type: "delegate-to-host" }
  /**
   * Deliberately absorbed — nothing happens, and that is correct.
   * Rider Home today is a silent no-op (state.ts:204). Calling that "handled" would be a lie
   * that lets extraction quietly convert it into host navigation.
   */
  | { type: "consume" };

export interface BackContext {
  frame: ExperienceFrame;
  hasInterrupt: boolean;
  surfaceHistoryDepth: number;
  workflowCanRegress: boolean;
  liveWorkActive: boolean;
}

/**
 * Lab-only in Phase 1. Models OBSERVED scenarios; proclaims no precedence law.
 * Current production precedence is emergent from portal nesting and a JSX ternary
 * (limecab-app.tsx:1524-1530), so asserting a universal ladder now would be invention.
 * Phase 4 asks whether one resolver covers Rider + Driver + Freight.
 */
export type BackResolver = (context: BackContext) => BackDisposition;
