---
name: scene-preparation
description: Rules for structuring on-demand service application flows as prepared scenes — one user question per scene, progressive disclosure of downstream complexity, and a single state enum instead of boolean soup.
---

# Scene Preparation

A scene is a prepared environment built around exactly one question. Apply these rules whenever you add, move, or modify a screen, drawer, modal, or step in an on-demand service application (rideshare, delivery, freight, field service, couriers, home services, inspections).

## 1. One question per scene

**Do** design every scene so a user can state its question in one sentence, and so the primary control answers that sentence.

**Never** ask two unrelated questions in one surface.

The canonical questions of this product class:

| Question | Scene |
|---|---|
| Where? | `location_search` |
| What service? | `service_select` |
| Which option? | `configure` |
| Do you want to purchase? | `quote` |
| Where is the provider? | `provider_en_route` / `active` |
| What happened? | `complete` |

Check: read the scene's headline and its primary action aloud. If the action does not answer the headline, split the scene.

```
BAD  [ Pickup ][ Dropoff ][ Vehicle class ][ Payment ][ Notes ][ Confirm ]   one screen
GOOD Where? -> What service? -> Which option? -> Purchase? -> ...
```

**Do** derive the question from code, not from copy scattered in JSX:

```tsx
const { question, action, exit } = serviceAppQuestion(state);
```

**Never** hardcode a headline in a scene component when `serviceAppQuestion` already owns it.

## 2. Current surface expresses intent; next surface is prepared around the remainder

**Do** treat the current surface as the place where one piece of intent is captured, and build the next surface around only what is still unknown.

**Never** carry resolved inputs forward as editable controls. Render them as a compact, tappable summary that returns to their scene.

```
location known -> service_select shows [Origin -> Destination] as a summary chip
                  and spends the surface on service options
```

Check: for each control on a scene, ask "is this input still unresolved?" If no, it is a summary, not a control.

## 3. Wait for intent before exposing downstream complexity

**Do** disclose a decision only after the decision that precedes it is made.

**Never** render the full option matrix on `home`.

```
BAD  home renders: search field + service tiles + vehicle sizes + price table
     + promo entry + scheduling calendar + provider filters
GOOD home -> location_search -> service_select -> configure -> quote
```

Check: count the distinct decisions offered on `home`. It must be one — where, or what.

## 4. When a scene is warranted vs. when an inline control is enough

**Do** prepare a dedicated scene when the task involves any of:

- keyboard input of more than a single token
- search over a set the user cannot see at a glance
- map interaction (panning, pin placement, area selection)
- comparison of three or more options on more than one attribute
- confirmation with money, time, or irreversibility attached
- focus, where surrounding UI would compete for attention
- async progression, where a request runs and the outcome changes the scene

**Do** use an inline control when the task is:

- a binary toggle
- a choice among two or three self-evident options already visible
- an adjustment to a value the user is currently looking at
- a text field whose full context is already on screen

```
BAD  quote scene opens a fullscreen route for "Add a tip?"
GOOD quote scene shows an inline segmented control for tip
```

## 5. Search gets a prepared search environment

**Do** give search its own scene at `fullscreen` presentation with:

- an autofocused input, keyboard raised on mobile
- recents visible before the first keystroke
- a current-location affordance
- results replacing recents in place, no layout jump
- an explicit `cancel_search` exit that restores the prior scene

**Never** place a bare inline search field on `home` and expand it in place.

```
BAD  home: <Input placeholder="Where to?" /> with a dropdown
GOOD home: tap target -> open_search -> location_search (fullscreen, focused)
```

## 6. Confirmation gets focused presentation

**Do** present `quote` at `expanded` or `fullscreen` with the price, the commitment, and one primary action.

**Never** surface a purchase decision in a `peek` strip or behind a scrollable fold, and never place a destructive or navigational control adjacent to the primary confirm.

Check: on the confirmation scene, exactly one control is styled as primary.

## 7. Active states replace planning states

**Do** replace the planning surface when the request is submitted. `matching`, `assigned`, `provider_en_route`, and `active` are about the live service, not about the choices that produced it.

**Never** keep the quote breakdown, the option picker, or the service selector mounted during `matching`.

```
BAD  matching: [spinner] above the still-visible quote + option list
GOOD matching: status headline + typical-duration band + cancel affordance
```

Editing after submission is a `back` transition to the planning scene, not a live control on the active scene.

## 8. Completed states prioritize results

**Do** make `complete` lead with the outcome: what happened, what it cost, proof or summary artifacts.

**Never** lead a completion scene with controls (rebook, rate, share, support). Controls go below the result.

Check: the first element under the headline on `complete` is information, not a button.

## 9. Mapping onto the state model

All scenes live in `ServiceAppState` in `lib/service-app/state.ts`.

**Do** add a scene by adding a member to the `ServiceAppState` union, adding the event that reaches it to `ServiceAppEvent`, handling it in `reduceServiceAppState`, defining its reverse in `backServiceAppState`, and adding its question to `serviceAppQuestion`. All five, or the scene is not real.

**Never** introduce a scene as a boolean.

```ts
// BAD
const [showConfirm, setShowConfirm] = useState(false);

// GOOD
type ServiceAppState = /* ... */ | "quote" | "matching";
reduceServiceAppState("quote", "request", ctx); // -> "matching"
```

**Do** keep app data (selected place, chosen service, quote payload, provider record) in ordinary state or a store. The enum names *where the user is*; app data holds *what they picked*. Do not encode picked values as extra enum members.

**Do** route every scene change through `reduceServiceAppState` and every backward move through `backServiceAppState`. Never call a raw setter for the scene from a component.

## 10. Anti-pattern: boolean soup

```tsx
// BAD
const [isSearching, setIsSearching] = useState(false);
const [isDrawerOpen, setIsDrawerOpen] = useState(false);
const [isConfirming, setIsConfirming] = useState(false);
const [showQuote, setShowQuote] = useState(false);
const [showDriver, setShowDriver] = useState(false);
```

Why this fails, checkably:

- Five booleans encode 32 combinations; the product has eleven legal scenes. The other 21 are bugs waiting to render (`isConfirming && showDriver`).
- There is no single place to answer "what is the user doing right now", so every component re-derives it and they drift.
- Back becomes ad-hoc: each dismissal handler guesses which booleans to unset.
- Async transitions have nothing to lock; two taps set the same flag twice.
- The illegal states are unreachable in tests, so they ship.

```tsx
// GOOD
const [state, setState] = useState<ServiceAppState>("home");
const send = (e: ServiceAppEvent) =>
  setState((s) => reduceServiceAppState(s, e, ctx));
```

Check before merging any scene change:

- [ ] No new `useState<boolean>` that names a screen, step, or overlay.
- [ ] The new scene appears in the enum, the reducer, the back function, and `serviceAppQuestion`.
- [ ] The scene asks exactly one question.
- [ ] Nothing upstream of the current question is still an editable control.
- [ ] `home` offers one decision.

---

## Where the surfaces go

This skill covers *which question* a scene asks. How the surfaces arrange
themselves around that question is `surface-orchestration` — the scene reducer
must not contain viewport choreography. Bridge them with one
`Record<Scene, SurfaceRecipe>` table and a single `apply` call when the scene
changes.

If a scene needs an option list rather than a whole screen, use `ConfigureScene`
and a `ServiceOption[]`. A note is `kind: "text"`, not a scene of its own.
