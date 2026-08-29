# Handoff: surfaces, sheet actions, ride minimize, map, payments

**Status: all five sections implemented and verified in the browser on
2026-08-27. Working tree is uncommitted.** This file is now a *state* doc, not
a work order. Read "Where it stands" before touching anything, and do not
re-derive the sections under "Do not redo" — they cost a session each.

Read first: `.claude/skills/surface-orchestration/SKILL.md`,
`.claude/skills/adaptive-surfaces/SKILL.md`,
`.claude/skills/scene-preparation/SKILL.md`. Named surface actions only.
Do not choreograph drawers, map insets, and footers with independent setters.

---

## Target composition (mobile task) — achieved

Z-order, top to bottom of the *screen*:

```
[ destination bar ]          overlay, top of canvas, does not shrink the map
[ recenter control ]         overlay, in the gap, pre-commit only
[ map  — full bleed ]        canvas UNDER the sheet (sheet covers the lower map)
[ sheet                      overlay, thumb zone
    [ main sheet content ]   scrolls
    [ action band ]          sticky, optional, at the visible sheet bottom
]
```

The map is the background. The sheet floats on it. Camera padding (not a
resized map box) keeps the car / route visible in the gap between the
destination bar and the sheet.

Home stays a sibling column (rounded map *card* + launcher). This target is
`layout="task"` only.

---

## Where it stands

### 1. Coordinator jank — DONE

The measurement/portal stack is deleted, not patched.

- `map-overlay.ts` rewritten. `publishMapOverlay()` (getBoundingClientRect +
  ResizeObserver on a translating drawer) is **gone**. Now
  `publishSheetSnap(fraction | null)` writes `--sheet-snap` on
  `[data-service-app-shell]` and fires one `limecab:overlay` event per snap
  change. `readMapPadding()` derives camera padding from that fraction.
- Task map slot is `absolute inset-0 md:inset-6` in `service-app-shell.tsx`.
  `--map-overlay-bottom` / `--map-overlay-end` no longer exist. The map box
  never moves when the sheet snaps or when the action band mounts.
- `ServiceSheet` body height is an inline
  `calc(<snap> * 100dvh - 13px)` on mobile (13px = h-3 handle + 1px popup
  border). No ResizeObserver, no `getBoundingClientRect`, no portal, no
  `SheetActionsAnchorContext`.
- `SheetActions` is now a plain footer in normal flow:
  `sticky bottom-0 mt-auto shrink-0 max-h-[9.5rem]`. It sits at the bottom of
  a short sheet and sticks there once the body scrolls.

### 2. Minimize a live ride — DONE

- `minimizeRide` (`intent: "collapse"`) and `restoreRide` (`intent: "expand"`)
  added to `surfaces.ts`. No new `ServiceAppState`.
- `rideMinimized` boolean lives in `LimeCabFlow`. It is a *surface emphasis*
  flag, not a scene — the reducer never hears about it.
- The scene→recipe effect early-returns while minimized, so the server
  advancing `matched → arriving` cannot pop the sheet back up. Un-minimizing
  re-applies the scene recipe, which is what restores the map posture.
- Destination-bar Back: revises while `canReviseRoute`, minimizes once
  committed, absent on `complete`. It never cancels and never unwinds.
- Pill: `LimeCabTripPill` takes an optional `onRestore`. With it, tap restores
  in place; without it (shell, off Home) it still `router.push("/")`.
- Shell callback changed `onSceneChange(state)` → `onTaskChange(inTask)`;
  a minimized ride is not a task, so chrome and tabs come back.
- **Rename:** `LimeCabApp`'s old `minimized` prop is now `standby` ("another
  tab owns the screen"). Two different things were called minimized.

Three guards exist because Home's launcher is live while minimized and the
reducer does *not* guard `select_location` against committed states: the
launcher, the home map tap, and `chooseLocation` all restore the ride instead
of dead-ending or re-routing a committed trip. If you ever add another Home
entry point, guard it too.

### 3. Recenter / "I'm here" — DONE

