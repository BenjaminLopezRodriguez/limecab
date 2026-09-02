# Parity packet — Driver / `duty posture` (Recommended / availability)

**PROVENANCE:** `[OBSERVED]` — production web `/driver`, 390×844, 2026-09-01.
Completes Driver Cluster A: `offline.md` and `online.md` were device-verified, but neither
documented **where duty actually ends**. It is here.

## STATE
`recommended` — the hunting peek, opened out. The `RECOMMENDED` recipe.

## ENTRY
`online` → tap the menu icon on the right of the peek (`Recommended for you`).

## EXIT ACTIONS
- `Back to the map` → `online` (intent `return`)
- **`Go offline`** → `offline`. This is the only route off duty.
- `See earnings trends` → `openTrends`
- `Heading Anywhere` → heading interrupt (out of scope this cluster)
- `Driving preferences` → preferences

## REFERENCE SCREENSHOT
`../reference/web/driver/duty-recommended.png`

## SURFACES  (`RECOMMENDED`)
| id | role | emphasis | interaction | presentation |
|---|---|---|---|---|
| map | background | background | passive | posture `idle` |
| primary | primary | primary | active | **`expanded`** |
| offer | interrupt | hidden | inert | — |

## MAP
Posture `idle`, passive, receded behind the expanded sheet.

## CONTENT (exact visual order)
1. Header row: `Back to the map` (leading) · `Recommended for you` (title) · list toggle
   (trailing, `[pressed]`)
2. `Later today` — eyebrow
3. `See earnings trends` — row
4. `Heading` / `Anywhere` — two-line row (label above value)
5. `No promotions right now` — empty-state text
6. `Driving preferences` — row
7. **`Go offline`** — button

## CTA
`Go offline`. Note this is the *only* place duty can be dropped — `online`'s peek deliberately has
no CTA, which is the finding `online.md` already records.

## SECONDARY ACTIONS
All of the rows above.

## GESTURES
Sheet drags the ladder; `expandRecommended` takes it to `overlay`, `collapseRecommended` back.

## BACK
→ `online` (`return`, restores the peek exactly).

## KEYBOARD / FOCUS
None.

## TRANSITION IN / OUT
In: `openRecommended`, intent `interrupt`. Out: `closeRecommended`, intent `return`.

## FIXTURE DATA REQUIRED
Heading value (`Anywhere`), a promotions list (empty), earnings-trends label.

## EXISTING REUSABLE COMPONENTS
`FieldList`, `ChoiceRow`, `Button`, `LiveSheetHeader`, `Eyebrow`.

## KNOWN PARITY GAPS
1. State absent from the native driver composition — **[APP COMPOSITION]**
2. `openRecommended` / `closeRecommended` presence in `driverRideSurfaces` must be verified —
   **[RECIPE]**
3. Two-line `Heading / Anywhere` row shape — **[@lime/ui]** (may be a `FieldList` variant)

## IMPLEMENTATION BOUNDARY
Driver scene composition + recipes already defined + fixtures. No contract changes.

## STOP CONDITIONS
- If `expanded` cannot express this without a new presentation → stop, report.
