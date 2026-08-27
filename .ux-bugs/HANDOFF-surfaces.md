# Handoff: surfaces, sheet actions, ride minimize, map, payments

For the next Claude (or Cursor) session. Fix the UX; do not repeat the
measurement / portal stack described below.

Read first: `.claude/skills/surface-orchestration/SKILL.md`,
`.claude/skills/adaptive-surfaces/SKILL.md`,
`.claude/skills/scene-preparation/SKILL.md`. Named surface actions only.
Do not choreograph drawers, map insets, and footers with independent setters.

---

## Target composition (mobile task)

Z-order, top to bottom of the *screen*:

```
[ destination bar ]          overlay, top of canvas, does not shrink the map
[ map  — full bleed ]        canvas UNDER the sheet (sheet covers the lower map)
[ sheet                      overlay, thumb zone
    [ main sheet content ]   scrolls
    [ action band ]          constrained, optional, pinned to visible sheet bottom
]
```

The map is the background. The sheet floats on it. Camera padding (not a
resized map box) keeps the car / route visible in the gap between the
destination bar and the sheet.

Home stays a sibling column (rounded map *card* + launcher). This target is
`layout="task"` only.

---

## What was attempted (do not redo)

A sequence of local fixes fought the Base UI snap drawer (`height: 100dvh`,
translated down so only 40%/60% is on screen).

1. **Sheet height from content** — comparison/status scenes measured their
   body and sprang to ~full screen, swallowing the map. Replaced with a
   fixed ladder: peek 22% / sheet 40% / expanded 60%. Taller work is a
   `TaskScene` overlay. Keep this ladder.

2. **Map inset to “sit above the sheet”** —
   `bottom-[var(--map-overlay-bottom)]` on the map slot, fed by
   `publishMapOverlay()` measuring the drawer’s visible height. This made
   Mapbox `resize()` + `fitBounds` on every snap, every SheetActions mount,
   and every rAF overlay ping. Jank. The rider now wants the inverse: map
   *under* the sheet, padding only.

3. **Don’t curve the map** — task map is square (`rounded-none`). Home map
   card may stay `rounded-3xl`. Keep that.

4. **SheetActions portal** — confirm / payment ribbon portal into an
   absolute host at the bottom of a JS-measured “visible slice”
   (`getBoundingClientRect` of the transformed popup minus handle). First
   paint: host null. Snap drawers: footer landed at y≈967 on an 844 screen
   (below the fold) because the flex column filled 100dvh. Progressive
   disclosure then mounts the portal, overlay height changes, map resizes
   again. Coordinator load-up feels like the sheet and the button arriving
   on different frames.

5. **Progressive disclosure (keep the idea, drop the machinery)** —
   Choose a ride: no confirm until a tier is tapped; then a short band
   (payment ribbon + Confirm). Courier “See price” waits until the form is
   ready. Quote / pin / done still show their action immediately. Cap:
   ribbon + one primary, `max-h-[9.5rem]`. Keep this product rule.

6. **Follow-cam + road-following polyline** — working. Don’t regress.
   Directions must send `Referer` (`mapbox-request.ts`). Flat mercator,
   `pitch={0}`.

7. **Trip pill** — already exists off Home (`LimeCabTripPill`,
   `minimized={!onHome}` in `limecab-shell.tsx`). Clicking it `router.push("/")`.
   There is **no** way to minimize while staying on `/`. MapRouteBar back is
   hidden once the request is committed (`canReviseRoute` is only
   service_select / configure / quote). `backServiceAppState` is a no-op on
   matching/assigned/active by design (leaving a live request is cancel, not
   back).

---

## Work to do

### 1. Kill coordinator jank (P0)

Stop measuring and stop portaling.

- Map slot in task layout: `absolute inset-0` (under the sheet). No
  `--map-overlay-bottom` driving the map *box*.
- Drive Mapbox padding from the **known snap fractions** (and destination-bar
  height), published as CSS vars or constants — not from
  `getBoundingClientRect` of a translating drawer.
- Sheet body: one flex column sized to the snap (CSS
  `h-[calc(var(--snap)*100dvh)]` or the drawer’s own snap height). Scroll
  region `flex-1`; action band `shrink-0` in normal flow. If the snap drawer
  must stay 100dvh+translate, pin the action band with
  `position: sticky; bottom: var(--drawer-snap-point-offset, 0px)` inside the
  **visible** scrollport — still no portal, no JS height on a wrapper.
- `SheetActions` is just that footer. Omit it until there is something to
  confirm (progressive disclosure). When it appears, it must not resize the
  map container.
- One named action per user gesture (`surfaces.perform(...)`). Scene reducer
  still owns the step; SurfaceManager owns posture; the sheet does not
  subscribe to overlay pings to size itself.

