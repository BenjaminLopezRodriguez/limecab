# Parity packet — Rider / `rideSelect` (Choose a ride)

**PROVENANCE:** `[OBSERVED]` — production web, localhost:3100, 390×844, signed in as
(424) 242-4242, 2026-09-01. Reached via the pin path (see ENTRY); the search path is
still `[BLOCKED]` because geocoding returns no rows on this machine.

## STATE
`rideSelect` — the fare/product choice. First state where money appears.

## ENTRY
`search` → `Set location with pin` → drop pin → `Set destination`.
(Production's normal entry is a geocoded result row; that path is unreachable locally, but it
lands on the identical state — the difference is only the destination's label.)

## EXIT ACTIONS
- Select a row → same state, selection applied, dock gains the CTA.
- `Confirm <product> · <fare>` → **upsell interrupt** (see `upsell.md`), then `confirmPickup`.
- Back (chevron in route bar) → `search`.

## REFERENCE SCREENSHOTS
- `../reference/web/rider/ride-options.png` — nothing selected
- `../reference/web/rider/ride-options-selected.png` — `Lime Comfort` selected, dock revealed

## PRODUCTION SOURCE
`src/components/limecab/surfaces.ts`, `limecab-app.tsx`, `service-app/service-sheet.tsx`

## SURFACES
| id | role | emphasis | interaction | presentation |
|---|---|---|---|---|
| map | background | background | passive | — |
| primary | primary | primary | active | `sheet` |
| secondary | search | hidden | inert | — |
| interrupt | interrupt | hidden | inert | — |

## MAP
- mode `route_preview`, camera fits origin + destination
- **Dark ground.** Both markers drawn; destination marker is a white rounded square with a black
  square inside, carrying a white label pill (`Pinned location`) above it.
- Interaction: passive. Floating recenter control bottom-right.
- Route bar floats at top: back chevron + breadcrumb `Current location › Pinned location` in one
  white pill; the breadcrumb is a button (`Edit`).

## CONTENT (exact visual order)
1. `Choose a ride` — ~24px semibold, sheet gutter
2. Option rows, in production order:

| glyph | title | seats | badge | detail | fare |
|---|---|---|---|---|---|
| car | Lime | 4 | `Fastest` | 4 min away · 9:09 PM dropoff | $5.01 |
| clock | Wait & Save | 4 | — | Wait up to 12 min · 9:17 PM dropoff | $4.70 |
| people | Lime XL | 6 | — | 7 min away · 9:12 PM dropoff | $6.07 |
| sparkle | Lime Comfort | 4 | — | 6 min away · 9:11 PM dropoff | $5.71 |
| people | Lime Pool | 2 | `Cheapest` | 9 min away · 9:14 PM dropoff | $4.31 |

Row anatomy: **circular** glyph well (~48pt, neutral fill) · title 17px semibold · seat icon +
count (small, muted, inline after title) · optional badge pill · detail line 15px muted ·
fare right-aligned ~19px semibold tabular.

The one-line product description (`Everyday ride`, `Newer cars, quiet ride`) is **`aria-label`
only** — it is not rendered. Do not draw it.

3. Dock (appears only once a row is selected), above a hairline:
   - `Visa ···· 4412 ›` — card glyph, chevron, full-width row
   - **CTA**

## CTA
`Confirm Lime Comfort · $5.71` — full-width pill, **dark (`foreground`) ground, white label**,
~17px semibold. Not lime. Label interpolates the selected product and its fare.

## SECONDARY ACTIONS
Payment row (opens payment change). Route-bar breadcrumb (`Edit` → back to search). Recenter.

## GESTURES
Sheet drags the full ladder; `Drag all the way down to leave` is in the sheet's own description,
so the bottom rung dismisses to `home`. List scrolls inside the sheet.

## BACK
→ `search`. (`BackDisposition`: revise the previous question.)

## KEYBOARD / FOCUS
No text entry. Rows are `button`s inside a `list`; production does **not** use radio semantics
here — a row press is a commit-ish action that reveals the dock.

## TRANSITION IN
`progress` from `search`/`destination`.

## TRANSITION OUT
`progress` to the upsell interrupt, then `confirmPickup`.

## SELECTED / UNSELECTED TREATMENT — the finding that matters
- **Unselected:** fully neutral. Grey circular glyph well, no fill, no rule.
- **Selected:** full-bleed **pale lime row fill**, a **black rule at the leading edge** (~4pt),
  and the glyph well becomes a **solid lime circle** with a dark glyph.

`@lime/ui`'s `ChoiceRow` is currently the **inverse**: neutral `c.muted` fill with a **lime**
leading rule, and a rounded-**rect** glyph well. Both need to change to match.

## FIXTURE DATA REQUIRED
Five products with: id, title, seat count, optional badge (`Fastest` | `Cheapest`), detail
string, fare cents. Plus a payment method label. Deterministic — no clock-derived dropoff times
in the fixture, or snapshots drift.

## EXISTING REUSABLE COMPONENTS
`ChoiceList` / `ChoiceRow` / `ChoiceGlyph` (need the changes above), `MapRouteBar`,
`LiveSheetDock`, `Button`, `FieldList`, `Icon`.

## KNOWN PARITY GAPS
1. Selected row is neutral-fill + lime rule; production is lime-fill + black rule — **[@lime/ui]**
2. `ChoiceGlyph` is a rounded rect; production is a circle — **[@lime/ui]**
3. No badge slot on `ChoiceRow` (`Fastest` / `Cheapest`) — **[@lime/ui]**
4. No seat-count affix beside the title — **[@lime/ui]**
5. CTA is lime in native; production is dark here — **[APP COMPOSITION]**
6. Dock's payment row absent — **[APP COMPOSITION]** + **[FIXTURE]**
7. Map ground is light; production is dark — **[NATIVE RENDERER]**
8. Route bar is a plain label; production is a breadcrumb button — **[@lime/ui]**

## IMPLEMENTATION BOUNDARY
`@lime/ui` atoms/primitives + the rider scene composition + fixtures.
**Do not** change `SurfaceState`, `SurfaceManager`, `ExperienceFrame`, the back resolver, or
`NativeSceneRenderer`'s public shape.

## STOP CONDITIONS
- The dark map ground cannot be expressed without a new map mode → stop, report.
- A badge/seat-count slot cannot be added without changing `ChoiceRow`'s contract for existing
  callers → stop, report.
