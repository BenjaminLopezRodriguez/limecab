# Handoff: Lime Spaces + Lime Station

**Status: tiles on `/services`; rider flows not built.**  
This is a work order for the next Claude session. Do not invent a second
chrome stack, a hotel OTA, or a parking marketplace. Build two place-finding
verticals that feel like **Ride** — one question per scene, map under sheet,
confirm before anything is requested.

Read first:

- `.claude/skills/surface-orchestration/SKILL.md`
- `.claude/skills/adaptive-surfaces/SKILL.md`
- `.claude/skills/scene-preparation/SKILL.md`
- `.claude/skills/perceived-performance/SKILL.md`
- `.ux-bugs/HANDOFF-surfaces.md` (map under sheet, chrome vars — do not redo)
- `.ux-bugs/HANDOFF-logistics.md` (spatial index, H3, `/api/map/nearby`)
- `.ux-bugs/HANDOFF-lime-help-shop.md` (scene flags, one question per scene)
- `.ux-bugs/HANDOFF-goget-2026.md` (what we deliberately did *not* build)

Named surface actions only. Interruptions suspend; they do not unmount. No
product names inside `components/service-app/*`.

---

## What shipped in this pass (reference only)

| Piece | Where |
|---|---|
| `Spaces` + `Station` tiles on `/services` | `src/lib/limecab/mock.ts`, `src/app/services/page.tsx` |
| Removed "Go anywhere" section heading | `src/app/services/page.tsx` |
| Single 2-column grid for all services | same |
| Status `coming_soon` until flows land | `mock.ts` |
| Future entry URLs staged | `/?service=spaces`, `/?service=station` |

Flip each tile to `available` only when its end-to-end path works in the
browser at 390×844.

---

## Design language = Ride (non-negotiable)

Copy **Ride's interaction model**, not Uber Hotels / SpotHero screenshots.

### Reference files (read before writing UI)

| Ride piece | File |
|---|---|
| Home launcher | `limecab-home-scene.tsx` |
| Destination search | `location-search-scene.tsx` + `limecab-search-results.tsx` |
| Product comparison | `limecab-ride-select-scene.tsx` |
| Confirm + pay band | `SheetActions` + `PrimaryAction` in ride select |
| Scene machine | `surfaces.ts`, `limecab-app.tsx`, `state.test.ts` |
| Map + sheet layout | `service-app-shell.tsx`, `HANDOFF-surfaces.md` |

### Visual + copy tokens to reuse

- Scene title: `font-heading text-[22px] font-semibold tracking-[-0.02em]`
- Comparison rows: `ChoiceList` / `ChoiceRow` / `ChoiceGlyph` / `ChoiceCopy`
- Tile launcher (already on `/services`): `bg-card ring-border rounded-2xl p-3.5 ring-1`
- Unavailable honest copy: `"Not in your city yet"` (tiles) or tier-style `"Not in your city yet"` on a row
- Primary CTA pattern: `Confirm {name} · {price}` via `PrimaryAction`
- Payment row above confirm (when money changes hands)
- One question per scene — never stack "where + when + which tier" on one sheet
- Confirm is always the purchase; nothing auto-books from search or voice

### What Ride does *not* do (don't import here)

- No multi-tab wizards
- No card grids with filters on the first screen
- No inline map pickers replacing search
- No second drawer stack

---

## Product definitions

### Lime Spaces — "Find a room or venue"

**Job.** The rider needs a bookable room or event venue near a place and time.
Lime is the **concierge**, not the hotel: surface inventory, compare options,
hold/confirm — supply comes from partners (`/partner/places`) and spatial index
fixtures until real inventory exists.

**Not in scope for v1**

- Expedia / Vrbo / Rapid API integration
- Membership / credits
- Indoor maps, floor plans, seat maps
- Multi-night complex pricing engines
- A separate `/spaces` route with its own chrome

**In scope for v1 (Lime-sized)**

- Entry: `/services` tile, `/?service=spaces`, Assist intent `room` / `venue`
- Scene chain (one question each):
  1. **Where?** — destination search, same kit as Ride. Title: "Where do you need space?"
  2. **When?** — reuse `LimeCabWhenScene` patterns (date + time window). Title: "When?"
  3. **What kind?** — two or three tiles, Help-style: `Meeting room`, `Event venue`, `Stay overnight`. Title: "What kind of space?"
  4. **Choose** — `ChoiceList` of 3–5 mock/partner-backed options priced per hour or night. Title: "Choose a space"
  5. **Confirm** — `Confirm {name} · {total}` + payment row
