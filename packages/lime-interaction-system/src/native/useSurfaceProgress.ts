import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  reduceSurfaceProgress,
  SURFACE_PROGRESS_IDLE,
  type SurfaceProgressEvent,
  type SurfaceProgressState,
} from "../core/surface-progress.ts";
import { runSurfaceProgress, type SurfaceProgressRun } from "./surface-progress-runner.ts";

/**
 * Native driver for the surface-progress phase machine (the phase machine, not LimeDriver).
 *
 * Ephemeral by construction — phase, timers, in-flight promise. SurfaceManager stays
 * authoritative for the composition and the flow stays authoritative for the step; this only
 * decides *when* they are allowed to change so the transition reads truthfully.
 */

export interface UseSurfaceProgressOptions {
  /** Reduced motion keeps the state sequence and the lock, and skips the choreography. */
  reducedMotion?: boolean;
}

export interface SurfaceProgress {
  state: SurfaceProgressState;
  phase: SurfaceProgressState["phase"];
  /** Whether the surface is allowed on screen right now. */
  sheetOpen: boolean;
  /** Input is refused while a transition owns the screen. */
  locked: boolean;
  /** Start a transition. A second call while locked joins the one in flight. */
  run: <T>(input: SurfaceProgressRun<T>) => Promise<T>;
}

export function useSurfaceProgress({
  reducedMotion = false,
}: UseSurfaceProgressOptions = {}): SurfaceProgress {
  const [state, setState] = useState<SurfaceProgressState>(SURFACE_PROGRESS_IDLE);
  // The sequencer reads between awaits, so the committed state cannot wait on a render.
  const committed = useRef(state);
  const alive = useRef(true);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const inFlight = useRef<Promise<unknown> | null>(null);

  // Waiters are resolved rather than merely cleared. Clearing the timer alone leaves the
  // sequencer suspended mid-await forever, holding its closures — the component unmounts but
  // the transition never finishes unwinding.
  const waiters = useRef(new Set<() => void>());

  useEffect(
    () => () => {
      alive.current = false;
      for (const timer of timers.current) clearTimeout(timer);
      timers.current.clear();
      for (const resolve of waiters.current) resolve();
      waiters.current.clear();
    },
    [],
  );

  const apply = useCallback((event: SurfaceProgressEvent) => {
    const next = reduceSurfaceProgress(committed.current, event);
    committed.current = next;
    if (alive.current) setState(next);
    return next;
  }, []);

  const wait = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        const settle = () => {
          timers.current.delete(timer);
          waiters.current.delete(settle);
          resolve();
        };
        const timer = setTimeout(settle, ms);
        timers.current.add(timer);
        // Registered so unmount can resolve it instead of abandoning the sequencer mid-await.
        waiters.current.add(settle);
      }),
    [],
  );

  const run = useCallback(
    <T,>(input: SurfaceProgressRun<T>): Promise<T> => {
      // Duplicate input is refused here, not by a disabled button alone.
      if (committed.current.locked) {
        return (inFlight.current as Promise<T> | null) ?? Promise.reject(new Error("Surface is busy"));
      }
      const work = runSurfaceProgress(input, {
        apply,
        read: () => committed.current,
        wait,
        skipChoreography: reducedMotion,
      });
      inFlight.current = work;
      // Settle both outcomes here so the caller's own catch stays the only place it surfaces.
      const release = () => {
        if (!committed.current.locked) inFlight.current = null;
      };
      void work.then(release, release);
      return work;
    },
    [apply, wait, reducedMotion],
  );

  return useMemo(
    () => ({
      state,
      phase: state.phase,
      sheetOpen: state.sheetOpen,
      locked: state.locked,
      run,
    }),
    [state, run],
  );
}
