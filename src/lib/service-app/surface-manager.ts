/**
 * SurfaceManager — surface orchestration.
 *
 * It does exactly one thing: coordinate the presentation and interaction
 * posture of multiple UI surfaces in response to semantic user actions.
 *
 * It is not a router, not a store, not an animation engine, and not a
 * workflow engine. It holds no business data — no destination, no price, no
 * provider. `state.ts` answers "which step is the user in"; SurfaceManager
 * answers "how should the surfaces sit around that step".
 *
 * This file is pure: types, a reducer, and dev-only invariant checks. The
 * React binding lives in `components/service-app/surface-manager.tsx`.
 */

/** What a surface is *for* in the composition. Fixed, small, structural. */
export type SurfaceRole =
  | "background"
  | "primary"
  | "secondary"
  | "interrupt"
  | "overlay";

/**
 * The surface's relationship to the user's attention. This — not
 * open/closed — is the abstraction that makes coordination expressible.
 */
export type SurfaceEmphasis =
  | "primary" //  the subject of the current interaction
  | "background" //  present, contextual, not the subject
  | "suspended" //  the user's task, held behind an interruption
  | "interrupt" //  a temporary question in front of everything
  | "hidden"; //  not on screen

/** Whether the surface may receive input. */
export type SurfaceInteraction = "active" | "passive" | "inert";

/**
 * How a transition should feel. It selects a motion preset; it never encodes
 * a per-action millisecond value, and it decides history behaviour:
 * `interrupt` pushes the current layout, `return` pops it.
 */
export type SurfaceMotionIntent =
  | "progress"
  | "interrupt"
  | "return"
  | "expand"
  | "collapse";

export type SurfaceState = {
  emphasis: SurfaceEmphasis;
  /**
   * Surface-defined posture token, e.g. "sheet" / "overlay" / "fullscreen"
   * for a task surface, "route" / "tracking" for a canvas. SurfaceManager
   * passes it through; the surface decides what it means at this viewport.
   * `"overlay"` flags a drawer that should slide up to fill the screen.
   */
  presentation: string | null;
  interaction: SurfaceInteraction;
};

export type SurfaceDefinition = {
  role: SurfaceRole;
  initial: SurfaceState;
  /** Documentation only: the postures this surface understands. */
  presentations?: readonly string[];
};

/** Shorthand: a bare string is a presentation, an object is explicit. */
export type SurfaceTarget = string | Partial<SurfaceState>;

export type SurfaceRecipe<Id extends string> = Partial<Record<Id, SurfaceTarget>>;

export type SurfaceAction<Id extends string> = {
  intent: SurfaceMotionIntent;
  surfaces: SurfaceRecipe<Id>;
};

export type SurfaceLayout<Id extends string> = Record<Id, SurfaceState>;

export type SurfaceManagerConfig<
  Id extends string,
  ActionId extends string,
> = {
  surfaces: Record<Id, SurfaceDefinition>;
  actions: Record<ActionId, SurfaceAction<Id>>;
};

export type SurfaceManagerState<Id extends string> = {
  layout: SurfaceLayout<Id>;
  /** Visual restoration only. Workflow history belongs to the state machine. */
  history: SurfaceLayout<Id>[];
  lastIntent: SurfaceMotionIntent | null;
  lastAction: string | null;
};

/** Motion presets, in ms. Intent-based, so no action carries its own timing. */
export const SURFACE_MOTION_MS: Record<
  SurfaceMotionIntent,
  { duration: number; stagger: number }
> = {
  progress: { duration: 220, stagger: 40 },
  interrupt: { duration: 180, stagger: 0 },
  return: { duration: 180, stagger: 0 },
  expand: { duration: 260, stagger: 60 },
  collapse: { duration: 200, stagger: 40 },
};

const HISTORY_LIMIT = 4;

export function createSurfaceManager<
  const Id extends string,
  const ActionId extends string,
>(
  config: SurfaceManagerConfig<Id, ActionId>,
): SurfaceManagerConfig<Id, ActionId> {
  if (process.env.NODE_ENV !== "production") {
    assertLayout(initialLayout(config), "initial");
  }
  return config;
}

