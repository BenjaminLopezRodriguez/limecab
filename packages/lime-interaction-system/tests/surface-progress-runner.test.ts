import { test } from "node:test";
import assert from "node:assert/strict";

import {
  reduceSurfaceProgress,
  SURFACE_PROGRESS_IDLE,
  SURFACE_PROGRESS_MS,
  type SurfaceProgressEvent,
  type SurfaceProgressState,
} from "../src/core/surface-progress.ts";
import { runSurfaceProgress } from "../src/native/surface-progress-runner.ts";

/**
 * Spec §14. What is under test is ORDER, not milliseconds: the task starts before the
 * choreography does anything, the content only changes while the surface is off screen, and a
 * failure puts the origin back. The clock is faked, so these are about sequence alone.
 */

interface Harness {
  state: SurfaceProgressState;
  /** Every committed state, in order — the trace the assertions read. */
  trace: SurfaceProgressState[];
  waits: number[];
  content: (string | null)[];
  runner: Parameters<typeof runSurfaceProgress>[1];
}

function harness(skipChoreography = false): Harness {
  const h: Harness = {
    state: SURFACE_PROGRESS_IDLE,
    trace: [],
    waits: [],
    content: [],
    runner: null as never,
  };
  h.runner = {
    apply: (event: SurfaceProgressEvent) => {
      h.state = reduceSurfaceProgress(h.state, event);
      h.trace.push(h.state);
      return h.state;
    },
    read: () => h.state,
    // The clock is the only thing faked; ordering is otherwise real.
    wait: (ms: number) => {
      h.waits.push(ms);
      return Promise.resolve();
    },
    skipChoreography,
  };
  return h;
}

/** Phases in order, with repeats collapsed — the task resolving does not move the phase. */
const phases = (h: Harness) =>
  h.trace.map((s) => s.phase).filter((phase, i, all) => phase !== all[i - 1]);

test("the task starts before the choreography, so the animation covers latency", async () => {
  const h = harness();
  let startedAtPhase: SurfaceProgressState["phase"] | null = null;
  await runSurfaceProgress(
    {
      from: "quote",
      to: "matching",
      task: async () => {
        // The task is invoked while the origin is still leaving — not after it has left.
        startedAtPhase = h.state.phase;
        return "ok";
      },
    },
    h.runner,
  );
  assert.equal(startedAtPhase, "exiting");
  assert.deepEqual(h.waits, [
    SURFACE_PROGRESS_MS.exit,
    SURFACE_PROGRESS_MS.interstitial,
    SURFACE_PROGRESS_MS.enter,
  ]);
});

test("the surface is off screen before the next content arrives", async () => {
  const h = harness();
  const seen: { phase: string; sheetOpen: boolean }[] = [];
  await runSurfaceProgress(
    {
      from: "quote",
      to: "matching",
      task: async () => "ok",
      onContent: (content) => seen.push({ phase: h.state.phase, sheetOpen: h.state.sheetOpen }),
    },
    h.runner,
  );
  // Content moved exactly once, at the entering seam — never while the origin was visible.
  assert.equal(seen.length, 1);
  assert.equal(seen[0]!.phase, "entering");
  // Exit and interstitial both ran with the sheet closed: the canvas is what shows in the gap.
  const gap = h.trace.filter((s) => s.phase === "exiting" || s.phase === "interstitial");
  assert.ok(gap.length >= 2);
  assert.ok(gap.every((s) => !s.sheetOpen), "the surface must be gone before the gap");
});

test("the transition locks input and releases it only once the next surface has landed", async () => {
  const h = harness();
  await runSurfaceProgress({ from: "quote", to: "matching", task: async () => "ok" }, h.runner);
  assert.ok(h.trace.slice(0, -1).every((s) => s.locked), "locked for the whole transition");
  assert.deepEqual(phases(h), ["exiting", "interstitial", "entering", "holding", "idle"]);
  assert.equal(h.state.locked, false);
  assert.equal(h.state.sheetOpen, true);
});

