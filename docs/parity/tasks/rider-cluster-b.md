# Dispatch — Rider Cluster B (ride options / confirm pickup / upsell)

## OBJECTIVE
Bring the native rider fare-choice and curb-choice states to parity with production, including
the previously-unknown upsell interrupt between them.

## READ THESE PACKETS
- `docs/parity/rider/ride-options.md`
- `docs/parity/rider/confirm-pickup.md`
- `docs/parity/rider/upsell.md`
- Architecture doctrine: `docs/specs/lime-web-to-native-parity-spec.md`. Read once, do not restate.

## THE TWO FINDINGS THAT DRIVE MOST OF THIS WORK
1. **Selection is inverted.** Production selects a row with a **pale lime fill + black leading
   rule + solid lime circular glyph**. `@lime/ui`'s `ChoiceRow` currently does neutral fill +
   lime rule + rounded-rect glyph. Fix the primitive, not the caller.
2. **These CTAs are dark, not lime.** `Confirm Lime Comfort · $5.71` and `Confirm pickup` are
   `foreground`-ground pills with white labels.

## LIKELY IMPLEMENTATION AREAS
- `packages/lime-ui/src/primitives/choice-list.tsx` — selection treatment, circular glyph,
  badge slot, seat-count affix, small-ring density
- `packages/lime-interaction-system/src/fixtures/` — ride products, pickup spots, add-ons
- `packages/lime-interaction-system/src/scenarios/rider/happy-path.ts` — the upsell step
- `apps/lime-native/` — scene composition and docks

## DO NOT CHANGE
`SurfaceState` · `SurfaceManager` · `ExperienceFrame` · `NativeSceneRenderer` public shape ·
the back resolver · `resolveCamera` · the existing `camera: { intent: "center" }` on
`confirmPickup` · package exports

## EXPECTED OUTPUT
Five ride rows in production order with badges and seat counts; selection reveals a dock with a
payment row and a dark CTA; the upsell interrupt appears over a suspended sheet and `No thanks`
returns to `confirmPickup` untouched; the pickup marker is a lime callout.

## VALIDATION
Same commands and same baselines as `driver-cluster-b.md`.

## STOP CONDITIONS
- `ChoiceRow`'s contract cannot absorb badge/seat-count without breaking existing callers → stop
- The upsell needs a semantic dimension the contract lacks → stop, report. `suspended` + an
  `interrupt` surface should already express it.
- Backdrop blur is a renderer treatment; do not model it as a new emphasis

## CARRIED-OVER MINORS FROM CLUSTER A REVIEW
Not worth their own dispatch; fold them in while you are in these files.
1. `RIDER_VERTICALS` lists 7 services; production shows **9** — append `Spaces` and `Station`.
   (Labels only. The scope rule against porting those *experiences* still stands.)
2. Add-stop accessibility label is `Add a stop`; production's is `Add stop`.
3. Voice control label is `Search with voice`; production's is `Book by voice`.
