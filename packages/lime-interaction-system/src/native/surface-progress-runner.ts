import {
  reduceSurfaceProgress,
  SURFACE_PROGRESS_MS,
  type SurfaceProgressEvent,
  type SurfaceProgressState,
} from "../core/surface-progress.ts";

/**
 * The sequencer that drives `core/surface-progress.ts` on a clock.
 *
 * The reducer says what the phases mean; this says when they advance. It is deliberately free
 * of React and of React Native — the timer and the state cell arrive as dependencies — so the
 * ordering can be tested headlessly, which is the only part of this that is easy to get wrong.
 *
 * The rule it exists to enforce: **the task runs concurrently with the choreography.** The
 * animation covers latency, it does not follow it. A surface that waits for the network and
 * then animates is the thing this replaces.
 */

export interface SurfaceProgressRun<T> {
  /** Identity of the content on screen now. */
  from: string;
  /** Identity of the content that replaces it, or null when nothing follows. */
  to?: string | null;
  interim?: boolean;
  /** Started immediately, awaited last. */
  task: () => Promise<T>;
  /**
   * The reducer moved the surface's content — forward at the interstitial, or back to the
   * origin when the task failed. The caller applies it to whatever owns that content durably;
   * this runner keeps no durable state of its own.
   */
  onContent?: (content: string | null) => void;
}

export interface SurfaceProgressRunner {
  /** Reduce an event and commit it. Returns the resulting state. */
  apply: (event: SurfaceProgressEvent) => SurfaceProgressState;
  /** The committed state, read back between awaits. */
  read: () => SurfaceProgressState;
  wait: (ms: number) => Promise<void>;
  /** Reduced motion: keep the truthful state sequence and the lock, drop the travelling. */
  skipChoreography?: boolean;
}

export async function runSurfaceProgress<T>(
  input: SurfaceProgressRun<T>,
  runner: SurfaceProgressRunner,
): Promise<T> {
  const skip = Boolean(runner.skipChoreography);
  const wait = (ms: number) => (skip ? Promise.resolve() : runner.wait(ms));

  // Content is announced on change only, measured from what is already on screen.
  let content: string | null = input.from;
  const apply = (event: SurfaceProgressEvent) => {
    const previous = runner.read();
    const next = runner.apply(event);
    // `settle` resets the machine, it does not move anything — the next content is already
    // on screen and owns it. Announcing the reset would read as a second transition.
    if (event.type === "settle") return next;
    // A reversal has to be reported even when the content never left the origin: the caller
    // hid the surface on the way in, and only this callback tells it to put things back. It is
    // the failure path that strands the layout, so it cannot be gated on content moving.
    const reversed = previous.phase !== "idle" && next.phase === "idle" && next.taskStatus === "rejected";
    if (next.content !== content || reversed) {
      content = next.content;
      input.onContent?.(next.content);
    }
    return next;
  };

  apply({
    type: "start",
    from: input.from,
    to: input.to ?? null,
    interim: Boolean(input.interim),
    skipChoreography: skip,
  });

  // `task()` may throw synchronously rather than returning a rejected promise. Called bare that
  // escapes before any handling is attached and the machine stays locked forever. Catching it
  // here rather than deferring through `Promise.resolve().then()` matters: deferring costs a
  // microtask, which is enough for a rejection that should land during the gap to arrive after
  // it, and the next content is briefly shown on a transition that failed.
  let started: Promise<T>;
  try {
    started = input.task();
  } catch (error) {
    started = Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }

  const task = started.then(
    (value) => {
      apply({ type: "task_resolved" });
      return value;
    },
    (error: unknown) => {
      apply({ type: "task_rejected", error: taskErrorMessage(error) });
      throw error;
    },
  );
  // The rejection is reported through the awaits below; this only stops the interim
  // suspension from being reported as unhandled while the choreography is still running.
  task.catch(() => {});

  if (!skip) {
    await wait(SURFACE_PROGRESS_MS.exit);
    apply({ type: "exit_complete" });
    await wait(SURFACE_PROGRESS_MS.interstitial);
    const afterGap = apply({ type: "interstitial_complete" });
    if (afterGap.phase === "entering") {
      await wait(SURFACE_PROGRESS_MS.enter);
      apply({ type: "enter_complete" });
    }
  }

  try {
    const value = await task;
    // The next surface owns the screen now: drop the lock. Failures release via the origin.
    apply({ type: "settle" });
    return value;
  } catch (error) {
    // Failure reverses to the origin rather than stranding the user on an empty screen.
    let current = runner.read();
    if (current.phase === "entering") {
      await wait(SURFACE_PROGRESS_MS.enter);
      current = apply({ type: "enter_complete" });
    }
    if (current.phase === "reversing") {
      await wait(SURFACE_PROGRESS_MS.exit);
      apply({ type: "exit_complete" });
      await wait(SURFACE_PROGRESS_MS.interstitial);
      apply({ type: "interstitial_complete" });
    }
    throw error;
  }
}

export function taskErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "Something went wrong. Nothing was submitted.";
}