- Map shows the **venue pin** during choose/confirm; no turn-by-turn
- Data: query spatial index with `entityTypes: ["hotel", "entertainment"]` + fixtures in `mock.ts` for demo density when index is thin
- Server: optional `spaces_quotes` table **only if** you need persistence; prefer stateless mock quotes in v1 like early Ride tiers
- Partner path: `/partner/places` (hub) · `/partner/places/app` (desk) — rider flow links "List your space" in footer copy only

### Lime Station — "Find parking"

**Job.** The rider is going somewhere and needs parking nearby for a duration.
Lime surfaces lots/garages, compares price + walk time, confirms a spot hold.

**Not in scope for v1**

- Gate codes, license-plate enforcement, real-time occupancy APIs
- Monthly/month-to-month subscriptions
- Valet dispatch
- In-app navigation to the exact stall

**In scope for v1 (Lime-sized)**

- Entry: `/services` tile, `/?service=station`, Assist intent `parking`
- Scene chain:
  1. **Where are you going?** — destination search. Title: "Where are you headed?"
  2. **How long?** — compact duration chips: `1 hr`, `2 hr`, `4 hr`, `All day`. Title: "How long?"
  3. **Choose parking** — `ChoiceList` rows with `{lot name} · {walk min} walk · {price}`. Title: "Choose parking"
  4. **Confirm** — `Confirm {lot} · {total}` + payment row
- Map shows destination pin + parking pins during choose (reuse `ServiceMap` markers; category token for parking)
- Data: spatial index `entityTypes: ["parking"]`; `PIT_STOP_ENTITY_TYPES` in `spatial.ts` is the seed list
- Walk time: straight-line or mocked minutes — label honestly if mocked

---

## Scene machine (extend, do not fork)

Add booking modes to the existing contract:

```ts
// search-input.ts
export type BookingMode =
  | "ride"
  | ...
  | "spaces"
  | "station";
```

Wire `/?service=spaces` and `/?service=station` in `limecab-app.tsx` the same
way `shop`, `help`, and `courier` deep-link today.

Suggested context flags (only if needed):

```ts
locationAfterConfigure?: boolean; // already exists — likely false for both
selectAfterConfigure?: boolean;   // Station: false; Spaces: true after When
```

State transitions should mirror Ride:

```
home → location_search → spaces_kind → spaces_select → confirm → complete
home → location_search → station_duration → station_select → confirm → complete
```

Add tests in `state.test.ts` for forward + back through each chain.

### Surface actions (names only — implement in `surfaces.ts`)

| Action | Effect |
|---|---|
| `openSpaces` | set bookingMode spaces, open destination search |
| `openStation` | set bookingMode station, open destination search |
| `selectSpaceKind` | commit kind, advance to select scene |
| `selectStationDuration` | commit duration, advance to select scene |
| `selectSpaceOption` / `selectStationOption` | commit choice, open confirm |
| `confirmSpace` / `confirmStation` | purchase interrupt (mock trip record ok) |

Do **not** add `ServiceAppState` members named `spaces` or `station`. Use the
existing scene union + bookingMode, same as Help/Shop.

---

## Data + API seams

### Spatial (already exists — use it)

- `GET /api/map/nearby?lat=&lng=&entityTypes=parking` for Station
- `entityTypes=hotel,entertainment` for Spaces
- Map fixtures when index returns sparse: add `SPACES_FIXTURES` / `STATION_FIXTURES` beside `GEOCODE_FIXTURES` in `mock.ts` (real LA names)

### Quotes (v1 mock)

```ts
type SpaceOption = {
  id: string;
  name: string;
  kind: "meeting" | "venue" | "stay";
  priceCents: number;
  unit: "hour" | "night";
  capacity?: number;
  walkMinutes?: number;
};

type StationOption = {
  id: string;
  name: string;
  priceCents: number;
  walkMinutes: number;
  openUntil?: string; // "10 PM" display only
};
```

Price with a small pure function in `src/lib/limecab/spaces.ts` and
`station.ts` (+tests). No Stripe charge in v1 — post a mock `trips` row or
activity entry only if other verticals already do at confirm time.

### Schema (defer unless required)

