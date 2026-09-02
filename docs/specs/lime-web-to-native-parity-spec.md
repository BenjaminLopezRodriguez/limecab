# Lime Web → Native Parity Spec

**Status:** canonical handoff. Supersedes nothing; extends
`docs/superpowers/specs/2026-08-31-lime-ui-rn-primitives-design.md`, which covers the design of
`@lime/ui` itself.

**Purpose:** let a fresh agent continue the migration without re-deriving the architecture.
Read §3 (findings) and §5 (bugs already found) before writing any code — both encode things that
cost real time to discover and are invisible from the type system.

**Verified against the repository on 2026-08-31.** Counts and file lists in this document were
read from the tree, not remembered. Re-verify §22 before trusting the numbers.

---

## 1. Project end state

Two phases. Phase A — build reusable libraries that capture Lime's portable UI and interaction
grammar — is substantially done. Phase B — use them to reproduce the production web experiences
natively — is in progress.

```
business/server state  OR  deterministic fixture state
        ↓
interaction projection
        ↓
ExperienceFrame
        ↓
SurfaceManager / reusable recipes
        ↓
renderer ──┬── web    → production web app
           └── native → Lime / LimeDriver
        ↓
@lime/ui primitives
```

`Lime` is the native counterpart of production `/`. `LimeDriver` is the native counterpart of
production `/driver`.

Both currently live in one Expo project (`apps/lime-native`) as two routes. **Do not split them
into two binaries during the parity phase.** Keep their composition separable — no shared
mutable state between the two routes, no cross-imports — so the split is cheap later.

The migration target is *not* a backend rewrite. It is: same product semantics, same observable
UX, same interaction choreography, same recognizable visual system, native-quality execution.

---

## 2. Reusable library responsibilities

### `@lime/ui`

A portable Expo/React Native visual library. It must stay usable by an Expo app that has never
heard of LimeCab.

Owns: semantic colour roles and themes, typography, spacing, radii, elevation, atoms, portable
presentation primitives, and a minimal platform adapter (`View` / `Text` / `Pressable` /
`TextInput` / `useColorScheme` / `tabularNums`).

Must **not** contain: rider state, driver state, LimeCab domain objects, `SurfaceManager`,
`ExperienceFrame`, `MapSceneState`, Expo Router assumptions, Next.js assumptions, or any
backend/auth/db/payment state.

Exports today: `.`, `./tokens`, `./package.json`.

Atoms: `Button` `Input` `ProgressBar` `Separator` `IconGlyph` `MapFloatingButton`.
Primitives: `ChoiceList`/`ChoiceRow`/`ChoiceGlyph` `LocationTrigger` `MapRouteBar` `RouteRail`
`LiveSheetHeader` `ProviderCard` `QuotePanel` `CompletionPanel` `PrimaryAction`
`SecondaryAction` `ConfirmActionSurface` `SurfaceSkeleton`.

**Theming doctrine.** A restrained monochrome/neutral foundation with Lime as a *semantic
accent*, not a green interface. Light, dark and system. Components consume roles
(`background` `surface` `surfaceElevated` `foreground` `muted` `mutedForeground` `border`
`input` `accent` `accentForeground` `destructive` `destructiveForeground`) and never a palette
entry — there is no `colors.lime`, only `colors.accent`, which is what lets the brand be swapped
via `createTheme()`.

Lime marks: dominant action, selection, progress, live/active state, current spatial position,
success. Never decoration. The design test: strip the accent and the interface should still be
coherent; restore it and the important things should be findable at a glance.

**Every runtime colour must be React Native-parseable** — hex, `rgb()`/`rgba()` or `hsl()`. This
is not stylistic. RN's colour parser returns `null` for anything else and then silently drops the
style property; `oklch()` typechecks, renders correctly in a browser, and makes the whole
interface colourless on a device. Original OKLCH authoring values live in comments beside each
hex.

### `@lime/interaction-system`

Owns the platform-neutral core, the recipes, the deterministic scenarios, and both renderers.

Exports: `./core` `./policy` `./recipes` `./adapters` `./fixtures` `./scenarios` `./harness`
`./native` `./tokens` `./package.json`.

