---
name: perceived-performance
description: Rules for masking latency without lying — the tap-to-truthful-state sequence, the transition lock, semantic waiting metrics per lifecycle state, and graceful failure restoration in on-demand service applications.
---

# Perceived Performance

Rules for every action in an on-demand service application that triggers async work. The machine lives in `lib/service-app/surface-progress.ts`; the entry point is `surface.transition()` from `components/service-app/adaptive-surface.tsx`.

## 1. The canonical sequence

Every async-bearing action follows this order, without exception:

```
tap
 |-- 0ms      immediate visual acknowledgement (press state, lock engages)
 |-- 0ms      current surface begins exiting          [phase: exiting]
 |-- 0ms      async request starts, concurrently      [taskStatus: pending]
 |-- 220ms    interim content shown                   [phase: interstitial]
 |-- 300ms    next surface enters                     [phase: entering]
 |-- 520ms+   next truthful state, when the task has resolved   [phase: holding]
```

**Do** start the request and the exit animation in the same tick.

**Never** sequence them: request first, animation after. **Never** leave the user on a static surface while meaningful async work runs.

Check: from the moment of the tap, something on screen changes within one frame.

## 2. Truthfulness — hard line

Transition time may mask latency. It may **never** fabricate a completed outcome.

**Do** show, before backend confirmation:

- "Finding a provider…"
- "Submitting your request…"
- "Confirming availability…"
- "Processing payment…"

**Never** show, before backend confirmation:

- "Provider assigned"
- "Payment complete"
- "Order placed"
- "Arriving in 4 minutes"
- a named provider, a vehicle, a photo, an ETA, or an order number

```tsx
// BAD — asserts an outcome the server has not returned
setHeadline("Provider assigned");
await createRequest();

// GOOD — animates toward the outcome, asserts nothing
surface.transition({
  intent: "progress", from: "quote", to: "matching",
  interim: "map", task: () => createRequest(),
});
// matching scene reads: "Finding a provider nearby…"
```

Test for any interim string: if the request fails right now, does this text become a lie the user already read? If yes, it is forbidden.

## 3. Animating toward a state ≠ asserting a state

**Do** use motion, layout, and interim content to *point at* the next scene: the sheet recedes, the map expands, a neutral interstitial appears.

**Never** render the next scene's confirmed data during `exiting`, `interstitial`, or `entering`. Confirmed data renders only in `holding`, only after `taskStatus === "fulfilled"`.

```
exiting / interstitial / entering  -> geometry, motion, neutral progress copy
holding                            -> real provider, real ETA, real receipt
```

Check: every field bound to server data has a defined render for `taskStatus !== "fulfilled"` that is a skeleton or a neutral label, never a placeholder value that looks real.

## 4. Duplicate input prevention

**Do** rely on `locked: true` in the progress machine. The lock engages at the tap and releases on `holding` or on `reversing` completion. While locked, further transition requests for the same flow are ignored.

**Never** rely on a disabled button alone. A disabled button on an otherwise static surface reads as a dead app and produces repeat taps, then a rage-tap, then a duplicate request when the guard is imperfect.

```tsx
// BAD
<Button disabled={submitting} onClick={async () => {
  setSubmitting(true);
  await createRequest();     // screen frozen for 1.8s
  setState("matching");
}} />

// GOOD
<Button onClick={() => surface.transition({
  intent: "progress", from: "quote", to: "matching",
  interim: "map", task: () => createRequest(),
})} />
```

Check: double-tap the primary action fast. Exactly one request fires, and the surface moves on the first tap.

## 5. Semantic waiting

**Never** ship one generic spinner across the lifecycle. Each wait has a different uncertainty, so each shows a different metric. Read it from `serviceStatusView(status)` in `lib/service-app/status.ts`.

| State | What the user is actually uncertain about | Metric to display |
|---|---|---|
| `matching` | Will anyone accept, and how long do I stand here? | typical-duration band ("usually 1–3 min"), `showProgress: false` — no fake bar |
| `assigned` | Who is coming, and is this real? | provider identity + confirmed pickup window |
| `provider_en_route` | When do I need to be ready? | clock ETA ("arrives 4:12 PM"), live-updating |
| `active` | How far through is this? | step-of-N progress from `milestones` / `milestoneIndex`, `progress` bar |
| `completing` | Is it over, can I leave? | short fixed estimate ("wrapping up, ~30s") |
| `complete` | What did I get and what did it cost? | result summary, no timing at all |