If confirm must appear in Activity, extend `trips` with nullable
`spacesOptionId` / `stationOptionId` JSON — **or** reuse `productId` namespace
`lime-space-*` / `lime-station-*`. Do not add hotel inventory tables.

---

## New files (expected)

| File | Role |
|---|---|
| `src/lib/limecab/spaces.ts` (+ `.test.ts`) | kinds, fixtures, quote helper |
| `src/lib/limecab/station.ts` (+ `.test.ts`) | duration presets, quote helper |
| `src/components/limecab/limecab-spaces-kind-scene.tsx` | What kind? tiles |
| `src/components/limecab/limecab-spaces-select-scene.tsx` | Choose a space |
| `src/components/limecab/limecab-station-duration-scene.tsx` | How long? chips |
| `src/components/limecab/limecab-station-select-scene.tsx` | Choose parking |

Keep scenes thin — logic in lib, orchestration in `limecab-app.tsx`.

---

## Assist + One Search hooks (P1 if time)

- Assist classify: "book a room", "meeting space downtown", "parking near LAX" → staging `spaces` / `station` drafts
- One Search intent rows in `limecab-search-results.tsx`: icon + "Find a room near {place}" / "Find parking near {place}"

---

## Acceptance (390×844 browser)

### Spaces

- [ ] `/services` → Spaces tile → `/?service=spaces` → destination search titled "Where do you need space?"
- [ ] Union Station → When → Meeting room → ≥3 options in `ChoiceList` → Confirm shows name + price
- [ ] Back from each scene returns to the previous question with draft intact
- [ ] Unavailable city uses existing `LimeCabUnavailableSurface` pattern, not a dead button

### Station

- [ ] `/services` → Station tile → `/?service=station` → "Where are you headed?"
- [ ] Dodger Stadium → 2 hr → ≥3 parking rows with walk + price → Confirm
- [ ] Map shows parking markers during select; destination pin stays visible

### Shared

- [ ] No new chrome layer; map under sheet; `SheetActions` sticky
- [ ] `state.test.ts` covers both chains
- [ ] `LIMECAB_SERVICES` status flipped to `available` for each shipped vertical
- [ ] Service ribbon on Home skips `coming_soon` entries until available (existing behavior)

---

## Partner URL structure (supply side)

Rider products are **Spaces** and **Station**; partner supply is grouped under
**Places** because one operator often lists both rooms and parking.

| Path | Role |
|---|---|
| `/partner/places` | Gateway — intro + shortcuts (like `/partner/fleets`) |
| `/partner/places/app` | **Desk** — all listings, filters, add CTAs |
| `/partner/places/app/listings/new?kind=room\|venue\|parking` | Create listing |
| `/partner/places/app/listings/[id]` | Edit / publish / pause |
| `/partner/stay` | Redirect → `/partner/places` |
| `/partner/stay/app` | Redirect → `/partner/places/app` |

Future (when bookings exist):

| Path | Role |
|---|---|
| `/partner/places/app/bookings` | Incoming Spaces + Station reservations |
| `/partner/places/app/listings/[id]/availability` | Hours / blackouts |

Do not split into `/partner/stay/*` and `/partner/station/*` — one desk,
listing `kind` discriminates supply.

---

```
You are implementing Lime Spaces and Lime Station on LimeCab as it exists:
web rider, ServiceAppShell, scene machine, spatial index.

Read this file and HANDOFF-surfaces.md before writing code.

Goal: two place-finding verticals that feel like Ride — destination search,
one question per scene, ChoiceList comparison, Confirm {name} · {price}.

Do NOT build: hotel OTA integration, real parking occupancy, new chrome,
second map stack, inventory tables, or driver-side work.

DO build: bookingMode spaces|station, deep links, 4-scene chains each,
mock quotes + spatial/fixture data, state tests, flip service tiles to available.

Reference UI: limecab-ride-select-scene.tsx, limecab-help-kind-scene.tsx,
limecab-when-scene.tsx.

Run: pnpm test (lib tests), walk flows at 390×844, pnpm build.
```

---

## Suggested implement script

```bash
./scripts/claude-implement-spaces-station.sh
```

Create the script mirroring `claude-implement-lime-help-shop.sh`: point
Claude at this file + the four skills, forbid driver/freight edits unless
explicitly needed for Activity listing.

---

## Status — built 2026-08-30 (rider flows), uncommitted

