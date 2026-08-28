"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import {
  describeSurfaceLayout,
  initialSurfaceManagerState,
  reduceSurfaceManager,
  SURFACE_MOTION_MS,
  type SurfaceLayout,
  type SurfaceManagerConfig,
  type SurfaceManagerEvent,
  type SurfaceManagerState,
  type SurfaceMotionIntent,
  type SurfaceRecipe,
  type SurfaceState,
} from "@/lib/service-app/surface-manager";

/**
 * SurfaceManager — the React binding.
 *
 * Product code describes *what interaction happened*; the manager decides how
 * the surfaces sit around it. Instead of five setters and a setTimeout:
 *
 *   surfaces.perform("openLocationSearch")
 *
 * It coordinates posture only. AdaptiveSurface still owns drawer/dialog
 * mechanics and focus; ServiceMap still owns how a posture is rendered; the
 * state machine still owns which step the user is in.
 */

type ManagerValue<Id extends string, ActionId extends string> = {
  layout: SurfaceLayout<Id>;
  /** Run a named semantic action. */
  perform: (action: ActionId) => void;
  /** Props for a tappable element. Composes with the caller's own handler. */
  bind: (action: ActionId, onAfter?: () => void) => { onClick: () => void };
  /** Apply an ad-hoc recipe — used to mirror a scene change from the flow. */
  apply: (intent: SurfaceMotionIntent, surfaces: SurfaceRecipe<Id>) => void;
  reset: () => void;
  motion: { duration: number; stagger: number };
  /** Dev-only text snapshot. Empty string in production. */
  debug: string;
};

const SurfaceManagerContext = createContext<ManagerValue<string, string> | null>(
  null,
);

export function SurfaceManagerProvider<
  Id extends string,
  ActionId extends string,
>({
  manager,
  children,
}: {
  manager: SurfaceManagerConfig<Id, ActionId>;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(
    (
      current: SurfaceManagerState<Id>,
      event: SurfaceManagerEvent<Id, ActionId>,
    ) => reduceSurfaceManager(current, event, manager),
    manager,
    (config: SurfaceManagerConfig<Id, ActionId>) =>
      initialSurfaceManagerState(config),
  );

  const perform = useCallback(
    (action: ActionId) => dispatch({ type: "perform", action }),
    [],
  );
  const apply = useCallback(
    (intent: SurfaceMotionIntent, surfaces: SurfaceRecipe<Id>) =>
      dispatch({ type: "apply", intent, surfaces }),
    [],
  );
  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  const bind = useCallback(
    (action: ActionId, onAfter?: () => void) => ({
      onClick: () => {
        dispatch({ type: "perform", action });
        onAfter?.();
      },
    }),
    [],
  );

  const value = useMemo<ManagerValue<Id, ActionId>>(
    () => ({
      layout: state.layout,
      perform,
      bind,
      apply,
      reset,
      motion: SURFACE_MOTION_MS[state.lastIntent ?? "progress"],
      debug:
        process.env.NODE_ENV === "production"
          ? ""
          : describeSurfaceLayout(state.layout),
    }),
    [apply, bind, perform, reset, state.lastIntent, state.layout],
  );

  return (
    <SurfaceManagerContext.Provider
      value={value as unknown as ManagerValue<string, string>}
    >
      {children}
    </SurfaceManagerContext.Provider>
  );
}

export function useSurfaceManager<
  Id extends string = string,
  ActionId extends string = string,
>() {
  const ctx = useContext(SurfaceManagerContext);
  if (!ctx) {
    throw new Error(
      "useSurfaceManager must be used within SurfaceManagerProvider",
    );
  }
  return ctx as unknown as ManagerValue<Id, ActionId>;
}

/** Layout only. Null outside a provider — presentation adapters may read it. */
export function useOptionalSurfaceManager<
  Id extends string = string,
  ActionId extends string = string,
>() {
  const ctx = useContext(SurfaceManagerContext);
  return ctx as unknown as ManagerValue<Id, ActionId> | null;
}

const FALLBACK: SurfaceState = {
  emphasis: "primary",
  presentation: null,
  interaction: "active",
};

/** The posture of one surface. */
export function useSurface<Id extends string = string>(id: Id): SurfaceState {
  const { layout } = useSurfaceManager<Id>();
  return layout[id] ?? FALLBACK;
}

/**
 * Wraps a surface so its posture reaches the DOM.
 *
 * It sets data attributes for styling and, more importantly, enforces the
 * accessibility half of the posture: a suspended or hidden surface becomes
 * `inert`, so it cannot be clicked or reached by the keyboard while something
 * else owns the interaction. It never unmounts its children — that is what
 * preserves scroll, drafts, and focus across an interruption.
 */
export function ManagedSurface<Id extends string = string>({
  id,
  className,
  children,
}: {
  id: Id;
  className?: string;
  children: ReactNode;
}) {
  const surface = useSurface(id);
  const inert = surface.interaction === "inert";
  return (
    <div
      data-surface={id}
      data-emphasis={surface.emphasis}
      data-presentation={surface.presentation ?? undefined}
      data-interaction={surface.interaction}
      inert={inert}
      className={cn(
        "contents",
        surface.emphasis === "hidden" && "hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Dev-only overlay listing every surface's posture. Opt in explicitly; it is
 * never rendered by default. Useful when a coding agent is changing a
 * multi-surface interaction and needs to see the result.
 */
export function SurfaceManagerDebug({ className }: { className?: string }) {
  const { debug } = useSurfaceManager();
  useEffect(() => {
    if (debug) console.debug(`[SurfaceManager]\n${debug}`);
  }, [debug]);
  if (!debug) return null;
  return (
    <pre
      className={cn(
        "bg-popover text-muted-foreground ring-border pointer-events-none fixed bottom-2 left-2 z-50 rounded-lg px-3 py-2 text-[10px] leading-relaxed ring-1",
        className,
      )}
    >
      {debug}
    </pre>
  );
}