Rules:

- **Do** show a determinate bar only where the denominator is real (`active`).
- **Never** show a percentage during `matching`. There is no denominator; an invented one is a lie under rule 2.
- **Do** use a band ("usually 1–3 min"), never a countdown, when the duration is a distribution rather than a schedule.
- **Do** switch a stalled `matching` wait to an explicit `callout` ("taking longer than usual") rather than letting the same copy sit unchanged.

Check: no two lifecycle states render the same waiting component with the same copy.

## 6. Graceful failure restoration

On task rejection the machine enters `reversing` and returns to the origin surface with `error` populated.

**Do**:

- restore the origin surface with all inputs, scroll, and focus intact
- render the error inline, adjacent to the action that failed
- keep the primary action present and re-armed (the lock releases)
- keep the message specific and actionable

**Never**:

- strand the user on a blank screen, an empty interstitial, or a half-entered form
- silently swallow the rejection and sit in `interstitial` forever
- progress to the next scene anyway and let it fail later
- replace the whole scene with a full-page error for a recoverable request failure

```
tap -> exiting -> interstitial -> [task rejects]
                                   |
                                   v
                              reversing (220ms)
                                   |
                                   v
              origin surface restored + inline error + unlocked
```

Check: force the task to reject. The user is back on the surface they left, their inputs are present, they can read what went wrong, and they can retry with one tap.

## 7. Reduced motion and desktop

Choreography is skipped when `prefers-reduced-motion: reduce` is set and on desktop. What is skipped is *animation only*.

**Do** keep, in every case:

- the lock
- the concurrent task
- the truthful state sequence (no asserted outcome before resolution)
- the interim status copy
- the failure reversal with inline error

**Never** treat reduced motion as a reason to fall back to `await` + `setState` with a frozen screen, and never let the desktop path skip the lock.

```
motion on   : exiting(220) -> interstitial(80) -> entering(220) -> holding
motion off  : [immediate swap] -> holding, same lock, same task, same truth rules
```

Check: with reduced motion forced on, double-tap submit — still exactly one request; force a rejection — still an inline error on the restored surface.

## 8. Reference usage

```tsx
const surface = useAdaptiveSurface();

function onRequest() {
  surface.transition({
    intent: "progress",
    from: "quote",
    to: "matching",
    interim: "map",                  // neutral content during the gap
    task: () => createRequest(draft) // starts immediately, runs concurrently
  });
}
```

Counterexample to never reproduce:

```tsx
async function onRequest() {
  await createRequest(draft);   // 1.8s of frozen quote screen, no feedback
  setState("matching");         // scene snaps in with no transition
}
```

That version fails four rules at once: no acknowledgement, static surface during async work, no lock, and no defined failure path.

## Merge checklist

- [ ] Every async action goes through `surface.transition({ ..., task })`.
- [ ] No `await` before a scene change in a component handler.
- [ ] No interim copy asserts an unconfirmed outcome.
- [ ] Server-bound fields render neutrally until `taskStatus === "fulfilled"`.
- [ ] Duplicate submission is prevented by the lock, not only a disabled button.
- [ ] Each lifecycle wait shows its own metric from `serviceStatusView`.
- [ ] Rejection restores the origin surface with an inline, specific error.
- [ ] Reduced-motion and desktop paths keep lock, task, truth, and failure handling.

---

## Who moves the surfaces while the task runs

The progress machine owns the task, the lock, the truthful phase sequence,
stale-response protection, and the reversal. It does not decide where the
surfaces sit. When a request also changes the composition — the quote leaves and
the canvas briefly dominates — name that as a surface action and let
SurfaceManager apply it, then run the task under `transition` as usual:

```tsx
surfaces.perform("requestPending");
await surface.transition({ intent: "progress", from: "quote", to: "matching",
                           interim: "map", task: () => createRequest() });
// on rejection
surfaces.perform("restoreQuote");
```

SurfaceManager must never fabricate an outcome. It moves surfaces; the backend
decides what is true. See `surface-orchestration`.

First paint counts too. A scene waiting on its own data renders
`SurfaceSkeleton`, not a spinner — and a skeleton is geometry: never a
plausible-looking price, name, or ETA the user could read as real.