Core contracts: `ExperienceFrame` `SceneState` `SurfaceState` `SurfacePresentation`
`SurfaceEmphasis` `SurfaceInteraction` `Transition` `SurfaceMotionIntent` `MapSceneState`
`MapMode` `ShellIntent` `ExperienceCommand` `SurfaceManager` (reducer), back semantics,
occlusion semantics.

**`core/`, `recipes/` and `adapters/` must remain free of React Native and DOM.** This is
enforceable and currently holds — grep them for `react-native` and expect zero hits. `native/`
may import `@lime/ui`; `core/` may not.

---

## 3. Architectural findings — read these first

These are the expensive discoveries. They are not obvious from the code.

**1. Production `/` renders nothing.** `src/app/page.tsx` returns `null`. The ride flow is
mounted by the *root layout* (`src/app/layout.tsx` → `LimeCabShell`) so a half-chosen
destination survives a trip to another tab. **The shell is the application.** `/driver` is
likewise one persistent spatial workspace, not a stack of screens. Native already models this;
do not turn workflow states into Expo Router routes.

**2. Production composes four surfaces, not one.**
`src/components/limecab/surfaces.ts`:

```ts
export type LimeCabSurfaceId = "map" | "primary" | "search" | "interrupt";
```

`driver-surfaces.ts` uses `"map" | "primary" | "offer" | "interrupt"`. Rider declares **26**
named SurfaceManager actions, driver **38**. Native originally collapsed all of this into one
surface, which is why pin-drop and search-over-a-suspended-task were impossible. The native
renderer now composes N surfaces.

**3. The map is a surface, not scenery.** `chooseOnMap` sets
`map: { emphasis: "primary", interaction: "active" }` and drops the sheet to `peek`. A renderer
that draws the map behind `pointerEvents: none` cannot express that composition at all. Native
must let the canvas take gestures when the contract says it is the subject — even while the map
implementation is a mock.

**4. Search is a peer surface.** `openDestinationSearch` moves three surfaces at once —
`search: primary/fullscreen`, `primary: hidden`, `map: background/locating` — and the world
stays mounted. It is not a scene swap inside the sheet.

**5. Suspended surfaces are not destroyed.** `addRideStop` suspends the ride sheet; `resumeRide`
restores it. Production is explicit that "the parent is never unmounted, so drafts, scroll, and
map state survive". The reducer preserves `presentation` when emphasis becomes `suspended` and
clears it only for `hidden` — that difference *is* the identity mechanism.

**6. Interrupts are independent surfaces** that layer over existing work rather than replacing
it.

**7. Map posture is deliberately *not* in `SurfaceState.presentation`.** Production stores
`bounded/locating/dispatch/route/tracking/trip/receipt` there because its presentation type is
`string | null`. Our contract separates the two: emphasis and interaction describe the surface,
`MapSceneState.mode` describes what the canvas is drawing. `RIDE_MAP_MODE` maps production's
posture names onto `MapMode` 1:1. **Ours is the better shape — do not "fix" it back.**

---

## 4. Current implementation status

### Native app — `apps/lime-native`

```
app/_layout.tsx      providers: GestureHandlerRootView, SafeAreaProvider, theme, Stack
app/index.tsx        Rider/Driver chooser — the only real navigation boundary
app/rider.tsx        Rider context
app/driver.tsx       Driver context
src/useSurfaceRuntime.ts   scenario + SurfaceManager wiring
src/theme-choice.tsx       dev: light/dark/system cycle
src/DevBar.tsx             dev: back + theme controls
```

The app stays runtime and composition only. Reusable implementation belongs in packages. If
reusable logic starts accumulating here, that is a defect.

### Native renderer — `packages/lime-interaction-system/src/native/`

