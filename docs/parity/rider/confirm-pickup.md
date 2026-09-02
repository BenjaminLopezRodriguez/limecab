# Parity packet — Rider / `confirmPickup`

**PROVENANCE:** `[OBSERVED]` — production web, 390×844, 2026-09-01.

## STATE
`confirmPickup` — pricing is settled; the only remaining question is which curb.

## ENTRY
`rideSelect` → `Confirm <product> · <fare>` → dismiss the upsell interrupt (`No thanks`).

## EXIT ACTIONS
- Tap a spot row → selection moves, map marker moves.
- `Confirm pickup` → `matching`.
- Back → `rideSelect`.

## REFERENCE SCREENSHOTS
`../reference/web/rider/confirm-pickup.png`

## PRODUCTION SOURCE
`src/components/limecab/surfaces.ts`, `limecab-app.tsx`

## SURFACES
| id | role | emphasis | interaction | presentation |
|---|---|---|---|---|
| map | background | **primary** | **active** | — |
| primary | primary | primary | active | `sheet` (short) |

The map is the subject here — the sheet only names the curb.

## MAP
- mode `select_location`, camera **centred on the pickup**, not fitting the route.
  At route zoom two spots 100m apart are indistinguishable; this is why `camera.intent` is
  `center` for this state.
- Pickup marker is a **callout**: a lime pill labelled `Front entrance` with a short lime stem
  pointing down at the coordinate, and a small white pill `Current location` sitting above it.
- Destination marker is not drawn.
- Route bar: back chevron + `Current location` **centred, single label** — not a breadcrumb.
- Recenter control bottom-right.

## CONTENT (exact visual order)
1. Header row: `Confirm pickup` 17px semibold, `Current location` 15px muted beneath it;
   **magnifier icon** right-aligned (search for a different pickup)
2. Spot list — one row per candidate curb:
   - selected: pale lime fill, black leading rule, **small lime ring glyph** (~28pt, ring with a
     dot — not the 48pt filled circle used on ride options), `Front entrance` bold +
     `Current location` muted
3. Empty space — the sheet does not shrink to its content
4. Dock, above a hairline: **CTA**

## CTA
`Confirm pickup` — full-width pill, **dark ground, white label**. Not lime.

## SECONDARY ACTIONS
Magnifier (pickup search). Route-bar back. Recenter.

## GESTURES
Sheet drags the ladder. Map takes pan/zoom, and moving the map is a legitimate way to change the
pickup.

## BACK
→ `rideSelect`.

## KEYBOARD / FOCUS
None until the magnifier is used.

## TRANSITION IN / OUT
In: `progress` from `rideSelect`. Out: `progress` to `matching`.

## FIXTURE DATA REQUIRED
A list of pickup spots, each `{ id, label, sublabel, coordinate }`. `PICKUP_SPOTS` already exists
in the interaction-system fixtures.

## EXISTING REUSABLE COMPONENTS
`ChoiceRow` (needs the small-ring glyph density), `MapRouteBar`, `LiveSheetDock`, `Button`,
`NativeMapSurface` (tap→coordinate already implemented).

## KNOWN PARITY GAPS
1. Selection treatment — same inversion as ride options — **[@lime/ui]**
2. No small ring-glyph density for spot rows — **[@lime/ui]**
3. Lime CTA; production is dark — **[APP COMPOSITION]**
4. Marker is a plain pin; production is a lime callout pill with a stem — **[NATIVE RENDERER]**
5. Header's trailing magnifier missing — **[APP COMPOSITION]**

## IMPLEMENTATION BOUNDARY
`@lime/ui` + rider scene composition + fixtures. Camera intent is already correct — **do not**
change `resolveCamera` or the scenario's `camera: { intent: "center" }`.

## STOP CONDITIONS
- The callout marker cannot be drawn without changing the map surface contract → stop, report.