Both verticals walk end to end at 390×844. Tiles are `available`.

### Scene mapping — read this before changing the chain

No new `ServiceAppState` members, as instructed. Both verticals are the
existing chain with `bookingMode`:

```
home → location_search → configure → service_select
        (where?)         (kind /     (compare + confirm
                          how long?)  in the band)
```

Two deviations from this file's suggested chain, both deliberate:

1. **There is no separate "Choose" scene.** `service_select` *is* the
   comparison, and Confirm sits in its `SheetActions` band — exactly what
   Ride does with tiers. The choice is the purchase, so a fifth scene would
   be a second question about one decision.
2. **Spaces' span (1/2/4/8) is an inline control on the compare scene**, not
   its own question. It re-prices the list the rider is looking at, which is
   the case scene-preparation makes for an inline control over a scene.

### The shared reducer changed — this affects every vertical

`src/lib/service-app/state.ts` could express place→compare→configure (Ride)
and configure→compare→place (Help), but **not** place→configure→compare.
Two edits:

- `select_location` now honours `selectAfterConfigure`. The flag already
  claimed to govern this ordering; it was only read on the far side of
  `configure`, so a place-first flow jumped its option question.
- `back` from `configure` under `selectAfterConfigure` revises to
  `location_search` when a place is known, instead of dropping to `home`.

Ride, Courier, Reserve, Shop and Help all ride on this. The 394-test suite
covering their chains passing is what makes it safe; if you touch it, that
suite is the check.

### Honest by construction

- **Confirm claims nothing.** There is no partner API and no charge, so
  confirming names the choice and the price and says booking is not open.
  "Booked" for a room nobody held is the lie the perceived-performance rules
  exist to stop.
- **Distance is measured from the place the rider named**, never carried in
  from a fixture. Fixtures are downtown; searching Dodger Stadium used to
  show "Grand Central Market Garage · 3 min walk", which is three miles
  wrong. Anything past 2 km is dropped, so the empty state is real: Dodger
  Stadium says "No lots near there yet", Grand Central Market shows 1/6/17/24
  minute walks that match the pins.
- **No route line.** A place finder has no journey; drawing pickup →
  destination asserted a trip nobody asked for.
- Rates are labelled simulated on every scene that shows one.

### Files

New: `lib/limecab/spaces.ts`, `station.ts` (+ tests, 13),
`limecab-spaces-kind-scene.tsx`, `limecab-spaces-select-scene.tsx`,
`limecab-station-duration-scene.tsx`, `limecab-station-select-scene.tsx`.
Changed: `search-input.ts` (two contracts), `limecab-app.tsx` (modes, deep
links, option fetch with fixture fallback, pins, honest confirm),
`service-app/state.ts` + `state.test.ts`, `mock.ts` (tiles available).

### Verified 2026-08-30, dev on :3000, 390×844

`/services` → both tiles link · Spaces: Union Station → "Where do you need
space?" → What kind of space? → 3 meeting rooms → `Confirm Spring Street
Loft · $96.00` → honest confirm → Back revises to the kind question with the
place intact · Station: Dodger Stadium → 2 hr → honest empty; Grand Central
Market → 4 lots with walk + closing time + price, lots pinned on the canvas.

`tsc` clean · 394 tests, 0 fail · lint clean on these files.

### Not built

- Assist classify and One Search intent rows (this file's P1).
- Anything server-side: no quotes table, no trips row, no Activity entry.
  Confirm is client-only by design until there is inventory.
- Spaces has no date/time question. The span is a count, not a calendar —
  `LimeCabWhenScene` is the obvious home for a real one when partners land.

### Known rough edges

- The destination bar still renders `origin → destination` for these modes
  even though the search contract sets `showRoute: false`. It reads as a
  trip. The bar is separate from the search's route stack; fixing it is a
  small change in the canvas bar, not the contract.
- Sheet copy leaks Ride's vocabulary: the live region says "Your ride" and
  "Continue to the quote", because `serviceAppQuestion` has no place-finder
  wording. Cosmetic, screen-reader-visible.
- **A concurrent session** was editing `/services`, `mock.ts`, `/partner/**`
  and `src/lib/partner/` throughout this pass. Its
  `components/partner/partner-places-scenes.tsx:58` currently has a lint
  error, which will fail the production build (`next build` runs lint) if it
  is committed as-is.
