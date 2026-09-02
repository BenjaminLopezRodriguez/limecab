# Parity packet — Driver / `offer` (incoming ride offer)

**PROVENANCE:** `[SOURCE-DERIVED]` — every value below is read directly from
`src/components/limecab/driver-scenes.tsx` (`DriverOfferScene`, exact Tailwind values) and
`driver-app.tsx` (timing, accept/decline wiring). **Not observed running.**

**Why not observed:** an offer requires a rider trip that dispatch actually routes to this
driver. On 2026-09-01 I drove production end-to-end as a rider (pin → ride options → confirm →
`matching`) with the driver online and hunting, and no offer landed within the observation
window — the pinned destination did not produce a match for that driver. Reaching it needs a
seeded trip near the driver, or a second real session. `[BLOCKED]` for pixel capture only; the
behavioural spec below is complete and needs no further discovery.

## STATE
`offer` — "the moment the whole app exists for". A 20-second decision over an untouched idle peek.

## ENTRY
Driver is online and hunting; a candidate trip reaches the front of the queue → `offerIncoming`.

## EXIT ACTIONS
- `Accept` → `accepted` (intent `progress`; history clears — there is no going back to an offer)
- Decline (X) → `offerDismissed` (intent `return`; the peek comes back untouched)
- Countdown reaches 0 → identical to decline. **The countdown *is* the decline.**
- Accept that loses the race (CONFLICT) → offer dismissed, reason shown on the idle peek

## REFERENCE
No production web screenshot. Source: `driver-scenes.tsx` `DriverOfferScene` (~line 671).
Native prior art: `.playwright-mcp/ms-05-offer.png`, `n-08-offer.png` (native, not reference).

## SURFACES  (`OFFER_UP` in `driver-surfaces.ts`)
| id | role | emphasis | interaction | presentation |
|---|---|---|---|---|
| map | background | background | passive | posture `tracking` |
| primary | primary | **suspended** | inert | (held — not torn down) |
| offer | interrupt | **interrupt** | active | `sheet` |
| interrupt | interrupt | hidden | inert | — |

`offer` is its own surface, not a rung of `primary`, specifically so it can sit over an untouched
idle peek and leave without a trace. Safety (911) is suppressed while an offer is up.

## MAP
Posture `tracking` (`provider_arrival`), passive. Camera follows the driver.

## CONTENT (exact visual order, exact values from source)
1. **Stack rail** — only when more than one offer is queued:
   - `{n} rides` — 11px medium, uppercase, `tracking-[0.12em]`, muted
   - horizontal scrolling row of fare chips, 13px semibold tabular, pill;
     front chip is lime on lime-foreground, others `bg-card` with a border
2. **Fare** — `52px`, `leading-none`, semibold, `tracking-[-0.04em]`, tabular. The largest type in
   either app. Left side of a space-between row.
3. Right side of that same row: `{secondsLeft}s` — 17px medium muted tabular — then a **ghost icon
   button, 44pt**, `Cancel01` glyph at 20px, label `Decline ride`.
4. **Product line** — 17px medium tabular:
   `{productLabel} · {distanceMiles.toFixed(1)} mi · {tripMinutes} min`
5. **Deadhead** — 19px semibold tabular, **lime**: `{arrivalMinutes} min away`
   (the second decision input: how much unpaid driving comes first)
6. **Route rail** — pickup → destination, `mt-4`
7. **Countdown bar** — `h-2` rounded-full, `bg-muted` track, **lime** fill,
   `width: secondsLeft / totalSeconds * 100%`, `transition-[width] duration-200 ease-linear`,
   `role="timer"`, label `{n} seconds to decide`
8. **CTA**

Decision order is deliberate: fare first, deadhead second, street strings third — that is the
order a driver decides in, in about two seconds.

## CTA
`Accept` — full-width, **`h-16`**, 19px, `mt-3`. Default (lime) button variant.
Busy label: `Taking this ride…`, `aria-busy`, disabled.

## SECONDARY ACTIONS
The X (decline) and the countdown. Accept is the only primary — there is no third action.

## GESTURES
Sheet. The offer must not be draggable to dismiss in a way that races the accept.

## BACK
Not a back target. Decline is explicit.

## KEYBOARD / FOCUS
None. Focus should land on the sheet for announcement; the fare is the headline.

## TRANSITION IN
`interrupt` — lands before the eye arrives.

## TRANSITION OUT
Accept: `progress`. Decline/timeout: `return` — the peek is restored exactly.

## TIMING
- `OFFER_SECONDS = 20`
- ticks every **250ms** (not 1s), so the bar animates smoothly while the label shows whole seconds
- **the timer must never fire while an accept is in flight** (`locked`) — production guards this
  explicitly; "never yank an offer out from under a driver mid-accept"

## FIXTURE DATA REQUIRED
`OfferTrip`: `{ id, totalCents, productId, distanceMiles, tripMinutes, arrivalMinutes,
pickupAddress, destinationAddress }`. Plus a 2–3 entry stack to exercise the rail.
Ride products only — Courier / Shop / Help / Care branches are **out of scope this phase**.

## EXISTING REUSABLE COMPONENTS
`RouteRail` (already ported), `Progress`, `Button`, `Icon` (`Cancel01` is vendored),
`LiveSheetHeader`, the interrupt surface in `NativeSceneRenderer`.

## KNOWN PARITY GAPS
1. No offer scene in the native driver composition — **[APP COMPOSITION]**
2. Offer fixtures + stack absent — **[FIXTURE]**
3. 52px fare has no matching type token — **[@lime/ui]**
4. Countdown must drive off the existing progress runner rather than a second timer —
   **[NATIVE ADAPTATION]**
5. `driverRideSurfaces` has offer actions; verify `offerIncoming` / `offerDismissed` /
   `accepted` match `OFFER_UP` exactly — **[RECIPE]**

## IMPLEMENTATION BOUNDARY
Driver scene composition, fixtures, and at most a type token.
**Do not** change `SurfaceState`, `SurfaceManager`, the back resolver, or the renderer's public
shape. The `offer` surface already exists in the contract.

## STOP CONDITIONS
- If a fourth surface is needed beyond `map` / `primary` / `offer` / `interrupt` → stop, report.
- If the countdown cannot be made to respect the accept lock without a contract change → stop.
- Do **not** implement Courier / Shop / Help / Care offer variants.
