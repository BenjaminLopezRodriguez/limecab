# Dispatch — Driver Cluster B (offer / decline / accept)

## OBJECTIVE
Add the incoming-ride offer to the native driver app: presentation, 20s countdown, decline,
accept, and the transition into accepted work.

## READ THESE PACKETS
- `docs/parity/driver/offer.md` — complete; every value is exact
- `docs/parity/driver/online.md` — the state the offer sits over and returns to
- Architecture doctrine: `docs/specs/lime-web-to-native-parity-spec.md`. Read it once; do not
  restate or re-derive it.

## LIKELY IMPLEMENTATION AREAS
- `packages/lime-interaction-system/src/fixtures/driver.ts` — `OfferTrip` fixtures + a stack
- `packages/lime-interaction-system/src/scenarios/driver/happy-path.ts` — offer step
- `apps/lime-native/` — the offer scene composition
- `packages/lime-ui/src/tokens/typography.ts` — a display token for the 52px fare, if none fits

## DO NOT CHANGE
`SurfaceState` · `SurfaceManager` · `ExperienceFrame` · `NativeSceneRenderer` public shape ·
the back resolver · package exports · `snap.ts` · `motion.ts`

## EXPECTED OUTPUT
The offer renders over an untouched idle peek; the countdown runs at 250ms ticks and both the
label and the bar reflect it; decline and timeout both restore the peek exactly; accept
progresses and cannot be interrupted by the timer.

## VALIDATION
- `pnpm --filter @lime/interaction-system test`
- `pnpm --filter @lime/interaction-system typecheck && pnpm --filter @lime/ui typecheck`
- `pnpm --filter @lime/ui contract` — must stay `contract ok`
- Baseline before you start: 64 tests passing, `contract ok — 34 shared files, 6 adapter exports`.
  Do not reduce either number.

## STOP CONDITIONS
- A fourth driver surface is needed → stop, report
- The accept-lock cannot be honoured without a contract change → stop, report
- Do not implement Courier / Shop / Help / Care offer variants
