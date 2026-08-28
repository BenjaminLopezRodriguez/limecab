# Handoff: logistics backend (H3, favorites, no dummy places)

**Status: open work order.** Research snapshot 2026-08-27. Do not treat this
as a surfaces, driver-shell, or GO–GET rebuild. Those three handoffs already
shipped. This is a **new logistics work order**: persist real locations,
index them with H3, draw one H3 lattice on the driver map, and stop serving
invented Home / Work / nearby cars.

```
CLAUDE BRIEF
============
You are implementing LimeCab's logistics layer: a real location backend that
replaces dummy places, lets signed-in users save favorite spots, and uses H3
in two ways — a visual hex grid on the driver map, and a silent index for
nearby search. Read this whole file before writing code.

Read first:
  .claude/skills/surface-orchestration/SKILL.md
  .claude/skills/adaptive-surfaces/SKILL.md
  .claude/skills/scene-preparation/SKILL.md
  .claude/skills/perceived-performance/SKILL.md
  .ux-bugs/HANDOFF-surfaces.md     (state doc — do not redo)
  .ux-bugs/HANDOFF-driver.md       (offer + job — do not redo)
  .ux-bugs/HANDOFF-driver-ux.md    (idle UX — owns how the res-8 grid looks)
  .ux-bugs/HANDOFF-goget-2026.md   (rider features — do not redo)

Named surface actions only. One question per scene. Interruptions suspend;
they do not unmount. No independent drawer / map / footer choreography.

Do not:
  - Restyle offer/job scenes. Idle home composition is HANDOFF-driver-ux.md
    — if that work is in flight, add ping + coverage GeoJSON there; do not
    fight it with a second lattice.
  - Re-derive the sheet/map contract in HANDOFF-surfaces.md
  - Draw hexes on the rider map
  - Build surge, heatmaps, dynamic multipliers, or a color scale
  - Kill SIMULATE_DRIVERS (solo rider demos still need it)
  - Kill the product catalogue (RIDE_PRODUCTS, LIMECAB_SERVICES)
  - Invent a second geocoder or a second map/sheet stack
  - Put H3 types into components/service-app — logistics is LimeCab
  - Add useState booleans that name screens (showHexes, savingPlace, …)
  - Commit unless asked

Implement sections 1–7 in order. Verify each in the browser (390×844) before
moving on. tsc --noEmit and existing tests must stay green.
```

---

## What this is

Uber's marketplace is a hex grid, not a list of addresses. Drivers sit in
cells; requests land in cells; nearby search is "cells around me", not a
full table scan. LimeCab already has real trips and a real driver accept
path. What it does **not** have is a location layer: drivers never report
where they are, saved places are Ava Moreno's Echo Park apartment, and the
rider map paints three invented Priuses while matching.

Two H3 jobs, not one library with two comments:

| Job | Resolution | Who sees it | Stored on |
|---|---|---|---|
| **Visual lattice** | **8** (~0.74 km², ~460 m edge) | Driver, idle map only | computed in the client from the viewport; driver `lastH3` is the same res so the cell they stand in matches the cell matching uses |
| **Search index** | **9** (~0.10 km², ~174 m edge) | Nobody. Query filter only | `saved_places.h3`, used by nearby / empty-query ranking |

Do not collapse them into one resolution. The driver lattice has to be
glanceable from a dash at zoom 14; res 9 is a mesh. Search has to mean "a
few blocks", not "this neighborhood".

HANDOFF-driver forbade "heat maps / surge polygons". That ban still holds.
This overlay is a **location lattice** — thin lime strokes, almost-clear
fill, the driver's cell a hair louder, cells that currently hold an open
request a hair louder still. No dollar, no color ramp, no "1.4x".

---

## What exists today (do not polish this)

### Real

- Trips, drivers, accept, advance: `src/server/db/schema.ts`,
  `src/server/api/routers/trip.ts`, `src/server/api/routers/driver.ts`.
- Driver duty session: map-first, one offer interrupt, one primary
  (`src/components/limecab/driver-app.tsx`).