```
NativeSceneRenderer.tsx  composes N surfaces, painter-ordered by emphasis
NativeSurface.tsx        the sheet engine: extents, ladder, gestures, scroll arbitration
NativeMapSurface.tsx     the world as a surface; tap → coordinate
NativeMapRenderer.tsx    mock canvas consuming real MapSceneState
NativeShell.tsx          ShellIntent chrome + status bar
registry.tsx             SurfaceId → component + chrome (surface | canvas)
extents.ts               native extent policy
motion.ts                native motion policy
snap.ts                  gesture → semantic snap destination
useInteractionBack.ts    back boundary
useNativeEnvironment.ts  device → PresentationEnvironment
scenes/{rider,driver,search}.tsx   native scene content
```

### Environment — both of these will waste your time if you do not know them

**Xcode is installed as `/Applications/Xcode-beta.app`.** Global `xcode-select` still points at
`/Library/Developer/CommandLineTools`, so a bare `xcodebuild` errors and `xcrun simctl` is
unavailable. That is *not* Xcode being absent. Prefix simulator and native commands:

```
DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer
```

**Watchman is installed** (2026.07.27, fsevents) and all three roots are registered:
`apps/lime-native`, `packages/lime-ui`, `packages/lime-interaction-system`. Edits under the
symlinked `watchFolders` now hot-reload without restarting Metro — verified end to end by editing
a package file with the app running and seeing the change on device. The old workflow of
restarting with `--clear` after every package edit is no longer needed.

One Metro gotcha survives: `pkill -f "expo start"` does **not** reliably kill it. Check
`lsof -nP -iTCP:8099 -sTCP:LISTEN` and `kill -9` the pid, or the next start silently attaches to
the old server and serves old bytes.

Touch input for validation comes from `idb` (`idb ui tap|swipe|text|key`, `idb ui describe-all`).
It needs `idb_companion` running: `idb_companion --udid <device>` then `idb connect localhost <port>`.
The `idb` CLI looks for the companion at `/usr/local/bin/idb_companion`, which is the Intel
Homebrew path — on Apple Silicon start the companion manually rather than relying on autolaunch.

---

## 5. Native-only bugs already found — do not repeat

Every one of these passed typecheck and passed under react-native-web. Only the device caught
them. **"It compiles" and "it works on Expo Web" are not evidence of native correctness.**

**1. Animation descriptors are not numbers.**

```tsx
// WRONG — inside a worklet, animate() returns a descriptor object
{ translateY: animate(resting, motion) + drag.value }
// → Transform with key of "translateY" must be number or a percentage.
//   Passed value: {"translateY":"[object Object]0"}
```

Compose separate transform entries instead; transforms stack.

**2. Pure functions cannot be called from the UI runtime.** `resolveSnap` and `fromScreen` are
ordinary functions — deliberately, so the maths stays headlessly testable. Calling one inside a
worklet throws `[Worklets] Tried to synchronously call a Remote Function`. Both now route
through `runOnJS`; neither needs to be on the UI thread, since each runs once per gesture at
release. **This bug was made twice in one session** — check every `Gesture.*` callback.

**3. Velocity was lost on release.** A thrown sheet restarted from rest instead of continuing.
`animate()` now takes an optional velocity and the drag settle passes it.

**4. Spring configuration form.** Expo's animation guidance is explicit: use Apple's two
designer parameters (`duration` + `dampingRatio`), not mass/stiffness/damping. Motion policy was
rewritten against its table.

**5. Deprecated `pointerEvents` prop.** RN 0.86 wants it in `style`, not as a prop. Four sites
moved.

**6. Live driver Back destroyed accepted jobs.** `driverBack` had no live-work branch, so Back
mid-job resolved to `delegate-to-host` and the navigator popped the route out from under the
job. `driverLiveBack` was added — it resolves to `minimize-live-work`, and has no
`delegate-to-host` at all, because while a job is live there is nowhere to go back *to*.
**Two regression tests guard this. Preserve them.**

**7. RN silently drops unknown style keys.** `paddingHorizontal`, `marginVertical` and friends
are RN-only; DOM drops them without a warning, so the web adapter must translate them. There is
a contract check for this. The same class of bug: React DOM treats numeric `lineHeight` as a
*multiple*, RN as px — a 48px line box rendered 48 lines down the page.

---

## 6. Expo skill findings

Official Expo skills were consulted (`claude plugin install expo@claude-plugins-official`).
Conclusions, including where we deliberately diverge:

