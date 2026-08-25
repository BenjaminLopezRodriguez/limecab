/**
 * Optimistic scene-transition state machine.
 *
 * Covers async work with a truthful process transition: current surface
 * exits, the parent canvas may briefly show, then the next surface enters.
 * Failures reverse to the origin. Outcome is never faked.
 */

export type SurfaceProgressPhase =
  | "idle"
  | "exiting"
  | "interstitial"
  | "entering"
  | "holding"
  | "reversing";

export type SurfaceProgressState = {
  phase: SurfaceProgressPhase;
  from: string | null;
  to: string | null;
  content: string | null;
  sheetOpen: boolean;
  locked: boolean;
  choreography: boolean;
  taskStatus: "idle" | "pending" | "resolved" | "rejected";
  error: string | null;
};

export const SURFACE_PROGRESS_IDLE: SurfaceProgressState = {
  phase: "idle",
  from: null,
  to: null,
  content: null,
  sheetOpen: true,
  locked: false,
  choreography: true,
  taskStatus: "idle",
  error: null,
};

/** Eager, not theatrical. Matches `--duration-normal` / `--duration-instant`. */
export const SURFACE_PROGRESS_MS = {
  exit: 220,
  interstitial: 80,
  enter: 220,
} as const;

export type SurfaceProgressEvent =
  | {
      type: "start";
      from: string;
      to: string | null;
      interim: boolean;
      skipChoreography?: boolean;
    }
  | { type: "exit_complete" }
  | { type: "interstitial_complete" }
  | { type: "enter_complete" }
  | { type: "task_resolved" }
  /** The next surface has arrived and owns the screen again. Releases the lock. */
  | { type: "settle" }
  | { type: "task_rejected"; error: string };

export function surfaceProgressReady(state: SurfaceProgressState): boolean {
  if (state.taskStatus !== "resolved") return false;
  if (state.phase === "holding") return true;
  return false;
}

export function surfaceProgressFailed(state: SurfaceProgressState): boolean {
  return (
    state.phase === "idle" &&
    state.taskStatus === "rejected" &&
    Boolean(state.error)
  );
}

export function reduceSurfaceProgress(
  state: SurfaceProgressState,
  event: SurfaceProgressEvent,
): SurfaceProgressState {
  switch (event.type) {
    case "start":
      if (state.locked) return state;
      if (event.skipChoreography) {
        return {
          phase: "holding",
          from: event.from,
          to: event.to,
          content: event.to ?? event.from,
          sheetOpen: true,
          locked: true,
          choreography: false,
          taskStatus: "pending",
          error: null,
        };
      }
      return {
        phase: "exiting",
        from: event.from,
        to: event.to,
        content: event.from,
        sheetOpen: false,
        locked: true,
        choreography: true,
        taskStatus: "pending",
        error: null,
      };

    case "exit_complete":
      if (state.phase === "exiting" || state.phase === "reversing") {
        return { ...state, phase: "interstitial", sheetOpen: false };
      }
      return state;

    case "interstitial_complete":
      if (state.phase !== "interstitial") return state;
      if (state.taskStatus === "rejected") {
        return restoreOrigin(state);
      }
      if (state.to) {
        return {
          ...state,
          phase: "entering",
          content: state.to,
          sheetOpen: true,
        };
      }
      return { ...state, phase: "holding", sheetOpen: false };

    case "enter_complete":
      if (state.phase !== "entering") return state;
      if (state.taskStatus === "rejected") {
        return {
          ...state,
          phase: "reversing",
          sheetOpen: false,
          content: state.to,
        };
      }
      return { ...state, phase: "holding", sheetOpen: true };

    case "settle":
      if (state.taskStatus !== "resolved") return state;
      return SURFACE_PROGRESS_IDLE;

    case "task_resolved":
      if (state.taskStatus !== "pending") return state;
      return { ...state, taskStatus: "resolved" };

    case "task_rejected": {
      if (state.taskStatus !== "pending") return state;
      const rejected = {
        ...state,
        taskStatus: "rejected" as const,
        error: event.error,
      };
      if (!state.choreography) return restoreOrigin(rejected);
      if (state.phase === "holding" && state.to && state.sheetOpen) {
        return {
          ...rejected,
          phase: "reversing",
          sheetOpen: false,
          content: state.to,
        };
      }
      if (state.phase === "holding" && !state.to) {
        return restoreOrigin(rejected);
      }
      if (state.phase === "entering") {
        return rejected;
      }
      return rejected;
    }
  }
}

function restoreOrigin(state: SurfaceProgressState): SurfaceProgressState {
  return {
    ...state,
    phase: "idle",
    content: state.from,
    sheetOpen: true,
    locked: false,
  };
}