- Rider booking: Mapbox Places when the token is set
  (`src/lib/limecab/places.ts` → `/api/map/places`).
- Activity tab already lists **real** `trip.list` rows. `TRIP_HISTORY` in
  `mock.ts` is dead.
- Recenter-on-map already reverse-geocodes the device
  (`RecenterPickupButton` in `limecab-app.tsx`).
- Heading filter is real (`offerHeadsToward` + `driver.setHeading`). The
  **presets** it offers are fake.

### Dummy (this work order kills these as *user data*)

| Fixture | File | What the user currently sees |
|---|---|---|
| `SAVED_PLACES` (Home Echo Park, Work Arts District, Pasadena, Union Station, Big Bear) | `src/lib/limecab/mock.ts` | Home chips, search recents, profile "Saved places", driver heading presets |
| `CURRENT_LOCATION` (S Grand & 5th) | same | Pickup default, Places proximity bias |
| `NEARBY_DRIVERS` (three parked markers) | same | Rider home + matching map |
| `GEOCODE_FIXTURES` prepended ahead of Mapbox | `src/lib/limecab/places.ts` | Typed search always leads with the fixture list |
| `RIDER` / `LAST_TRIP` | `mock.ts` | Profile name fallback, unused last-trip |
| `HEADING_PRESETS` | `driver-app.tsx` | Home / Work / Union Station as heading, regardless of the signed-in driver |

`RIDE_PRODUCTS`, `LIMECAB_SERVICES`, `TRAVEL_SPOTS`, `PAYMENT_METHODS`,
`DRIVER_POOL` (simulation only), and voice **aliases** (LAX, Griffith, …)
stay. Those are catalogue and parser keywords, not this user's places.

### The hole in the driver row

`drivers` has `headingLatitude` / `headingLongitude` (destination filter)
and **no current position**. The driver app already holds `device` from
geolocation and never sends it. Inbox is every `requested` trip in the
table, heading-filtered. A driver in Santa Monica is offered a pickup in
Pasadena.

---

## Architecture

```
                    ┌──────────────────────────────┐
                    │  src/lib/limecab/h3.ts       │
                    │  DRIVER_H3_RES = 8           │
                    │  SEARCH_H3_RES = 9           │
                    │  toDriverCell / toSearchCell │
                    │  disk / viewportCells        │
                    │  cellPolygon (GeoJSON)       │
                    └─────────────┬────────────────┘
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
   driver.pingLocation     saved_places.h3          rider map
   drivers.lastH3 (res 8)  (res 9, index only)      nearby from
   trips.pickupH3 (res 8)  places.nearby k-ring     driver.lastH3
          │                       │                       │
          ▼                       ▼                       ▼
   inbox.open = disk(k=2)   empty search / chips    NEARBY_DRIVERS gone
   visual grid @ res 8      never drawn             honest empty if none
```

Library: add `h3-js` (v4 API: `latLngToCell`, `cellToBoundary`, `gridDisk`,
`polygonToCells`, `isValidCell`). One wrapper file so the rest of the app
never imports `h3-js` directly.

Schema additions (Drizzle, then `npm run db:generate` + `db:push` / migrate):

```ts
// drivers — current fix. Heading columns stay; they are a different thing.
lastLatitude: doublePrecision()
lastLongitude: doublePrecision()
lastH3: varchar({ length: 16 })        // res 8
lastSeenAt: timestamp({ withTimezone: true })

// trips — written at request time from pickup coords
pickupH3: varchar({ length: 16 })      // res 8, nullable for old rows

// new table
savedPlaces = createTable("saved_place", (d) => ({
  id: d.varchar({ length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: d.varchar({ length: 255 }).notNull().references(() => users.id),
  kind: d.varchar({ length: 16 }).$type<"home" | "work" | "custom">().notNull(),
  label: d.varchar({ length: 64 }).notNull(),
  address: d.varchar({ length: 512 }).notNull(),
  latitude: d.doublePrecision().notNull(),
  longitude: d.doublePrecision().notNull(),
  h3: d.varchar({ length: 16 }).notNull(), // SEARCH_H3_RES
  createdAt: timestamp tz default now
  updatedAt: timestamp tz
}), (t) => [
  index("limecab_saved_place_user_idx").on(t.userId),
  index("limecab_saved_place_h3_idx").on(t.h3),
  unique("limecab_saved_place_home_unique").on(t.userId, t.kind), // only for home/work — see §4
])
```