**`@expo/ui` `BottomSheet` — recommended by Expo, intentionally not adopted.** Its guidance says
to prefer it over Reanimated for sheets, and that is right for a typical app. It is wrong here:
it owns its own `snapPoints` and its own open/closed state, which is exactly the "generic bottom
sheet whose state is independent of Lime's interaction model" this project forbids. It also
cannot express four coexisting surfaces, `suspended`, or `launcher`. The native renderer uses
platform-native mechanics; **SurfaceManager stays authoritative.**

**`expo-dom` — not the migration architecture.** Its own skill rules it out: avoid when native
performance matters, and `_layout` files cannot be DOM components. A WebView renderer would
defeat the point. Possible narrow future exception: a web-only visualisation such as driver
earnings charts.

**`react-native-keyboard-controller` — not needed yet.** `useNativeEnvironment` already projects
keyboard height into the extent and occlusion policy. Revisit if a docked CTA must track the
keyboard frame by frame.

**Adopted from `expo-animation`:** spring parameter form, velocity handoff on interruption,
reduced motion shipping with the animation rather than after it.

---

## 7. Multi-surface status — what is proven on device

All four surface roles have been exercised on an iPhone 17 Pro simulator with zero JS errors.

| Surface | Proven |
|---|---|
| **map** | persistent world; `emphasis: primary, interaction: active` takes taps; tap → coordinate → semantic action |
| **primary** | extent ladder, drag with velocity, scroll↔sheet arbitration, CTA dock |
| **secondary** | fullscreen destination search over a hidden primary, world still mounted |
| **interrupt** | driver offer as `sheet` over a suspended duty sheet; return restores it |

Destination search, fixture-backed, currently behaves as:

```
tap "Where to?" → openSearch      secondary fullscreen, primary hidden, map mounted
                → autoFocus       keyboard raises on mount
                → type            filters deterministic place fixtures
                → results         source-differentiated (saved ★ / recent ◷ / searched ◎)
                → no match        empty state, not a blank list
                → select          placeSelected: search hidden, map → route, options rise
Back with search open → dismiss-transient — closes the surface, does NOT rewind the step
```

That last line is intended parity: the rider has not progressed anywhere, they stopped asking a
question.

---

## 8. Fixture / adapter strategy

**Fixtures substitute for infrastructure. Fixtures do not substitute for UX semantics.**

Do not simplify a UI because its data is mocked. Do not invent search semantics production does
not have.

The place-search port (`adapters/places.ts`) exposes only what a search UI needs:

```ts
interface PlaceSuggestion { id; address; context?; latitude?; longitude?; source? }
interface PlaceSearchAdapter { search(query: string): Promise<PlaceSuggestion[]> }
```

Ranking, coverage, geocoding internals, place-intent classification and server enrichment stay
outside the scene contract. An empty query is not an empty result — it is the saved-and-recent
resting state, as production.

Replacement path: `fixturePlaceSearch` → a production geocoding adapter, with **no change** to
scene interaction, surface choreography, native renderer, or contracts.

Apply the same strategy to saved/recent places, quotes, driver offers, PIN, ratings, tips,
receipts and earnings during this phase.

---

## 9. Parity target — Ride only

**Rider:** production Ride functionality under `/`. Do **not** port Shop, Spaces, Station,
Reserve, Assist or Help — 6 of production's 15 rider scenes.

**Driver:** production Ride-driver functionality under `/driver`. Do **not** expand into
freight, courier, shop or help unless a shared primitive is genuinely required by Ride.

Goal: validate both sides of one marketplace interaction — Rider Ride ↕ Driver Ride — before
adding vertical breadth.

> **Correction to the brief:** `configure` is *not* part of the default Ride flow. Production
> comments it as "Courier and Reserve both stop here; default Home rides skip it." It is out of
> scope for Ride-only parity. Listed here because the original task brief included it.

---

## 10. Rider parity goals

Production's ride states, from `LIMECAB_SCENE_SURFACES`, with their surface postures:

| State | map | primary |
|---|---|---|
| `home` | background / bounded | primary / sheet |
| `location_search` | background / locating | hidden (search fullscreen) |
| `location_pin` | **primary / locating / active** | primary / peek |
| `service_select` | background / route | primary / expanded |
| `confirm_pickup` | **primary / locating / active** | primary / sheet |
| `quote` | background / route | primary / sheet |
| `matching` | background / dispatch / active | primary / sheet |
| `assigned` | background / tracking / active | primary / sheet |
| `provider_en_route` | background / tracking / active | primary / sheet |
| `active` | background / trip / active | primary / **expanded** |
| `completing` | background / trip | primary / sheet |
| `complete` | background / receipt | primary / expanded |

Also preserve: saved and recent places, map selection, pickup-point selection, back semantics,
search dismissal, interruption handling, surface persistence, CTA docking, map reframing on
occlusion, keyboard behaviour, scroll behaviour, PIN, rating, tip, receipt.

**Current native rider scenario has 7 steps** (`home rideSelect confirmPickup quote matching
assigned complete`) against production's 12 ride states. Extending it is Rider parity work —
`location_search` is a surface state rather than a step, so it does not appear in the order.

---

## 11. Driver parity goals

Production duty states (`DRIVER_SCENE_SURFACES`): `offline` `online` `to_pickup` `at_pickup`
`on_trip` `complete`.

Notable compositions:

- `offline` → `HOME`: map background/idle/passive, **primary `launcher`** — "off duty is a
  *home*, not a dimmer version of the dash… the driver is reading a document with a live map
  card in it, so `primary` is the page itself."
- `online` → `IDLE`: **map primary/idle/active**, primary `peek` — "the map is the app, the peek
  is a status line. The canvas takes gestures — a hunting driver looks around."
- offer → `OFFER_UP`: `offer: { emphasis: "interrupt", presentation: "sheet" }`, primary
  suspended, map background/tracking/passive.

> **Correction to the brief:** the driver offer is **not** `compact-interrupt`. Production uses
> `presentation: "sheet"` with `emphasis: "interrupt"`. Native was corrected to match. The brief
> said compact-interrupt; production is the specification.

Also preserve: operational shell, live-work persistence, live-job Back protection, CTA
progression, duty state, map/work coordination, completion transition.

---

## 12. Surface parity goals

**Presentations (7):** `peek` `sheet` `expanded` `overlay` `fullscreen` `compact-interrupt`
`launcher`.

> `launcher` was added to the contract during this work. It is a genuine missing semantic, not a
> convenience: the surface *is* the page with the canvas reduced to a card inside it. Distinct
> from `fullscreen`, which covers a canvas still conceptually behind it. The brief lists six
> presentations; there are seven.

**Emphasis (5):** `primary` `background` `suspended` `interrupt` `hidden`.
**Interaction (3):** `active` `passive` `inert`.

These are semantic, not six static heights. Required behaviours: drag up, drag down, snap,
expand, collapse, minimize, restore, interrupt, return, suspended primary, independent
secondary, independent interrupt, map occlusion, map camera response, CTA docking, scrolling
body, safe areas, keyboard.

**The ladder is product semantics.** From `service-sheet.tsx`:

```
SNAP_POINTS = [peek .22, sheet .40, expanded .60, overlay 1]
snapPoints  = onDismiss && presentation !== "peek" ? [0, ...points] : points
```

Three rules carried into `native/snap.ts` and covered by 12 tests: any sheet can be dragged to
any rung; **a peek never dismisses**; dismissal exists only where the caller gave it meaning.
The *fractions* are native policy and deliberately differ from web's.

---

## 13. Surface recipe strategy

```
recipe        semantic surface choreography      → @lime/interaction-system/recipes
scenario      deterministic sequence + data      → .../scenarios
renderer      physical web/native execution      → .../web, .../native
business      product/server state               → outside the renderer entirely
```

Recipes live in `recipes/`, **not** `scenarios/`.

> **Naming collision to be aware of:** `recipes/web/motion.ts` and
> `recipes/web-mobile/surface-extents.ts` pre-date this work and are *renderer policy*, not
> semantic choreography. Two meanings of "recipe" now share one folder. Consider moving the
> renderer-policy ones under `recipes/policy/` — not done yet, flagged deliberately.