`RecenterPickupButton` in `limecab-app.tsx`, on the canvas, positioned
`bottom-[calc(var(--sheet-snap,0)*100dvh+1rem)] md:bottom-6`. Geolocation +
`fetchReverseGeocode`, sets pickup with `followsDevice: true`. Does not open
search. Hidden on `isCommitted(state)` — follow-cam owns the camera there.

### 4. Payments as a full overlay — DONE

- `AdaptiveSurface.Interrupt` gained a `presentation="fullscreen"` branch that
  renders `TaskScene` + `TaskSceneHeader`. Suspend/restore is unchanged, so it
  is still an interruption; only the rung changed.
- `LimeCabPaymentSurface` in `limecab-interrupts.tsx`: method list, constrained
  "Add payment method" at the bottom (honest-empty note on tap).
- The `payment` branch is removed from `LimeCabDetailSurface`, along with its
  `paymentId` / `onSelectPayment` props. `openDetail("payment")` performs
  `openPayment`; everything else still performs `openDetails`.

### 5. Other UX — DONE

- Mapbox attribution/logo lifted above the sheet via `--sheet-snap` in
  `globals.css` (mobile only; desktop leaves it bottom-right).
- `active` moved off `peek` to `sheet` in `LIMECAB_SCENE_SURFACES` — a 22%
  strip could not hold the driver card.
- Destination bar gets `md:right-[25rem]` so the full-bleed canvas does not
  run it under the desktop task panel.
- Cancel is still `interruptCancel`. Minimize is separate. Not merged.

---

## Two bugs found in the browser, not in the doc

Both are load-bearing. Do not "simplify" them back.

1. **`--drawer-snap-point-offset` does not inherit.** Base UI registers it as a
   non-inheriting property, so a descendant reads `0px` even though
   `getComputedStyle(popup)` returns the real value. It cannot be forwarded
   through an alias custom property either — inner `var()`s resolve at the use
   site. Also, the popup is **not** `100dvh`: `--drawer-content-max-height` caps
   it at `calc(100dvh - 6rem)`. Any CSS that tries to compute the visible slice
   from the popup's own box is wrong twice over. Size from the known snap
   fraction, which is exactly what section 1 does.
2. **The action band squashed to 23px.** It is a flex item in the scrolling
   column and carries `overflow-y-auto`, which resolves its `min-height: auto`
   to 0. `shrink-0` is what keeps it at its natural height when the body
   overflows. Reproduce by opening `complete` on desktop without it.

---

## Do not redo (from the previous session, still true)

1. **Sheet height from content** — comparison/status scenes measured their body
   and sprang to full screen, swallowing the map. The fixed ladder
   (peek 22% / sheet 40% / expanded 60%) stays. Taller work is a `TaskScene`.
   Overlay is a snap of the same drawer (listed sheets / explicit
   `presentation`), not the overflow destination.
2. **Map inset to "sit above the sheet"** — caused `resize()` + `fitBounds` on
   every snap, every mount, every rAF ping. The map now sits *under* the sheet
   with padding only. Do not reintroduce an inset.
3. **Don't curve the task map.** `rounded-none`. Home map card keeps
   `rounded-3xl`.
4. **No `SheetActions` portal.** First paint had a null host; snap drawers put
   the footer below the fold. Normal flow + sticky solves it.
5. **Progressive disclosure is a product rule, not machinery.** No confirm
   until a tier is tapped; courier "See price" waits for a ready form; quote /
   pin / done show their action immediately. Cap: ribbon + one primary.
6. **Follow-cam + road-following polyline work.** Directions must send
   `Referer` (`mapbox-request.ts`). Flat mercator, `pitch={0}`.

---

## Verified on 2026-08-27

Dev server on **:3001**, Playwright, 390×844 and 1280×860.

Walked: pick destination → tier select (band appears only after a tier is
tapped, lands fully on screen) → payment ribbon → fullscreen overlay → select
method → returns to the suspended sheet with the choice intact → confirm →
request → live ride → destination-bar Back → Home + launcher + tabs + pill,
ride still running → pill tap → same trip, sheet back, car in the gap →
complete → Done. Desktop: sheet is a floating card, map under/beside it, bar
inset from the panel, band pinned in the card.