The unique on `(userId, kind)` is **wrong for `custom`**. Enforce "one Home,
one Work" in the mutation (delete-and-insert or upsert on kind ∈ {home,work}),
and allow many `custom`. Do not put a unique that blocks a second custom.

Index `drivers.lastH3` and `trips.pickupH3`. Matching is an equality on a
small in-disk set, not a lat/lng bounding box.

tRPC: new `places` router (favorites + nearby). Additions on `driver`
(`pingLocation`) and `trip.request` (write `pickupH3`). `driver.inbox`
filters by H3 disk **then** heading, in that order.

---

## Dummy data — kill vs keep

**Kill from the UI** (stop importing as live user data):

- `SAVED_PLACES` in `limecab-home-scene.tsx`, `limecab-app.tsx` (search
  `places=`), `/profile`, `/profile/places`, `driver-app.tsx` heading
- `NEARBY_DRIVERS` in `limecab-app.tsx`
- Fixture-first merge in `createPlacesAdapter` — Mapbox results are the
  list; the static adapter is **fallback on failure only**, not a prepend
- `CURRENT_LOCATION` as the pickup the rider "has". Pickup starts unset
  (or from the last completed trip's pickup) and is filled by geolocation
  / recenter / pin. A downtown-LA fallback is allowed only as the map
  camera's first paint when the device has no fix, labelled as such if
  shown, never as Home.

**Keep:**

- `RIDE_PRODUCTS` / `quoteFor` / `IMMEDIATE_RIDE_PRODUCTS` — catalogue
- `LIMECAB_SERVICES` — `/services` tiles
- `TRAVEL_SPOTS` — Travel Mode concierge (GO–GET §3). Not this user's
  favorites. Do not hide them behind the user's saved-place query.
- `GEOCODE_FIXTURES` **inside** `geocodeAdapter` as the Mapbox-down path
- `DRIVER_POOL` + `simulate-driver.ts` behind `SIMULATE_DRIVERS`
- Voice aliases in `voice-booking.ts`. "take me home" still parses to
  query `"Home"`; the booking layer then resolves that against the user's
  saved Home and fails honestly if they have none. Do not keep Echo Park
  as the meaning of Home.
- Payment / profile preference fixtures — out of scope

After §7, `rg SAVED_PLACES src/` should have no hits outside `mock.ts` and
tests that still use the static geocoder.

---

### 1. H3 core (P0)

**Goal.** One module both sides import. Two resolutions. Tests that lock
the numbers so the visual grid and the search index cannot silently drift.

**Desired**

Create `src/lib/limecab/h3.ts`:

```ts
export const DRIVER_H3_RES = 8;
export const SEARCH_H3_RES = 9;

export function toDriverCell(lat: number, lng: number): string;
export function toSearchCell(lat: number, lng: number): string;
export function cellDisk(h3Index: string, k: number): string[];
export function viewportCells(
  west: number, south: number, east: number, north: number,
  res?: number, // default DRIVER_H3_RES
): string[];
export function cellPolygon(h3Index: string): GeoJSON.Polygon;
export function cellsToFeatureCollection(
  cells: string[],
  properties?: (h3Index: string) => Record<string, unknown>,
): GeoJSON.FeatureCollection;
```

`cellPolygon` must close the ring (first = last) and emit `[lng, lat]` —
GeoJSON order, not H3's lat/lng. A swapped pair draws the grid in the
Atlantic.

`viewportCells` uses `polygonToCells` on the bbox, not a huge `gridDisk`.
A driver who pans to a new neighborhood should see *that* lattice, not
fifty hexes around their last ping.

**Acceptance**

- Downtown LA `(34.0505, -118.2551)` → a valid res-8 cell and a **different**
  valid res-9 cell.
- `cellDisk(cell, 1)` has 7 members (center + 6). `k=2` has 19.
- `cellPolygon` ring length ≥ 7 (6 verts + close) and every coordinate is
  `[lng, lat]` with lng ≈ -118, lat ≈ 34 for that fixture.
- Wrapper is the only file that imports `h3-js`.

**Verify**

```
npm test          # includes src/lib/limecab/h3.test.ts
npx tsc --noEmit
```

Do not put a hex on a map yet. This section is the contract.

---

### 2. Schema + driver ping (P0)

**Goal.** A driver on duty has a last-known cell. A requested trip has a
pickup cell. Inbox is "trips in my disk", not "every open row in Postgres".

**Current LimeCab**

- `drivers` has no fix columns.
- `driver.inbox` loads every `status=requested AND driverId IS NULL`, then
  `offerHeadsToward`.
- Driver geolocation lives in React (`device` in `driver-app.tsx`) and
  dies with the tab.

**Desired**

- Columns as in Architecture.
- `trip.request` writes `pickupH3 = toDriverCell(pickup.lat, pickup.lng)`
  when coords exist; leave null if the client sent an address-only
  pickup (should be rare — pin and Places always have coords).
- `driver.pingLocation({ latitude, longitude })` protected. Updates the
  signed-in driver's `lastLatitude/lastLongitude/lastH3/lastSeenAt`.
  Rejects out-of-range coords. Does **not** go through the trip state
  machine.
- Driver app: while `scene` is `online | to_pickup | at_pickup | on_trip`,
  ping every 4s with the current `device` fix (same cadence as resting
  inbox). Fail-soft — a 500 must not lock the GO button. Do not ping
  while `offline`.
- `driver.inbox` open set:

  1. If the driver has a `lastH3` newer than 45s, `pickupH3 IN cellDisk(lastH3, 2)`
     (include null-`pickupH3` rows so old trips are not silently dropped
     during rollout — remove the null clause in a comment dated now, keep
     it for this build).
  2. Then `offerHeadsToward` as today.
  3. If the driver has **no** recent ping, keep today's global inbox so a
     simulator / desktop without geolocation still sees offers. Do not
     empty the inbox because Chrome denied location.

k=2 at res 8 is roughly a 1.5 km radius. That is the marketplace for this
build. Do not add a settings slider.

**Acceptance**

- Two browsers: rider requests a downtown pickup; driver pinged downtown
  sees the offer; a driver whose lastH3 is a disk away does not (unless
  their ping is stale — then they still see it, by the no-ping fallback).
- Heading filter still drops trips that end the wrong way.
- `SIMULATE_DRIVERS` still auto-matches when no human accepts.

**Verify (390×844)**

1. `/driver` go online with location allowed. Network tab shows
   `driver.pingLocation` on an interval. Going offline stops it.
2. Deny location: inbox still populates (fallback). No crash.
3. Existing accept → arrive → start → complete path unchanged.

---

### 3. Nearby cars from live pings (P0)

**Goal.** The three invented markers on the rider map are the most dishonest
pixels in the product. Replace them with drivers who have pinged recently
in the pickup disk. Empty is correct.

**Current LimeCab**

```ts
// limecab-app.tsx
if (state === "home" || state === "matching") list.push(...NEARBY_DRIVERS);
```

**Desired**

- `driver.nearby` **or** `places.nearbyDrivers` — protected is fine (the
  rider is signed in to book). Input: `{ latitude, longitude }`. Returns
  `{ latitude, longitude }[]` for drivers with `available=true`,
  `lastSeenAt` within 45s, `lastH3 IN cellDisk(toDriverCell(lat,lng), 2)`.
  Cap at 8. Do **not** return names, plates, user ids, or H3 strings.
  Positions may be snapped to cell center if that is less than ~150 m of
  jitter — either the real ping or the cell centroid, pick one and use it
  everywhere. Prefer cell centroid: the rider does not get to stalk a
  driver around a block before the match.
- Rider map `points` on `home` and `matching` use this list. Poll at 4s
  while those scenes are showing. After `request`, matching continues to
  show them until a driver is assigned.
- Zero results: draw none. Do not fall back to `NEARBY_DRIVERS`.

**Acceptance**

- `rg NEARBY_DRIVERS src/components src/app` is empty.
- A pinging available driver near the pickup appears as a `kind: "marker"`
  (existing car glyph). A driver two cities away does not.
- Signed-out / no pickup coords: draw none, do not query.

**Verify**

1. Rider home with no drivers on duty: map has the pickup, no extra cars.
2. Second browser: driver online downtown. Rider home downtown: a car
   appears within a few seconds, then vanishes if the driver goes offline
   (lastSeen ages out — do not require a websocket).

---

### 4. Favorite spots (P0)

**Goal.** A signed-in user can set Home, Work, and named custom spots.
Those chips on Home are *theirs*. An account with none shows an honest
empty, not Ava's Echo Park.

**Current LimeCab**

- Home chips + search recents + profile rows all read `SAVED_PLACES`.
- `/profile/places` is display-only.
- `SavedPlaces` already hides itself when `places.length === 0`.
- Search scene takes a `places` prop and shows it before the first
  keystroke (`location-search-scene.tsx`).

**Desired**

`places` router:

```
list        → { home, work, custom[], recents[] }
set         → { kind: "home"|"work"|"custom", label, address, lat, lng }
             home/work upsert per user; custom inserts
delete      → { id }  (custom only; clearing home/work is set-with-null
                       or a dedicated clear — pick upsert-empty: deleting
                       Home is `delete` where kind=home)
nearby      → { latitude, longitude, k?: 1 }  // §5
```

`recents[]` is **not** a table. Derive from the user's last 8 completed
(or cancelled-after-match) trips, unique by rounded address, newest first,
`source: "recent"`. Do not invent Pasadena.

Mapping onto `Place`:

```
home     → { id, label: "Home",  source: "saved", ... }
work     → { id, label: "Work",  source: "saved", ... }
custom   → { id, label,          source: "saved", ... }
recents  → { id, label: street,  source: "recent", hint: relative time }
```

Write `h3 = toSearchCell(lat, lng)` on every set.

**Surfaces — do not add a ServiceAppState.** Saving is not a booking
question. Use:

1. **Profile → Saved places** becomes the editor. Empty Home / Work rows
   with a "Set" action. Custom list + "Add a place". Tapping Set / Add
   opens the existing location search (a `TaskScene` / interrupt is fine;
   a new route `/profile/places/edit` is also fine). After a pick, mutate
   `places.set` and return. One question: *Which place is Home?*
2. **Search / pin, secondary.** On a search result row and on the pin
   scene action band, a quiet "Save" that opens a compact interrupt:
   Home / Work / "Name this spot" (one text field + save). Not next to
   Confirm. Confirm still books; Save does not progress the scene.
3. **Home chips** bind to `places.list`. SavedPlaces already no-ops on
   empty — that is the empty state. Optional one-line "Save Home and Work
   for faster pickup" that opens the profile editor, not a modal on Home.
   Home still asks one question (Where?).

Icons: `kind === "home"` → Home icon, `work` → briefcase, else pin. Today
`limecab-home-scene.tsx` keys on `place.id === "home"`. Switch to `kind`
(pass it through `Place` as optional `id` prefix `home:` / `work:` / uuid,
and keep `id === "home"` working by using those stable ids for the two
slots).

Driver heading presets: `Anywhere` + the **driver user's** Home / Work /
custom (same `places.list`, they are a `users` row). If they have none,
Anywhere is the only row — do not show Union Station.

Voice: after parse, if `destinationQuery` is `"Home"` or `"Work"`
(case-insensitive), resolve via `places.list`. Unset → existing "couldn't
find that" path, not Echo Park.

**Acceptance**

- New account: Home has no chips, search empty-query shows recents-or-
  nothing, profile Saved places shows two empty slots.
- Set Home to a Mapbox result. Home chip appears. Tap books to that
  coordinate. Reload: still there.
- Set a custom "Gym". It appears in search empty-query under Saved, not
  Recent.
- Delete Gym. Chip gone. Home/Work still there.
- Two users cannot see each other's spots.
- `/profile/places` no longer imports `SAVED_PLACES`.

**Verify (390×844)**

1. Sign in on a fresh user (or delete rows). Home: trigger + no Home/Work
   chips. Travel Mode off. Recents empty if they have no trips.
2. Profile → Saved places → Set Home → pick an address → back to Home →
   chip → ride select with that destination.
3. Search: star/save a result as custom → dismiss search → chip or saved
   row present. Pin scene Save → same.
4. Driver heading interrupt: only Anywhere + this user's spots.
5. "take me home" with Home set lands on that place; with Home unset does
   not invent Echo Park.

---

### 5. Search index (H3, not drawn) (P0)

**Goal.** Nearby / empty-query ranking is a k-ring on res 9. Typed search
stays Mapbox. The rider never sees a hex.

**Current LimeCab**

- Empty query: `places` prop (the mock array).
- Typed query: static fixtures **prepended** to Mapbox, capped at 6
  (`createPlacesAdapter`). That is why "gr" always suggests Griffith
  before the live geocoder.

**Desired**

- Stop prepending fixtures when Mapbox succeeds. Order: (1) saved +
  recents that fuzzy-match the query, (2) Mapbox suggestions. Cap 6–8.
  Static adapter only in the `catch`.
- Empty query / 1-character: saved (Home, Work, custom) then recents, as
  today. If the device/pickup has coords, `places.nearby` may insert
  matching **custom** spots whose `h3` is in `cellDisk(toSearchCell(lat,lng), 1)`
  above recents, labelled with a distance hint. Home/Work always stay
  pinned at the top regardless of cell — they are slots, not nearby POIs.
- `places.nearby` is the only search path that uses H3. It does not call
  Mapbox. It does not return hex ids to the client.
- Typed Mapbox results are **not** H3-filtered. A user typing "Big Bear"
  still gets Big Bear. Service-area failure stays the existing outside-
  area path.
- Travel Mode curated spots (§3 of GO–GET) stay fixture-backed and
  independent of this index.

**Acceptance**

- Typing "traction" with Mapbox configured does not force-lead with
  "Traction Ave, Arts District" from `GEOCODE_FIXTURES` unless Mapbox
  also returned it.
- A custom spot two blocks from pickup appears on empty search via nearby;
  a custom spot in another city does not, but still appears when its label
  is typed (saved fuzzy-match).
- No hex overlay, no cell ids in the DOM, no `h3` field on `Place`.

**Verify**

1. Empty search: Home/Work (if set), nearby customs, recents.
2. Type a Mapbox place that is not a fixture. It appears. Confirm books.
3. Type a fixture alias with Mapbox down (block `/api/map/places`):
   static fallback still answers. No blank scene.

---

### 6. Visual H3 on the driver map (P0)

**Goal.** While the driver is idle (offline or online, no offer, no job),
the map wears a lime hex lattice at **res 8**. It is how they read the
marketplace they are standing in. It recedes the moment an offer or a
route needs the streets.

**Current LimeCab**

- `MapboxCanvas` draws route + markers + pin. No polygon source.
- Driver map is `interactive={false}`, follow-cam on the device.
- `MapViewProps` has no overlay slot. `coverage` mode exists and is unused
  by the driver.

**Desired**

- Optional `coverage?: GeoJSON.FeatureCollection` on `MapViewProps`. The
  kit does not know what a hex is; it paints a GeoJSON fill+line if
  provided. Empty/undefined → today's canvas.
- `MapboxCanvas`: one `<Source id="limecab-coverage">` with two layers
  that **keep stable ids** (`limecab-coverage-fill`, `limecab-coverage-line`).
  Same lesson as the route layer — do not swap ids. Paint:

  ```
  fill-color: #c8f031
  fill-opacity: 0.06   (feature-state or property `emphasis: "self"` → 0.16,
                        `emphasis: "demand"` → 0.14)
  line-color: #c8f031
  line-opacity: 0.35
  line-width: 1
  ```

  Respect `prefers-reduced-motion`; this is paint, not animation. Do not
  add glow, pulse, or choropleth.
- Driver app builds the FeatureCollection **only** when
  `mapPosture === "idle"` (offline / online peek). `tracking` / `trip` /
  `receipt` / offer-up pass `coverage={undefined}`. The lattice must not
  sit under a navigation polyline.
- Cells: `viewportCells` from the current camera bounds if you have them,
  else `cellDisk(toDriverCell(device), 3)`. Property `emphasis`:
  `"self"` if cell === driver's `lastH3`; `"demand"` if any `inbox.open`
  pickupH3 equals that cell; otherwise omitted.
- Recompute on `moveend` / ping / inbox change, not on every `move`.
  Cap at ~80 features; if the viewport is huge (zoomed out), skip drawing
  rather than painting a state.

This is **not** `MapMode: "coverage"` unless that happens to be the
cleanest switch — idle driver stays `mode: "home"` so zoom/padding do not
jump. Coverage is data on the canvas, not a new posture.

**Acceptance**

- Offline and online idle: hexes visible, lime, quiet, driver's cell
  readable as *here*.
- Incoming offer: hexes gone, pickup line visible.
- Accept → to pickup: still gone. Complete → idle: back.
- Rider `/` : no hex source in the map style.
- HANDOFF-driver composition unchanged (avatar, shield, peek, GO).

**Verify (390×844 and 1280)**

1. `/driver` signed in, offline. Lattice over downtown (or the device
   fix). Pan is currently disabled — lattice still covers the framed
   area.
2. Go online. Lattice stays. Peek copy unchanged.
3. Trigger an offer (second browser request in-disk). Lattice gone,
   offer sheet + route as today. Decline: lattice returns with the peek.
4. Full job to complete: lattice only on the fare splash if posture is
   `receipt`? **No — receipt is `results`, no lattice.** Back to hunt:
   lattice returns.
5. Rider home: no hexes. `npx tsc --noEmit` clean.

---

### 7. Strip leftover dummy logistics (P1)

**Goal.** The app no longer *claims* a user has places they did not save.
Catalogue and simulation remain.

**Do**

- `limecab-home-scene.tsx` takes `saved` / `recents` as props (or a single
  `places: Place[]`) from `places.list`. Stop importing `SAVED_PLACES`.
  Keep importing `TRAVEL_SPOTS` for Travel Mode.
- Profile hero: `session.user.name`, not `RIDER.fullName`. Rating/since
  may stay mocked — out of scope — but do not use `RIDER` as the display
  name when the session has one.
- Pickup initial state: do not `useState(CURRENT_LOCATION)`. Use device
  geolocation when permitted (the recenter path already knows how);
  otherwise last-trip pickup; otherwise a camera fallback that is not
  submitted as the pickup address until the rider confirms a pin or a
  Places result.
- Places proximity bias: device / pickup coords, not the Grand & 5th
  constant. The constant may remain as the last-ditch camera center.
- `rg` the kill list in § Dummy data. Leave `mock.ts` exports if tests
  and the static geocoder still need them; they just must not reach a
  signed-in user's Home.

**Acceptance**

- Fresh account, Travel Mode off: Home is Where-to + empty saved + empty
  recent. No "Echo Park", no "Union Station", no "Yesterday".
- Fresh account map: no three phantom cars.
- Existing tests for voice aliases and quote math still pass.

**Verify**

1. Incognito / new user walk: sign in → Home → search → pin a place →
   save as Home → Home chip → book. Activity shows the real trip.
2. `npm test` `npx tsc --noEmit` `next lint`.
3. `/driver` idle still shows the lattice from §6.

---

## What we are **not** building

Leave these out unless a later handoff says otherwise:

- Surge, heatmaps, multipliers, choropleth, "busy area" copy
- Hexes on the rider map, hexes during a live job
- WebSockets / SSE (keep polling)
- Changing k or resolution from the UI
- A spots catalogue table (Travel Mode keeps `TRAVEL_SPOTS`)
- Killing `SIMULATE_DRIVERS`
- Replacing Mapbox Places with H3 (H3 does not geocode)
- Payment, Ava's rating, documents, earnings payout mocks
- Airport queues, destination-filter radius editor
- Driver-to-driver cell chat, idle-time stats
- `posts` router cleanup (T3 leftover, not this)

---

## Invariants (do not violate)

- Two resolutions, two jobs. Res 8 is seen by drivers and used for
  ping / inbox / nearby cars. Res 9 is stored on saved places and used
  for nearby search. Never drawn.
- No surge. Emphasis on a hex is occupancy (I am here / a request is
  here), not price.
- The kit does not import `h3-js` or the word "hex". Coverage is GeoJSON.
- Saved places are per `users.id`. Home and Work are slots. Custom is a
  list. Recents are derived from trips.
- Empty is honest. Missing Home is missing Home.
- Inbox without a fresh ping degrades to today's global list, not to
  zero offers.
- Simulation still cannot overwrite a human accept.
- One question per scene. Save-a-place is an interrupt or a profile
  subpage, never a second control on quote/confirm.
- Named surface actions only. Do not restyle the driver shell.
- Task map stays un-rounded, under the sheet, padding from `--sheet-snap`.
- No `--token` on Vercel CLI.

---

## Key files

| Concern | File |
|---|---|
| H3 wrapper + tests | `src/lib/limecab/h3.ts`, `h3.test.ts` |
| Schema | `src/server/db/schema.ts` |
| Favorites + nearby search | `src/server/api/routers/places.ts` (new), `src/server/api/root.ts` |
| Ping + H3 inbox + nearby cars | `src/server/api/routers/driver.ts` |
| Write `pickupH3` | `src/server/api/routers/trip.ts` |
| Dummy inventory | `src/lib/limecab/mock.ts` |
| Places adapter (stop prepend) | `src/lib/limecab/places.ts` |
| Rider Home chips | `src/components/limecab/limecab-home-scene.tsx` |
| Rider map cars, pickup seed, search `places=` | `src/components/limecab/limecab-app.tsx` |
| Save from search/pin | `src/components/service-app/location-search-scene.tsx` (slot, no H3), `limecab-app.tsx` / interrupts |
| Profile editor | `src/app/profile/places/page.tsx` |
| Driver ping + coverage prop + heading from real places | `src/components/limecab/driver-app.tsx` |
| GeoJSON overlay | `src/lib/service-app/map-adapter.ts`, `src/components/service-app/mapbox-canvas.tsx` |
| Voice Home/Work resolve | `src/lib/limecab/voice-booking.ts` (aliases stay), `limecab-app.tsx` (resolve) |
| Seed (untouched except it must not re-invent saved places) | `src/server/limecab/seed-drivers.ts` |

---

## Suggested build order inside a section

Tests for the H3 wrapper and for `places.set` / inbox disk filtering
before the UI. `db:generate` as soon as schema lands so later sections
are not typing against columns that do not exist. Visual hex last among
the P0s that feed it (`lastH3` and `pickupH3` have to be real or the
emphasis properties are lies).

## Picking up mid-way

If a previous agent stopped:

1. `src/lib/limecab/h3.ts` exists with tests → §1 done.
2. `saved_place` table + `drivers.lastH3` in schema → §2 in progress.
3. `places.list` returns [] for a new user and Home chips are gone → §4
   mostly done; finish Save from search.
4. Driver idle map shows lime hexes → §6 done; strip remaining
   `SAVED_PLACES` imports (§7).