**Extract by de-duplication, not transcription.** Production's 64 named actions collapse to ~14
distinct compositions, because most differ only in which product question is asked, never in how
the surfaces sit. `openDestinationSearch`, `openPickupSearch`, `openShopSearch`,
`openAssistSearch` and `openVoiceBooking` are one recipe asked five times. `openDetails`,
`interruptCancel`, `openTravelShare` and `openForTheWay` are all `askQuestion`.

Current compositions in `recipes/surfaces.ts`: `restingTask` `openSearch` `searchResolved`
`chooseOnMap` `confirmOnMap` `committing` `expandTask` `launcher` `askQuestion` `offerArriving`
`interruptFullscreen` `interruptOverlay` `interruptWithSearch` `dismissInterrupt`
`minimizeLiveWork` `restoreLiveWork` `worldOnly`.

Product names live in `recipes/ride.ts` as two `SurfaceManagerConfig`s — `rideSurfaces` (17
actions) and `driverRideSurfaces` (12) — because rider and driver share the kit, not the
choreography.

---

## 14. Surface progress / async choreography — the next major goal

Production runs multi-phase transitions through `surface-progress.ts`: exit (220ms) →
interstitial (80ms) → enter (220ms), with a lock, and the async task running *concurrently* with
the choreography so the animation covers latency rather than following it. Failure reverses to
the origin surface with selections intact.

`surface-progress.ts` **is already extracted into core and is currently unused by native.**
Wiring it is the next implementation goal.

`requestRide` is the reference case: the quote leaves immediately and the canvas takes over
while dispatch runs — "no 'Requesting…' pinned to a dead screen". Do not implement this as *old
card disappears → new card appears*.

The choreography stays semantic and renderer-neutral at the core/recipe level; native motion
policy executes it with Reanimated.

---

## 15. Motion principles

Transition intent owns *what* changed; native motion policy owns *how* it moves. Intents:
`progress` `interrupt` `return` `expand` `collapse`.

Current native policy (`native/motion.ts`), using Apple's parameters per Expo guidance:

| Intent | Config | Why |
|---|---|---|
| `progress` | spring 400 / 1.0 | settled, no overshoot competing with new content |
| `interrupt` | spring 300 / 0.8 | lands before the eye finishes travelling |
| `return` | timing 180 | quicker than the arrival it undoes |
| `expand` | spring 400 / 0.8 | deliberate, slight follow-through |
| `collapse` | timing 200 | |

Do not give every intent the same curve. Preserve velocity on gesture-driven motion. Respect
reduced motion, safe areas, keyboard, orientation and font scale. **Never move physical timing
constants into platform-neutral core** — web and native must be free to disagree.

---

## 16. Map / surface coordination

> Map represents **where**. Surface represents **what is happening now**. CTA represents **what
> can happen next**. Motion explains **how the state changed**.

The map may stay mock-backed this phase, but it must consume the real `MapSceneState` and
respond to modes `home` `select_location` `coverage` `route_preview` `provider_arrival`
`active_route` `results`, and camera intents `fit` `follow` `center` `preserve`.

Camera framing runs through the shared `render/camera.ts` (`resolveCamera` / `toScreen` /
`fromScreen`), the same maths the web renderer uses, against insets from `resolveOcclusion` with
the **native** extent policy. `NativeMapRenderer` implements `MapRenderer<ReactNode>` — swapping
in Mapbox means replacing that file, not rewiring the contract.

Do not duplicate map state inside rider/driver scenes. Do not let a scene render its own route
geometry.

---

## 17. `@lime/ui` gap list

