# Parity packet — Rider / `location_search`

**Status:** READY. Reference captured from production web 2026-09-02, 390×844.

## Entry / exit
- **Entry:** `openDestinationSearch` or `openPickupSearch`, intent `expand`.
- **Exit:** select a result → `destinationSelected` (intent `progress`); `Set location with pin`
  → `chooseOnMap` (intent `expand`); back → returns to the scene that asked.

## Production references
- Screenshots: `search.web.png` (resting), `destination.web.png` (typed, no results)
- Source: `location-search-scene.tsx`, `location-search.tsx`, `limecab-search-input.tsx`
- Written reference: `docs/specs/rider-ride-production-reference.md` → `location_search`

## Surfaces
| id | role | emphasis | interaction | presentation |
|---|---|---|---|---|
| map | background | background | passive | posture `locating` |
| primary | primary | **hidden** | inert | — |
| secondary | secondary | primary | active | `fullscreen` |

The world stays mounted behind the fullscreen scene. This is a peer surface, not a scene swap.

## Visible content, top to bottom
1. Header — back chevron (target `min-h-11 min-w-11`) + `Where to?`, `text-[17px] font-medium`
2. **Connected route field stack** in one rounded card:
   - row 1: **lime dot** + `Current location` (pickup, filled, inactive → `text-[15px]`)
   - a vertical connector line joining the two rows
   - row 2: **black square** + `Search an address…` (destination, active input → `text-base`)
   - `+` circular button, top-right of the card — add a stop
   - mic at the right edge of the **active** row
   - fields are `h-12`
3. `Set location with pin` — circular muted glyph well `size-10` + label, row `-mx-2 mt-4`
4. Results, when present (see below)

## Results — SOURCE-DERIVED, NOT SCREENSHOT-VERIFIED
Local geocoding is unconfigured (`MAPBOX_TOKEN` unset), so production returned zero results and I
could not photograph a populated row. From source: lookup starts after **3 characters** with a
**250ms debounce**; searching and zero-results render **no placeholder rows** (confirmed on
screen — the area is simply empty). Row shape: `min-h-14 gap-3 px-2 py-2`, glyph `size-10`, title
`text-[15px] font-medium tracking-tight`, context `text-sm` muted. Sections use
`text-[11px] font-medium tracking-[0.12em] uppercase`.

Use the existing `fixturePlaceSearch` adapter for data. **Keep the 3-char threshold and the
debounce** — they are observable behaviour, not an implementation detail.

## CTA / back / keyboard
No fixed CTA; commit happens by selecting a result. Back dismisses the search surface and returns
to the asking scene **without moving the workflow step** (`dismiss-transient`). The destination
field takes focus on open, raising the keyboard.

## Known gaps in native
1. Native has a single `Input` with a magnifier. Production has a two-row connected route stack
   with a pickup row, connector, add-stop `+`, and a mic — **SCENE**.
2. No `Set location with pin` row — **SCENE** (the `chooseOnMap` recipe already exists and the
   map-as-subject seam is working).
3. No 3-character threshold or debounce — **SCENE**.
4. Native shows saved/recent as results at rest; production shows the field stack and the pin row
   at rest. Verify against the packet, not against the current native behaviour — **SCENE**.

## Reusable components already available
`Input` (has `autoFocus`), `ChoiceList`/`ChoiceRow`/`ChoiceSection`, `IconGlyph`, vendored icons,
`fixturePlaceSearch`, the `openSearch` / `placeSelected` / `chooseOnMap` recipes.