export function initialLayout<Id extends string, ActionId extends string>(
  config: SurfaceManagerConfig<Id, ActionId>,
): SurfaceLayout<Id> {
  const layout = {} as SurfaceLayout<Id>;
  for (const id of Object.keys(config.surfaces) as Id[]) {
    const definition = config.surfaces[id];
    layout[id] = { ...definition.initial };
  }
  return layout;
}

export function initialSurfaceManagerState<
  Id extends string,
  ActionId extends string,
>(config: SurfaceManagerConfig<Id, ActionId>): SurfaceManagerState<Id> {
  return {
    layout: initialLayout(config),
    history: [],
    lastIntent: null,
    lastAction: null,
  };
}

export type SurfaceManagerEvent<Id extends string, ActionId extends string> =
  | { type: "perform"; action: ActionId }
  | { type: "apply"; intent: SurfaceMotionIntent; surfaces: SurfaceRecipe<Id> }
  | { type: "reset" };

export function reduceSurfaceManager<Id extends string, ActionId extends string>(
  state: SurfaceManagerState<Id>,
  event: SurfaceManagerEvent<Id, ActionId>,
  config: SurfaceManagerConfig<Id, ActionId>,
): SurfaceManagerState<Id> {
  if (event.type === "reset") return initialSurfaceManagerState(config);

  const action =
    event.type === "perform" ? config.actions[event.action] : undefined;

  if (event.type === "perform" && !action) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[SurfaceManager] unknown action "${event.action}"`);
    }
    return state;
  }

  const intent = action ? action.intent : event.type === "apply" ? event.intent : "progress";
  const recipe = action ? action.surfaces : event.type === "apply" ? event.surfaces : {};
  const name = event.type === "perform" ? event.action : null;

  // `return` restores the layout captured by the matching `interrupt`. Any
  // surfaces named in the recipe are still applied on top, so an action can
  // both restore and adjust.
  if (intent === "return") {
    const restored = state.history[state.history.length - 1];
    const base = restored ?? state.layout;
    const layout = applyRecipe(base, recipe, config);
    return finish({
      layout,
      history: state.history.slice(0, -1),
      lastIntent: intent,
      lastAction: name,
    });
  }

  let layout = applyRecipe(state.layout, recipe, config);

  // A progression means the interruption is over. Dismissing lingering
  // interrupt surfaces here is cheaper than every recipe remembering to.
  if (intent === "progress") layout = dismissInterrupts(layout);

  // A repeated tap resolves to the same layout. Treating it as a no-op is
  // what stops double-taps stacking interruptions or losing the return point.
  if (sameLayout(state.layout, layout)) {
    return { ...state, lastIntent: intent, lastAction: name };
  }

  const history =
    intent === "interrupt"
      ? [...state.history, state.layout].slice(-HISTORY_LIMIT)
      : // A progression invalidates any suspended layout: there is nothing
        // coherent to return to once the task itself has moved on.
        intent === "progress"
        ? []
        : state.history;

  return finish({ layout, history, lastIntent: intent, lastAction: name });
}

function finish<Id extends string>(
  next: SurfaceManagerState<Id>,
): SurfaceManagerState<Id> {
  if (process.env.NODE_ENV !== "production") {
    assertLayout(next.layout, next.lastAction ?? next.lastIntent ?? "apply");
  }
  return next;
}

function applyRecipe<Id extends string, ActionId extends string>(
  layout: SurfaceLayout<Id>,
  recipe: SurfaceRecipe<Id>,
  config: SurfaceManagerConfig<Id, ActionId>,
): SurfaceLayout<Id> {
  const next = { ...layout };
  for (const key of Object.keys(recipe) as Id[]) {
    const target = recipe[key];
    if (target === undefined) continue;
    const current = layout[key] ?? config.surfaces[key]?.initial;
    if (!current) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[SurfaceManager] unknown surface "${key}"`);
      }
      continue;
    }
    next[key] = resolveTarget(current, target);
  }
  return next;
}