test("failure reverses to the origin instead of stranding the rider", async () => {
  const h = harness();
  const content: (string | null)[] = [];
  // Dispatch fails late — after the next surface has already entered, which is the case that
  // actually has something to undo.
  let fail: (error: Error) => void = () => {};
  const run = runSurfaceProgress(
    {
      from: "quote",
      to: "matching",
      task: () => new Promise<string>((_, reject) => (fail = reject)),
      onContent: (c) => content.push(c),
    },
    h.runner,
  );
  // Let the choreography run to `holding`; the faked clock makes that a microtask drain.
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.state.phase, "holding");
  assert.deepEqual(content, ["matching"], "the next surface entered first");
  fail(new Error("no drivers nearby"));
  await assert.rejects(run, /no drivers nearby/);
  // Whatever it moved to, it ends back where it started, unlocked and on screen.
  assert.equal(h.state.content, "quote");
  assert.equal(h.state.phase, "idle");
  assert.equal(h.state.locked, false);
  assert.equal(h.state.sheetOpen, true);
  assert.equal(h.state.error, "no drivers nearby");
  assert.equal(content.at(-1), "quote", "the origin content is restored");
});

test("reduced motion keeps the truthful sequence and the lock, and skips the travelling", async () => {
  const h = harness(true);
  const content: (string | null)[] = [];
  await runSurfaceProgress(
    { from: "quote", to: "matching", task: async () => "ok", onContent: (c) => content.push(c) },
    h.runner,
  );
  assert.deepEqual(h.waits, [], "no choreography timers at all");
  assert.deepEqual(phases(h), ["holding", "idle"], "no exit/interstitial/enter at all");
  assert.deepEqual(content, ["matching"]);
  assert.ok(h.trace[0]!.locked, "still locked while the task runs");
  assert.equal(h.state.locked, false);
});

test("reduced motion still reverses on failure", async () => {
  const h = harness(true);
  await assert.rejects(
    runSurfaceProgress(
      {
        from: "quote",
        to: "matching",
        task: async () => {
          throw new Error("dispatch failed");
        },
      },
      h.runner,
    ),
    /dispatch failed/,
  );
  assert.equal(h.state.content, "quote");
  assert.equal(h.state.locked, false);
});

test("a failure that lands during the gap never shows the next content", async () => {
  const h = harness();
  const content: (string | null)[] = [];
  await assert.rejects(
    runSurfaceProgress(
      {
        from: "quote",
        to: "matching",
        // Rejects synchronously, i.e. while the origin is still exiting.
        task: () => Promise.reject(new Error("declined")),
        onContent: (c) => content.push(c),
      },
      h.runner,
    ),
    /declined/,
  );
  // The next content is never announced — that is the guarantee. The origin *is* announced,
  // because the caller hid the surface on the way in and this callback is the only thing that
  // tells it to put the layout back. Asserting an empty list here previously encoded the bug:
  // a dispatch that failed during the gap left the sheet hidden with nothing to restore it.
  assert.ok(!content.includes("matching"), "the next surface was never entered");
  assert.deepEqual(content, ["quote"], "the caller is told to restore the origin");
  assert.ok(!phases(h).includes("entering"));
  assert.equal(h.state.content, "quote");
});

test("an unnamed error still reads as something a rider can act on", async () => {
  const h = harness(true);
  await assert.rejects(
    runSurfaceProgress({ from: "quote", to: "matching", task: () => Promise.reject("") }, h.runner),
  );
  assert.equal(h.state.error, "Something went wrong. Nothing was submitted.");
});

/**
 * A task that throws synchronously is not the same as one that returns a rejected promise, and
 * the difference used to be fatal: the throw escaped before any handling was attached, so the
 * machine stayed locked and every later transition was refused as "busy".
 */
test("a task that throws synchronously still unlocks and reverses", async () => {
  const h = harness();
  const content: (string | null)[] = [];
  await assert.rejects(
    runSurfaceProgress(
      {
        from: "quote",
        to: "matching",
        task: () => {
          throw new Error("exploded before returning");
        },
        onContent: (c) => content.push(c),
      },
      h.runner,
    ),
    /exploded before returning/,
  );
  assert.equal(h.state.locked, false, "the lock must not survive a synchronous throw");
  assert.equal(h.state.content, "quote");
  assert.deepEqual(content, ["quote"]);
});