| Candidate | Classification | Note |
|---|---|---|
| `LiveMetric` — two-digit tile on accent | **[PORTABLE]** | Signature Lime element. Generalize the name (a metric tile, not an ETA). |
| `LiveSheetHeader` slots: `chip`, `metric`, `trailing` | **[PORTABLE]** | Ours has eyebrow/headline/supporting only |
| `LiveSheetIdentity` / `LiveSheetDock` | **[PORTABLE]** | An identity row and an action dock are generic compositions |
| `LocationTrigger` `start`/`end` slots + `size` | **[PORTABLE]** | Production puts a voice mic in `end` |
| Sectioned selectable list (title + rows/chips) | **[PORTABLE]** | Saved, Recent, Airport, Nearby all use it |
| `Switch` | **[PORTABLE]** | No toggle primitive exists |
| Options / field list | **[PORTABLE]** | Generic form-in-sheet |
| `TripPill` | **[PRODUCT COMPOSITION]** | Ride-specific as named. The *generic* half is a floating status pill; the minimize affordance belongs to interaction-system. Generalize before promoting, or leave it out. |

Map markers (`FixedMarker` kinds and sizes) are **map-renderer** concerns, not kit primitives.

Be sceptical of product-specific names. Portable library quality matters more than reducing the
app's file count.

---

## 18. Native renderer responsibilities

**Owns:** physical surface layout, extent policy, Reanimated execution, Gesture Handler,
ScrollView coordination, safe areas, keyboard response, platform accessibility, status bar,
the native map renderer, and the physical connection from a back gesture to the shared resolver.

**Must not own:** rider state, driver state, ride domain transitions, offer business state,
quote logic, server state, or any hidden product-specific surface state machine.

**Local ephemeral state is fine:** translation, velocity, measured height, gesture progress,
keyboard offset, animation progress.

The test that keeps this honest: grep `NativeSurface.tsx`, `NativeSceneRenderer.tsx`,
`NativeMapSurface.tsx` and `registry.tsx` for `rider|driver|freight` and expect zero hits
outside comments. It currently passes.

The registry is what keeps the renderer free of surface names: it declares a surface's *chrome*
(`surface` | `canvas`), so the scene renderer never asks "is this the map?".

---

## 19. Surface identity

Where the interaction model says a surface persists, native must not remount it.
`quote → request → matching → assigned` should read as one evolving surface, not four cards
being swapped.

The mechanism is the reducer: suspending preserves `presentation`, hiding clears it. Two tests
cover this. Surfaces are keyed by `SurfaceId`, so the surface component persists across scene
changes while its content reconciles.

If continuity is impossible with the current renderer structure, **fix the renderer** — do not
paper over it with matching animations.

---

## 20. Back / navigation

```
native hardware / navigation gesture
        ↓
shared interaction back resolver → BackDisposition
        ↓
handled → interaction state changes, navigation stays put
unhandled (delegate-to-host) → the host may pop a route
```

Dispositions: `dismiss-transient` `return-interrupt` `regress-scene` `minimize-live-work`
`exit-product` `delegate-to-host` `consume`.

Rules that are product meaning, not implementation detail:

- **Rider home is a deliberate no-op** (`consume`). Turning it into a route pop is a regression.
- **A live driver job resolves to `minimize-live-work`**, never `delegate-to-host`. Regression
  tested.
- **An open search surface resolves to `dismiss-transient`** — it closes without rewinding the
  rider's step.

Workflow states must never become Expo Router routes.

---

## 21. Validation strategy

Production web is the reference corpus. For each canonical state:

1. Drive production web into the state.
2. Record active surfaces, and each one's role / emphasis / presentation / interaction.
3. Record map mode and camera intent.
4. Record the CTA and the transitions in and out.
5. Drive native into the equivalent state.
6. Validate on the iOS Simulator.
7. Compare **interaction first, then composition, then cosmetics.**
8. Fix the discrepancy at the lowest reusable layer that owns it.

**Actual iOS runtime is authoritative.** Expo Web is a secondary regression surface only — it
has passed clean on every native-only bug listed in §5.

---

## 22. Build and test requirements

Keep green:

```
packages/lime-ui                 pnpm typecheck && pnpm contract
packages/lime-interaction-system pnpm typecheck && pnpm test && pnpm build-storybook
apps/lime-native                 npx tsc --noEmit
                                 npx expo export --platform ios     (Metro resolution + bundle)
                                 iOS runtime, zero JS errors
production web                   unchanged
```

**State as of 2026-09-01:** all typechecks green; **64** interaction-system tests passing;
`@lime/ui` contract green (29 shared files, 6 adapter exports); Storybook builds; iOS bundle
exports; device runtime zero JS errors.