`npx tsc --noEmit` clean. `next lint` clean (4 pre-existing warnings in
`src/server/**`). `npm test` 77/77.

Console is free of SurfaceManager invariant warnings. Remaining noise is
pre-existing: mapbox worker `si` errors, and one react-map-gl
`Error: layer id changed` from the `limecab-route` ↔ `limecab-route-muted`
swap on a single `<Source>`. That one is a real (small) latent bug if anyone
wants it: give the muted layer the same id, or key the Source.

---

## Known-not-mine, still open

- **`src/lib/limecab/mock.ts` is dirty**: `lime-pool` flipped
  `coming_soon` → `available`. The tree was clean at session start and this
  session never wrote that file. Left alone deliberately — decide whether to
  keep or revert before committing.
- **`npm run build` fails** with `PageNotFoundError` on `/api/map/places`,
  `/driver/profile/*`, `/api/trpc/[trpc]`. It fails identically on a stashed
  (pre-change) tree, so it predates this work and is not a surfaces problem.
  Dev server runs fine. Someone should chase this before shipping.
- **Directions 403 in local dev**: the Mapbox token is URL-restricted and the
  dev server came up on :3001. Routes fall back to a straight line, so the
  road-following polyline could not be re-verified this session. That code is
  untouched. Run on :3000 to see real geometry.

---

## Picking back up

Nothing here is half-finished. The likely next moves, in the order I'd take
them:

1. Decide on `mock.ts`, then commit the working tree. Suggested message:
   "Put the map under the sheet and give a live ride a minimize".
2. Fix the build (`PageNotFoundError`) — unrelated to surfaces, blocks deploy.
3. Verify on :3000 with a valid token that follow-cam and the road polyline
   still look right against the new camera padding
   (`readMapPadding` is the only thing that changed under them).
4. Optional polish, all small:
   - Scenes that wrap `SheetActions` in their own `<div>` (quote, pin,
     configure) don't get the `mt-auto` push, so their band sits under the
     content rather than at the sheet's bottom edge on a short scene. Fix by
     letting those wrappers stretch, not by reintroducing a portal.
   - Home → task morph still has no explicit scene-preparation step. The empty
     frame is much less visible now that the band no longer mounts late, but it
     was never addressed directly.
   - The react-map-gl layer-id warning above.

## Invariants (do not violate)

- One question per scene. Confirm is not a second question; it is the answer to
  the current one, disclosed when the choice exists.
- Interruptions suspend; they do not unmount. The payment overlay is an
  interrupt that happens to be fullscreen.
- Committed ride state is not unwound by Back. Minimize hides; cancel confirms.
- Task map is not rounded. Sheet may have `rounded-t-3xl`.
- No globe: mercator, pitch 0.
- Nothing measures the drawer. The snap fraction is the contract between the
  sheet and the map.
- Overlay is not the overflow destination. Do not redo sheet height from
  content. Inner scroll stays on at rest rungs.
- No `--token` on Vercel CLI. Prod: `vercel deploy --prod -y --no-wait`.

## Key files

| Concern | File |
|---|---|
| Scene machine / Back | `src/lib/service-app/state.ts` |
| Surface recipes + `minimizeRide` / `restoreRide` / `openPayment` | `src/components/limecab/surfaces.ts` |
| Ride flow, minimize state, recenter | `src/components/limecab/limecab-app.tsx` |
| Shell / `onTaskChange` / tabs | `src/components/limecab/limecab-shell.tsx` |
| Pill / `onRestore` | `src/components/limecab/limecab-trip-pill.tsx` |
| Sheet + `SheetActions` | `src/components/service-app/service-sheet.tsx` |
| Map slot (full bleed) | `src/components/service-app/service-app-shell.tsx` |
| Snap → padding contract | `src/components/service-app/map-overlay.ts` |
| Destination bar | `src/components/service-app/map-route-bar.tsx` |
| Fullscreen interrupt branch | `src/components/service-app/adaptive-surface.tsx` |
| Payment overlay / detail surfaces | `src/components/limecab/limecab-interrupts.tsx` |
| Ride select band | `src/components/limecab/limecab-ride-select-scene.tsx` |
| Attribution lift | `src/styles/globals.css` |
