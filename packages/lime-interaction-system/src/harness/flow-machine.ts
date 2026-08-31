import type { ExperienceFrame } from "../core/frame.ts";
import type { SceneId } from "../core/scene.ts";
import type { SurfaceMotionIntent } from "../core/transition.ts";

/**
 * Deterministic scenario machine. No backend, no random timing, no wall clock.
 *
 * The whole point: state is the truth and is RECONSTRUCTIBLE. `snapshot()` returns a plain
 * value; `restore()` rebuilds an identical machine from it. That is stop condition G-5 —
 * native will unmount aggressively (backgrounding, process death, low-memory, deep link),
 * so nothing meaningful may live only in a mounted component.
 */

export interface ScenarioStep {
  /** Frame WITHOUT a transition — the transition is computed on the move. */
  frame: Omit<ExperienceFrame, "transition">;
  /** How arriving here from the previous step reads. */
  intent?: SurfaceMotionIntent;
  announcement?: { text: string; urgency: "polite" | "assertive" };
}

export interface ScenarioDefinition<S extends string> {
  id: string;
  initial: S;
  order: readonly S[];
  steps: Record<S, ScenarioStep>;
  /** Steps whose work continues while the surface recedes. */
  live?: readonly S[];
}

export interface FlowSnapshot<S extends string> {
  step: S;
  minimized: boolean;
  interrupt: string | null;
  /** Step the interrupt was opened over — restore must return exactly here. */
  interruptedFrom: S | null;
}

export interface FlowMachine<S extends string> {
  snapshot(): FlowSnapshot<S>;
  frame(): ExperienceFrame;
  canAdvance(): boolean;
  canRegress(): boolean;
  next(): void;
  previous(): void;
  jump(step: S): void;
  minimize(): void;
  restore(): void;
  openInterrupt(id: string): void;
  closeInterrupt(): void;
  isLive(): boolean;
}

export function createScenario<S extends string>(
  def: ScenarioDefinition<S>,
  from?: FlowSnapshot<S>,
): FlowMachine<S> {
  let state: FlowSnapshot<S> = from ?? {
    step: def.initial, minimized: false, interrupt: null, interruptedFrom: null,
  };
  const live = new Set<S>(def.live ?? []);
  const indexOf = (s: S) => def.order.indexOf(s);

  const step = () => def.steps[state.step];

  return {
    snapshot: () => ({ ...state }),
    isLive: () => live.has(state.step),
    canAdvance: () => indexOf(state.step) < def.order.length - 1,
    canRegress: () => indexOf(state.step) > 0,

    frame(): ExperienceFrame {
      const s = step();
      const base = s.frame;
      const surfaces = state.minimized
        ? minimizeLayout(base.scene.surfaces)
        : base.scene.surfaces;

      return {
        ...base,
        scene: { ...base.scene, surfaces },
        transition: {
          from: state.interruptedFrom ? sceneIdOf(def, state.interruptedFrom) : null,
          to: base.scene.id,
          intent: state.interrupt ? "interrupt"
            : state.minimized ? "collapse"
            : s.intent ?? "progress",
          ...(s.announcement && !state.minimized
            ? { announcement: { ...s.announcement, eventId: `${def.id}:${state.step}` } }
            : {}),
        },
      };
    },

    next() {
      if (!this.canAdvance()) return;
      state = { ...state, step: def.order[indexOf(state.step) + 1]!, interrupt: null, interruptedFrom: null };
    },
    previous() {
      if (!this.canRegress()) return;
      state = { ...state, step: def.order[indexOf(state.step) - 1]!, interrupt: null, interruptedFrom: null };
    },
    jump(to: S) { state = { ...state, step: to, interrupt: null, interruptedFrom: null }; },

    /** Live work minimizes. It never disappears — see tests/invariants.test.ts. */
    minimize() { if (this.isLive()) state = { ...state, minimized: true }; },
    restore() { state = { ...state, minimized: false }; },

    /** Opening an interrupt records where it opened over; closing returns exactly there. */
    openInterrupt(id: string) {
      state = { ...state, interrupt: id, interruptedFrom: state.step };
    },
    closeInterrupt() {
      state = {
        ...state,
        step: state.interruptedFrom ?? state.step,
        interrupt: null,
        interruptedFrom: null,
      };
    },
  };
}

function sceneIdOf<S extends string>(def: ScenarioDefinition<S>, s: S): SceneId {
  return def.steps[s].frame.scene.id;
}

/** Minimizing collapses the primary surface to peek; it is never removed. */
function minimizeLayout(surfaces: ExperienceFrame["scene"]["surfaces"]) {
  return Object.fromEntries(
    Object.entries(surfaces).map(([id, s]) => [
      id,
      s.emphasis === "primary" ? { ...s, presentation: "peek" as const } : s,
    ]),
  ) as ExperienceFrame["scene"]["surfaces"];
}