The `@lime/ui` contract check is load-bearing — it asserts no DOM tags and no forbidden imports
in shared components, that both platform adapters export the same names, and that no RN-only
style key goes untranslated on web.

Sourcemap evidence that Metro resolution is correct (re-run if resolution is ever in doubt):
`platform/native.tsx` present, `platform/web.tsx` absent, `packages/*/node_modules` zero, one
React entrypoint, `/src/web/` absent from the native bundle.

---

## 23. Deferred integrations

Production backend adapter, auth, payments, payouts, production Mapbox, push, background GPS,
real driver tracking, camera, document upload, production geocoding, freight, courier, shop,
assist, reserve, spaces, station, help, ELD/HOS, and broad operational verticals.

Native UX may still represent server-shaped states using deterministic fixture adapters.

---

## 24. Next implementation order

Ordered by architectural leverage, not chronology. Do not reorder without a stronger reason from
current code.

1. ~~Complete multi-surface native renderer~~ — **done**
2. ~~Reusable recipe extraction~~ — **done for Ride**; verticals remain unextracted
3. ~~Wire `surface-progress` / async choreography~~ — **done**; drives `requestRide`, 9 tests
4. ~~Fill truly portable `@lime/ui` gaps (§17)~~ — **done**; all 7, contract now 34 shared files
5. ~~Rider search parity~~ — **done** (fixture-backed); `configure` is out of scope, see §9
6. ~~Rider confirm-pickup parity~~ — **done**; map-as-subject, curb list, camera centres on the pickup
7. **Rider request / matching / assigned depth** ← next; first consumer of `LiveMetric` / `LiveSheetIdentity` / `LiveSheetDock`
8. Rider pickup / PIN / in-ride parity
9. Rider complete / rating / tip / receipt parity
10. Driver duty parity
11. Driver offer parity
12. Driver accepted-job / pickup / PIN parity
13. Driver active-trip / completion / earnings parity
14. Full Rider/Driver screenshot and interaction comparison
15. Clean separation of Lime vs LimeDriver application roots
16. **Only then** begin real server-state adapter integration

Do not add backend integration merely because fixture parity is working.

---

## 25. Success conditions

- [ ] `@lime/ui` remains portable to unrelated Expo apps
- [ ] `@lime/interaction-system` core and recipes remain renderer-independent
- [ ] production `/` substantially reproduced as native Lime from shared semantics
- [ ] production `/driver` substantially reproduced as native LimeDriver from shared semantics
- [ ] both render from the same interaction grammar as web
- [x] native supports multi-surface composition
- [x] map is a genuine semantic surface
- [x] search is a genuine secondary surface
- [x] interrupts coexist with persistent work
- [x] suspend/restore works
- [x] minimize/restore works
- [x] Back semantics match product meaning
- [ ] surface-progress choreography has native parity
- [x] native gestures resolve into shared semantic actions
- [x] no second native product-state machine exists
- [x] no rider/driver conditionals in generic `NativeSurface`
- [ ] fixture adapters replaceable by production services without rewriting scenes or renderers
- [ ] iOS runtime feels like the same Lime product, not a generic RN approximation

---

## 26. Doctrine

1. Production web is the UX/UI behavioural specification.
2. Reproduce observable behaviour, not production implementation details.
3. Shared semantics are authoritative.
4. Web and native are renderers of the same product grammar.
5. Fixtures replace infrastructure, not interaction meaning.
6. The map is persistent world state, not decorative scenery.
7. Surfaces explain the user's current situation.
8. The CTA expresses the next legal action.
9. Motion communicates semantic change.
10. Native should feel native without becoming a different product.
11. Fix parity gaps at the lowest reusable layer that actually owns them.
12. Do not solve parity by duplicating product logic inside the Expo app.
13. Complete Ride Rider + Ride Driver before expanding into verticals.
14. Backend integration comes after UX parity proves the reusable system.

**And one earned the hard way:** verify by running, on a device. A clean typecheck and a clean
Expo Web pass proved nothing about any of the seven native-only bugs in §5.