function resolveTarget(
  current: SurfaceState,
  target: SurfaceTarget,
): SurfaceState {
  const patch: Partial<SurfaceState> =
    typeof target === "string" ? { presentation: target } : target;
  const emphasis = patch.emphasis ?? current.emphasis;
  return {
    emphasis,
    presentation:
      patch.presentation !== undefined
        ? patch.presentation
        : // A surface that is off screen has no posture. Clearing it keeps
          // "hidden" a single layout rather than one per way in.
          emphasis === "hidden"
          ? null
          : current.presentation,
    // Interaction follows emphasis unless stated: a hidden or suspended
    // surface must not keep taking clicks, which is the bug this prevents.
    interaction: patch.interaction ?? interactionFor(emphasis, current, patch),
  };
}

function interactionFor(
  emphasis: SurfaceEmphasis,
  current: SurfaceState,
  patch: Partial<SurfaceState>,
): SurfaceInteraction {
  if (patch.emphasis === undefined) return current.interaction;
  switch (emphasis) {
    case "hidden":
    case "suspended":
      return "inert";
    case "background":
      return "passive";
    case "primary":
    case "interrupt":
      return "active";
  }
}

function sameLayout<Id extends string>(
  a: SurfaceLayout<Id>,
  b: SurfaceLayout<Id>,
): boolean {
  for (const key of Object.keys(a) as Id[]) {
    const left = a[key];
    const right = b[key];
    if (!left || !right) return false;
    if (
      left.emphasis !== right.emphasis ||
      left.presentation !== right.presentation ||
      left.interaction !== right.interaction
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Development-time invariants. These are the impossible states that
 * hand-rolled setter soup produces; catching them at the source beats
 * debugging them through three components.
 */
export function surfaceLayoutViolations<Id extends string>(
  layout: SurfaceLayout<Id>,
): string[] {
  const problems: string[] = [];
  const entries = Object.entries(layout) as [Id, SurfaceState][];

  const fillingPrimary = entries.filter(
    ([, s]) =>
      s.emphasis === "primary" &&
      (s.presentation === "fullscreen" || s.presentation === "overlay"),
  );
  if (fillingPrimary.length > 1) {
    problems.push(
      `two filling primary surfaces: ${fillingPrimary
        .map(([id]) => id)
        .join(", ")}`,
    );
  }

  const interrupting = entries.filter(([, s]) => s.emphasis === "interrupt");
  if (interrupting.length > 1) {
    problems.push(
      `more than one interrupting surface: ${interrupting
        .map(([id]) => id)
        .join(", ")}`,
    );
  }
  if (interrupting.length === 1) {
    for (const [id, s] of entries) {
      if (s.emphasis !== "interrupt" && s.interaction === "active") {
        problems.push(`"${id}" is active behind an interruption`);
      }
    }
  }

  for (const [id, s] of entries) {
    if (s.emphasis === "hidden" && s.interaction !== "inert") {
      problems.push(`"${id}" is hidden but still interactive`);
    }
    if (s.emphasis === "background" && s.interaction === "active") {
      problems.push(`"${id}" is visually passive but accepts input`);
    }
  }

  return problems;
}

function assertLayout<Id extends string>(layout: SurfaceLayout<Id>, source: string) {
  for (const problem of surfaceLayoutViolations(layout)) {
    console.warn(`[SurfaceManager] ${source}: ${problem}`);
  }
}

/** One-line-per-surface snapshot for dev logging and agent debugging. */
export function describeSurfaceLayout<Id extends string>(
  layout: SurfaceLayout<Id>,
): string {
  return (Object.entries(layout) as [Id, SurfaceState][])
    .map(
      ([id, s]) =>
        `${id.padEnd(10)} ${s.emphasis}${
          s.presentation ? `:${s.presentation}` : ""
        } (${s.interaction})`,
    )
    .join("\n");
}

function dismissInterrupts<Id extends string>(
  layout: SurfaceLayout<Id>,
): SurfaceLayout<Id> {
  let next = layout;
  for (const [id, surface] of Object.entries(layout) as [Id, SurfaceState][]) {
    if (surface.emphasis !== "interrupt") continue;
    if (next === layout) next = { ...layout };
    next[id] = { emphasis: "hidden", presentation: null, interaction: "inert" };
  }
  return next;
}
