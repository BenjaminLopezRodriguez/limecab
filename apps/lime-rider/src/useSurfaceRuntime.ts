import { useCallback, useMemo, useRef, useState } from "react";
import {
  initialSurfaceManagerState,
  reduceSurfaceManager,
  type ExperienceFrame,
  type SurfaceId,
  type SurfaceLayout,
  type SurfaceManagerConfig,
  type SurfaceManagerState,
  type SurfacePresentation,
} from "@lime/interaction-system/core";
import {
  createScenario,
  type FlowMachine,
  type FlowSnapshot,
  type ScenarioDefinition,
} from "@lime/interaction-system/harness";
import { SURFACES } from "@lime/interaction-system/recipes";
import type { SnapDestination } from "@lime/interaction-system/native";

/**
 * Deterministic wiring — the app's job, not the renderer's.
 *
 * Three owners, no overlap:
 *
 *   FlowMachine     where in the task the user is (and minimize, and interrupts)
 *   SurfaceManager  how the surfaces sit around that step — driven by *named recipes*
 *   this hook       only the mapping between them
 *
 * The app never writes a surface posture by hand. It names an action; the recipe decides the
 * composition. That is the property that keeps product choreography out of the renderer and
 * stops a gesture forking durable state.
 */

export interface SurfaceRuntime<S extends string, A extends string> {
  machine: FlowMachine<S>;
  snapshot: FlowSnapshot<S>;
  frame: ExperienceFrame;
  act: (fn: (machine: FlowMachine<S>) => void) => void;
  /** Run a named recipe. The only way this app changes a composition. */
  perform: (action: A) => void;
  /** A resolved drag. Turns a rung into the shared semantic change it stands for. */
  snapTo: (destination: SnapDestination, meaning: "dismiss" | "minimize") => void;
}

export function useSurfaceRuntime<S extends string, A extends string>(
  definition: ScenarioDefinition<S>,
  config: SurfaceManagerConfig<string, A>,
  /** Which recipe puts the surfaces where this step needs them. */
  actionForStep: (step: S, minimized: boolean) => A,
  /** Start at a canonical state instead of the beginning. Parity work uses this. */
  initialStep?: string,
): SurfaceRuntime<S, A> {
  const [snapshot, setSnapshot] = useState<FlowSnapshot<S>>(() => {
    const fresh = createScenario(definition);
    if (initialStep && (definition.order as readonly string[]).includes(initialStep)) {
      fresh.jump(initialStep as S);
    }
    return fresh.snapshot();
  });
  const machine = useMemo(() => createScenario(definition, snapshot), [definition, snapshot]);
  const [manager, setManager] = useState<SurfaceManagerState<string>>(() =>
    initialSurfaceManagerState(config),
  );

  const perform = useCallback(
    (action: A) => {
      setManager((current) => reduceSurfaceManager(current, { type: "perform", action }, config));
    },
    [config],
  );

  // The scenario is authoritative for which recipe a step rests in; a drag inside a step is
  // the manager's own. Applied during render so the first paint is already composed.
  const wanted = actionForStep(snapshot.step, snapshot.minimized);
  const applied = useRef<A | null>(null);
  if (applied.current !== wanted) {
    applied.current = wanted;
    setManager((current) => reduceSurfaceManager(current, { type: "perform", action: wanted }, config));
  }

  const scenarioFrame = machine.frame();
  const frame = useMemo<ExperienceFrame>(
    () => ({
      ...scenarioFrame,
      // The scenario keeps the world (`scene.map`); the manager owns the surfaces.
      scene: { ...scenarioFrame.scene, surfaces: manager.layout as unknown as SurfaceLayout },
    }),
    [scenarioFrame, manager.layout],
  );

  const act = useCallback(
    (fn: (machine: FlowMachine<S>) => void) => {
      const next = createScenario(definition, snapshot);
      fn(next);
      setSnapshot(next.snapshot());
    },
    [definition, snapshot],
  );

  const snapTo = useCallback(
    (destination: SnapDestination, meaning: "dismiss" | "minimize") => {
      // The floor of the ladder is not a presentation — it is whatever leaving means here.
      if (destination === "dismiss") {
        act((m) => (meaning === "minimize" ? m.minimize() : m.previous()));
        return;
      }
      const from = manager.layout[SURFACES.primary]?.presentation as SurfacePresentation | null;
      setManager((current) =>
        reduceSurfaceManager(
          current,
          {
            type: "apply",
            intent: taller(destination, from) ? "expand" : "collapse",
            surfaces: { [SURFACES.primary]: destination },
          },
          config,
        ),
      );
    },
    [act, config, manager.layout],
  );

  return { machine, snapshot, frame, act, perform, snapTo };
}

export const PRIMARY: SurfaceId = SURFACES.primary;
export const MAP: SurfaceId = SURFACES.map;
export const SECONDARY: SurfaceId = SURFACES.secondary;
export const INTERRUPT: SurfaceId = SURFACES.interrupt;

const ORDER: readonly (SurfacePresentation | null)[] = [
  null, "peek", "sheet", "expanded", "overlay", "fullscreen", "launcher",
];
const taller = (to: SurfacePresentation, from: SurfacePresentation | null) =>
  ORDER.indexOf(to) > ORDER.indexOf(from);