Files: `service-sheet.tsx`, `service-app-shell.tsx`, `map-overlay.ts`,
`mapbox-canvas.tsx` (`readMapPadding`), `surfaces.ts`.

### 2. Minimize a live ride from Home (P0)

When the rider is in matching / assigned / en route / active / completing:

- **Always show Back** on the destination bar (and/or a chrome control).
- Back does **not** `go("back")` and does **not** cancel.
- Back is `surfaces.perform("minimizeRide")`: keep the ride mounted, hide
  the sheet (and task chrome), restore Home launcher + tab bar, collapse
  the live ride to `LimeCabTripPill`.
- Pill tap is `surfaces.perform("restoreRide")` (or existing `/` navigation
  when they left via Activity). Same scene, same trip, sheet returns.
- Classify: this is **not** an interruption (parent is not a question they
  return to mid-field) and **not** progression. It is a surface emphasis
  change: primary sheet → hidden/peek-as-pill, map → home bounded, chrome
  returns. Add `minimizeRide` / `restoreRide` to `surfaces.ts`. Do not add a
  new `ServiceAppState`.

`limecab-shell.tsx` already treats `scene !== "home"` as `inTask` and hides
tabs. Minimized-on-Home must look like Home (tabs + launcher) with the pill
over it. Today `minimized` is only `!onHome`.

### 3. Recenter / “I’m here” (P1)

A control on the **map overlay**, between the destination bar and the sheet
(not inside the sheet). Recenter the pickup on the device location (the
same path home map tap / geolocation already uses). Do not open search.
Name it (`recenterPickup` / `chooseOnMap` only if they are actually
re-pinning). Keep it out of the sheet action band.

### 4. Payments as a full overlay (P1)

Today payment is `openDetails` → `compact-interrupt` (`LimeCabDetailSurface`,
a short list of mock methods, no add action).

Target: a **fullscreen overlay** (`TaskScene` / search-class surface), not a
compact interrupt.

- Lists current methods.
- Constrained action at the bottom: **Add payment method**.
- Selecting a method returns (`intent: "return"`) to the suspended ride
  sheet with the choice intact.
- Adding a card can be honest-empty in this build (profile copy already
  says it isn’t live) but the affordance must exist.

Do not reuse compact-interrupt for this. Search already proves the
fullscreen overlay pattern.

### 5. Other UX Claude should fix while in here

- **Mapbox logo / attribution overlapping the sheet** — if the map is full
  bleed under the sheet, attribution sits under the sheet; move it or pad
  so it isn’t on the Confirm button.
- **Home → task map morph** — avoid a frame where the sheet is empty and
  the action host is empty:hidden, then content pops. Prepare the next
  scene before the snap (scene-preparation).
- **Peek during `active`** is so short the driver card is unusable; either
  keep peek as status-only (tap sheet / pill to expand) or don’t put the
  card in peek.
- **Cancel vs minimize** — Cancel stays an interruption
  (`interruptCancel`). Minimize is the new Back on live rides. Don’t merge
  them.
- **Quote payment row vs ride-select ribbon** — quote still has Payment +
  Promo in the scrolling body; ride-select discloses a ribbon. After the
  payment overlay exists, the ribbon is only a summary that opens that
  overlay.
- **Verify in the browser** at 390×844: choose a ride (band appears, stays
  on screen), confirm, live ride Back → Home + pill, pill restores sheet,
  map visible in the gap, recenter, open payments overlay, add-payment
  action visible. Desktop: sheet is a card, map still under/beside it,
  same actions.

---

## Invariants (do not violate)

- One question per scene. Confirm is not a second question; it is the
  answer to the current one, disclosed when the choice exists.
- Interruptions suspend; they do not unmount. Payment overlay is an
  interrupt that happens to be fullscreen.
- Committed ride state is not unwound by Back. Minimize hides; cancel
  confirms.
- Task map is not rounded. Sheet may have `rounded-t-3xl`.
- No globe: mercator, pitch 0.
- No `--token` on Vercel CLI. Prod: `vercel deploy --prod -y --no-wait`.

## Key files

| Concern | File |
|---|---|
| Scene machine / Back | `src/lib/service-app/state.ts` |
| Surface recipes | `src/components/limecab/surfaces.ts` |
| Ride flow | `src/components/limecab/limecab-app.tsx` |
| Shell / pill / tabs | `src/components/limecab/limecab-shell.tsx`, `limecab-trip-pill.tsx` |
| Sheet + actions | `src/components/service-app/service-sheet.tsx` |
| Map slot | `src/components/service-app/service-app-shell.tsx` |
| Overlay CSS vars | `src/components/service-app/map-overlay.ts` |
| Destination bar | `src/components/service-app/map-route-bar.tsx` |
| Payment interrupt | `src/components/limecab/limecab-interrupts.tsx` |
| Ride select band | `src/components/limecab/limecab-ride-select-scene.tsx` |
