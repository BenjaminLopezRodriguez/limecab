# Surface orchestration

When one user action changes more than one surface, name the action. Do not
coordinate the surfaces yourself.

## The rule

```tsx
// BAD — five independent setters and a guess about ordering
const chooseOnMap = () => {
  setDrawerOpen(false);
  setMapExpanded(true);
  setMapInteractive(true);
  setSearchOpen(false);
  setTimeout(() => setConfirmVisible(true), 180);
};

// GOOD — one semantic action; the recipe says what it means
const chooseOnMap = () => surfaces.perform("chooseOnMap");
```

The improvement is not brevity. Five booleans over four surfaces encode
combinations nothing tests: a map that is visually passive but still selecting,
a sheet declared hidden that still traps focus, a background surface that takes
clicks during a confirmation. Named actions resolve to one layout, and the
layout is checked.

## What a surface posture is

```ts
{ emphasis, presentation, interaction }
```

- `emphasis`: `primary | background | suspended | interrupt | hidden` — the
  surface's relationship to the user's attention. This, not open/closed, is the
  abstraction. "Open" cannot say "suspended behind an interruption".
- `presentation`: a token the *surface* defines — `"sheet"`, `"fullscreen"`,
  `"tracking"`, `"route"`. Semantic, never per-viewport.
- `interaction`: `active | passive | inert`. It follows `emphasis` unless you
  state otherwise, so an off-screen surface cannot keep taking input.

## Boundaries — memorise these

| Question | Owner |
|---|---|
| Which step is the user in? | the scene state machine (`state.ts`) |
| How do the surfaces sit around that step? | SurfaceManager |
| What does "sheet" look like at this width? | AdaptiveSurface |
| What does "tracking" draw? | the map adapter |
| Who runs the request and holds the lock? | `surface-progress.ts` |
| What is a service, a price, a provider? | the application |

Two consequences:

- **The scene reducer never contains viewport choreography.** Bridge the two
  with a `Record<Scene, SurfaceRecipe>` table and one `apply` call.
- **SurfaceManager never holds business data.** No destination, fare, driver, or
  package. If you are tempted, the data belongs to app state, the scene context,
  or the server.

## Progression, interruption, return

The motion intent decides what happens to surface history.

- `interrupt` pushes the current layout. The suspended surface stays **mounted**
  — drafts, scroll, and focus survive.
- `return` pops it. The user lands exactly where they left.
- `progress` clears it. Once the task has moved on there is nothing coherent to
  return to.

Surface history is visual restoration only, a few deep. Navigation history is
the router's job. If you find yourself pushing more than two or three layouts,
you are building a window manager and should stop.

## Async work

SurfaceManager does not run tasks and must never fabricate an outcome.

```tsx
surfaces.perform("requestPending");        // surfaces move now
await surface.transition({                 // the task runs under the transition
  intent: "progress", from: "quote", to: "matching",
  interim: "map", task: () => createRequest(),
});
// on rejection:
surfaces.perform("restoreQuote");
```

The progress machine owns the lock, the truthful phase sequence, stale-response
protection, and the reversal. SurfaceManager owns only where things sit.

## Tap logic

Attach semantics to the element, explicitly. No DOM interception, no magic.

```tsx
<LocationTrigger onActivate={() => surfaces.perform("openLocationSearch")} />
<ServiceTile {...surfaces.bind("chooseService", () => go("select_service"))} />
```

`bind` composes with your own handler; it does not replace it.

## Naming actions

Name the interaction, not the animation.

```
GOOD  chooseOnMap · openLocationSearch · requestPending · resume
BAD   slideSheetDown · expandMap · setStepThree · toggleThing
```

An action whose name only makes sense next to its recipe is a recipe, not an
action.

## Checklist before you ship a surface change

- [ ] The interaction has one name, and the name says what the user did.
- [ ] No component sets more than one surface's state directly.
- [ ] Every `interrupt` has a matching `return`, and the parent stayed mounted.
- [ ] Suspended and hidden surfaces are `inert`.
- [ ] The same action works at 390px and 1280px with no viewport branch in logic.
- [ ] Nothing business-shaped ended up in a surface posture.
- [ ] The dev console is silent — invariant warnings mean an impossible layout.
