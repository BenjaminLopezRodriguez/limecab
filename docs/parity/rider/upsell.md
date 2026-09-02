# Parity packet — Rider / `upsell` (Add something for the ride?)

**PROVENANCE:** `[OBSERVED]` — production web, 390×844, 2026-09-01.
**This state was not previously known to the native project.** It sits between `rideSelect` and
`confirmPickup` and is not represented in any scenario or recipe.

## STATE
An interrupt offering in-ride add-ons. Skippable; does not block the flow.

## ENTRY
`rideSelect` → `Confirm <product> · <fare>`.

## EXIT ACTIONS
- Tap an item → (adds it; not exercised)
- `No thanks` → `confirmPickup`

## REFERENCE SCREENSHOT
`../reference/web/rider/confirm-pickup.png` was taken after dismissal; the upsell itself is
described from the accessibility tree plus the screenshot taken before dismissal. Re-capture if a
pixel reference is needed — the path is reproducible.

## SURFACES
| id | role | emphasis | interaction | presentation |
|---|---|---|---|---|
| map | background | background | passive | — |
| primary | primary | **suspended** | inert | `sheet` (held, visible behind) |
| interrupt | interrupt | **interrupt** | active | `sheet` |

`confirmPickup` is already mounted and rendered underneath — this is a true interrupt over a
live surface, not a replacement.

## MAP
Unchanged from `confirmPickup` underneath, and **blurred**. Production applies a backdrop blur to
everything behind the interrupt.

## CONTENT (exact visual order)
1. `Add something for the ride?` — ~19px semibold
2. `Coffee, tea, or sparkling water. One stop on the way. Skip to keep the ride as-is.` — 15px muted, wraps to 2 lines
3. List, three rows, each `<label>` left / `+$5.00` right:
   - `Coffee` · +$5.00
   - `Tea` · +$5.00
   - `Sparkling water` · +$5.00
   Rows are plain text rows — no glyph well, no chevron.
4. `No thanks` — full-width **neutral/light** pill, dark label. This is a secondary CTA; there is
   no primary CTA on this surface.

## GESTURES
Sheet. Dismissal is by the button, not observed by drag.

## BACK
Not observed. Treat as equivalent to `No thanks` (`dismiss-interrupt`) until verified.

## TRANSITION IN / OUT
In: `interrupt`. Out: `return` → reveals `confirmPickup` untouched.

## FIXTURE DATA REQUIRED
`[{ id, label, priceCents }]` × 3.

## EXISTING REUSABLE COMPONENTS
`FieldList` (label/value rows), `Button`, the interrupt surface in `NativeSceneRenderer`.

## KNOWN PARITY GAPS
1. State does not exist in `rider/happy-path.ts` — **[SCENE]**
2. No recipe for "interrupt over a suspended sheet, dismissible to return" in the rider
   recipes — **[RECIPE]** (`askQuestion` may already cover it; verify before adding one)
3. Backdrop blur behind an interrupt is not implemented — **[NATIVE RENDERER]**
4. Add-on fixtures absent — **[FIXTURE]**

## IMPLEMENTATION BOUNDARY
Scenario + recipe reuse + fixtures + scene composition.
**Architecture note:** this state is expressible with the existing contract — `suspended`
emphasis plus an `interrupt` surface is exactly the shape. No contract change is warranted.
The backdrop blur is a renderer treatment, not a new semantic dimension.

## STOP CONDITIONS
- If an existing recipe cannot express "interrupt over suspended primary that returns without
  disturbing it" → stop and report; do **not** invent a new semantic dimension.
