# Handoff: driver home UX (Uber operating model)

**Status: shipped 2026-08-28** (idle UX + P1 wiring fixes in follow-up commit).
Screenshots 2026-08-27, in `.ux-bugs/refs/uber-driver/`. This is a **composition pass on idle duty**,
not a rebuild of offers or live jobs, and not a restyle of rider Home.

`src/app/driver/page.tsx` stays the **gate** (load / register / `DriverApp`).
Do not dump this UX into `page.tsx`. The product lives in
`src/components/limecab/driver-app.tsx` and the duty scenes.

```
CLAUDE BRIEF
============
You are matching LimeCab Driver's *idle* UX to Uber Driver's operating
model from the screenshots in .ux-bugs/refs/uber-driver/. Read this whole
file and look at every PNG before writing code.

Read first:
  .claude/skills/surface-orchestration/SKILL.md
  .claude/skills/adaptive-surfaces/SKILL.md
  .claude/skills/scene-preparation/SKILL.md
  .claude/skills/perceived-performance/SKILL.md
  .ux-bugs/HANDOFF-driver.md        (offer + job — do not redo)
  .ux-bugs/HANDOFF-surfaces.md      (sheet/map contract — do not redo)
  .ux-bugs/HANDOFF-logistics.md     (H3 data contract — use it, don't invent
                                     a second grid)

Named surface actions only. One question per scene. Interruptions suspend;
they do not unmount.

Do not:
  - Copy Uber blue, Uber orange, the Uber logo, "Uber", "Waybill", restaurant
    fork pins, or a 5-tab bar with Discover/Inbox we do not have
  - Touch offer, accept, to_pickup, at_pickup, on_trip, complete
  - Unmount the map when going online (home card → task canvas is a layout
    switch on the same ServiceMap)
  - Add DriverAppState members for "trends" / "recommended" / "prefs"
    (those are asides / routes, like heading and safety)
  - Invent surge multipliers, fake neighborhoods, or Eats demand
  - Put a keyboard search field on driver Home
  - Commit unless asked

Implement sections 1–6 in order. Verify each at 390×844 before moving on.
tsc --noEmit and existing tests stay green.
```

**Screenshot index** (open these; they are the spec):

| File | Uber screen | LimeCab target |
|---|---|---|
| `01-offline-home.png` | Offline Home tab | §1 offline `layout="home"` |
| `02-offline-going-online.png` | Go Online pending | §1 lock + spinner on the pill |
| `03-online-hunting.png` | Online, map-first peek | §2 `layout="task"` hunting |
| `04-online-recommended.png` | Expanded “Recommended for you” | §3 expanded idle sheet |
| `05-trends-map.png` | Earnings Trends on the map | §4 demand overlay + §5 trends aside |
| `06-trends-charts.png` | Earnings Trends list + day chips | §5 charts |
| `07-preferences.png` | Preferences | §6 |

Copy the **information hierarchy and postures**, not the skin.

---

## What Uber is doing (the model)

Uber Driver is two products on one map:

1. **Off duty is a home.** Headline, a *map card* (not a full-bleed canvas),
   a short opportunities list, one loud **Go Online**, tabs. The driver is
   still in the house. They glance at where it is busy, then they decide.
2. **On duty is the map.** Full-bleed canvas, floating earnings, a *peek*
   that is status (time of day + “check the map”), not a question with two
   primaries. Preferences and a list live as icons on that peek. Going
   offline is a deliberate expanded sheet with a circular stop — not a ghost
   button in the peek.

LimeCab today does (1) wrong: offline and online are the **same peek** over
a full-bleed map (`DriverDutyScene`). That is why it feels like an inbox
skin on a canvas. Offer + job (HANDOFF-driver) are already right. Leave
them.

```
offline  →  ServiceAppShell layout="home"   map is a rounded card
online   →  ServiceAppShell layout="task"   map is the background
offer    →  unchanged interrupt
job      →  unchanged sheets
```

The map **stays mounted**. `layout` is the only switch. Same rule as rider
Home → task.

---

## What exists today

- `/driver` → `DriverApp` after register (`src/app/driver/page.tsx`).
- `DriverDutyScene`: status + today $ + heading chip + Go online / Go
  offline in `SheetActions`. Used for **both** `offline` and `online`.
- Shell is always `layout="task"` in `driver-app.tsx`.
- `DriverChrome`: `/driver` has `--service-app-chrome: 0rem`; profile
  routes are the padded column.
- Preferences: `/driver/profile/preferences` is four honest-empty
  switches from `DRIVER_PREFERENCES`.
- Earnings: `/driver/profile/earnings` is a document of completed trips.
- H3: specified in HANDOFF-logistics (`DRIVER_H3_RES = 8` visual,
  `SEARCH_H3_RES = 9` search). If `src/lib/limecab/h3.ts` is not in the
  tree yet, **implement logistics §1 (wrapper + tests) as part of §4
  here** — do not paint a heatmap without cells.

---

## Colour and copy (non-negotiable)

| Uber | LimeCab |
|---|---|
| Go Online blue pill | Primary lime button, same size (h-14–16, full width, pill) |
| Heatmap yellow→red | Lime fill on H3 cells. Quiet `0.06–0.22` opacity. No red choropleth |
| Surge `>>` chevrons | Optional lime circular marker on cells that currently have an **open request**. No “1.4x” |
| “Deliveries” | Courier (we have it) |
| Restaurant fork pins | **Do not draw.** We are not Eats. Courier pickups from *real* open trips may use a package glyph |
| “Waybill” | Omit |
| Discover / Inbox tabs | Omit. Four tabs max: Home, Trends, Earnings, Account |
| “You're offline” / “Ready to go?” | Keep that pair — it is the offline question |
| “It's dinner time” | Daypart from local hour (see §2). Not a second question |

---

### 1. Offline Home — map card, not a canvas (P0)

**Screenshot:** `01-offline-home.png`, `02-offline-going-online.png`.

**Goal.** `scene === "offline"` uses `layout="home"`. The driver reads a
document with a live map card, then taps Go Online.

**Current:** full-bleed map + peek “Off duty” + power button.

**Desired composition (mobile)**

```
[ safety FAB ]     [ preferences FAB ]     top trailing, over the page (not the map)
You're offline                             display 34–40px, bold
Ready to go?                               20–24px, bold, not muted

[ map card, rounded-3xl ]                  expand control top-trailing *inside* the card
  H3 demand (§4) + driver glyph
  tap expand → go online? NO. Expand only
  switches layout to task while STILL offline
  (see below). Go Online is the pill.

Opportunities                              row, chevron → trends aside (§5)
  Earnings                                 chart icon
  Earnings trends near you                 subtitle from current cell label
                                           or “Not enough trips yet”

[ Go Online ]                              lime pill, steering/power icon
                                           lock + spinner while setAvailable
                                           (02-offline-going-online.png)

[ Home | Trends | Earnings | Account ]     driver tab bar, offline only
```

`onMapPress` on the home card: same as expand — `layout="task"` while
`scene` stays `offline`, so they can pan the demand map without going on
duty. A house / back control on that canvas returns to `layout="home"`.
**Going online is only the pill.** Do not make tapping the map a duty
change.

Surface recipes:

- Offline document: no `ServiceSheet`. Home layout’s children *are* the
  launcher (headline, opportunities, CTA). Do not wrap them in a drawer.
- Offline expanded map: `layout="task"`, peek or no sheet, house control
  returns home. Still `scene === "offline"`. Track expanded-map as **app
  data** (`mapExpanded: boolean`), not a scene. Named action
  `expandIdleMap` / `collapseIdleMap` in `driver-surfaces.ts`.

Avatar: Uber puts safety + filters top-right and uses tabs for account.
LimeCab: keep a small avatar or put Account on the tab bar. Do not add a
sticky “LimeCab Driver” header on `/driver` (DriverChrome already
correctly gives the duty route 0rem chrome). Tab bar needs
`--service-app-chrome` (~5.5rem) **on offline home only**.

**Acceptance**

- Offline first paint is a white/paper column with a rounded map card.
  Not a sheet over a full-bleed map.
- Go Online: visual lock immediately; spinner on the pill; on success the
  shell becomes `layout="task"` and §2 hunting chrome without remounting
  Mapbox (camera survives).
- Deny geolocation: card still shows a city camera; no crash.
- Register form on `page.tsx` is unchanged.

**Verify (390×844)**

1. `/driver` signed-in, off duty: headline pair, map card, opportunities,
   lime Go Online, four tabs. Screenshot 01 hierarchy.
2. Tap Go Online: pill spins (02). Lands on §2. Map does not blink to a
   different token/style.
3. Desktop: home two-column (shell already does this) — headline/CTA left,
   large map right.

---

### 2. Online hunting — full-bleed + peek (P0)

**Screenshot:** `03-online-hunting.png`.

**Goal.** Once available, the map is the app. The peek is *status*, not
Go Offline.

**Peek anatomy, left to right, one row:**

```
[ sliders ]     It's dinner time              [ list ]
                Check map for busy areas
```

- Sliders → `/driver/profile/preferences` (or an interrupt that renders
  the same content). Interruption; hunting peek suspends.
- List → §3 recommended (named action `openRecommended`, presentation
  `expanded`).
- Center copy from `daypart(now)` — pure helper, tested:

  | Local hour | Headline | Sub |
  |---|---|---|
  | 05–10 | It's morning | Check the map for busy areas |
  | 11–14 | It's lunch time | Check the map for busy areas |
  | 15–16 | Afternoon lull | Check the map for busy areas |
  | 17–21 | It's dinner time | Check the map for busy areas |
  | else | Looking for rides | Offers will show up here |

  Online’s `driverAppQuestion.question` may stay “Looking for rides” for
  a11y; the peek *display* uses daypart. Do not put two headlines.

**Map overlay (task, idle online only):**

```
[ house ]                    [$12.40 ▾]                 top
   collapse to offline home     todayCents, lime/green
   WITHOUT going offline        tabular-nums, black pill
                                tap → /driver/profile/earnings

[ shield ]                                          [ charts ]
   existing safety aside                              opens §5 trends
```

House: `layout="home"` while staying `online` is **wrong** (Uber’s house
on this screen is “Home tab”, which *is* this map). LimeCab house on the
online map: no-op or recenter. Prefer **recenter** (we currently force
`interactive={false}`). Making the online map pan-able is in scope if it
does not fight follow-cam on a job — idle only: `interactive={true}`
while `scene === "online"` and no offer. Recenter FAB if they pan.

Do **not** put Go Offline on this peek. That is §3.

Heading chip: Uber hid it on this frame. Keep it reachable from
preferences / recommended, not as a third peek control. A driver on a
dash cannot use three chips.

**Acceptance**

- Online idle: full-bleed map, demand overlay, earnings pill, peek is
  daypart + two icons. No power button on the peek.
- Offer interrupt still covers this peek and restores it (HANDOFF-driver).
- Going into a job hides demand overlay (logistics: lattice recedes on
  tracking/trip).

**Verify**

1. After Go Online: 03 hierarchy. Peek does not include Go Offline.
2. Incoming offer: unchanged. Decline: peek + overlay restored.
3. Earnings pill matches `todayCents`. Tap opens existing earnings route;
   back returns to hunting (driver still online).

---

### 3. Recommended + Go Offline (P0)

**Screenshot:** `04-online-recommended.png`.

**Goal.** The list icon expands the idle sheet. This is where duty ends.

**Sheet (expanded, still `scene === "online"`):**

```
[ chevron down ]     Recommended for you      [ list, selected ]
Later today
  See earnings trends        → §5
  See upcoming opportunities → honest empty: "No promotions right now"
  See driving time           → hours online today if we have lastSeen
                               pings; else omit the row (do not fake 0)

                               no Waybill row

thumb zone:
[ sliders ]     ( ( stop ) )      GO OFFLINE
                circular, ~72px
                destructive ring + hand/stop icon
                caption GO OFFLINE under it
```

Named actions: `openRecommended` (expand), `closeRecommended` (return to
peek). `goOffline` is the existing mutation + `go_offline` event, fired
only from this circle (and not from the peek).

Do not build Uber’s giant GO *online* circle. Offline CTA stays the lime
**pill** on Home. The circle is **stop**, online only.

**Acceptance**

- List on peek opens this sheet; chevron / swipe down returns to peek;
  driver remains online.
- GO OFFLINE → `setAvailable(false)` with lock on the circle → `offline`
  + `layout="home"` (§1). Map stays mounted.
- Opportunities row with nothing to say is omitted or honest-empty, never
  “Rosemead/Garvey” invented.

**Verify**

1. Online → list → 04. Tap trends row → §5. Back to recommended.
2. GO OFFLINE → §1 offline home. Inbox stops hunting poll.

---

### 4. Demand overlay (H3 visual) (P0)

**Screenshots:** `03`, `05`. Logistics §6 is the data contract; this
section is the **look**.

**Goal.** Idle maps (offline card, online canvas, trends aside) show res-8
cells filled by **how busy that cell has been**, not a decorative grid and
not Uber’s orange blobs.

**Data (honest):**

- Weight a cell by open `requested` trips whose `pickupH3` is that cell,
  plus completed trips in that cell in the last 7 days (count, not $).
- `driver.demand` query: `{ west,south,east,north }` or `{ latitude,
  longitude }` → `{ h3, openCount, weekCount, label }[]`. Cap ~80.
- `label`: locality from the most common pickup address in that cell
  (`splitAddress` city/line), or omit. Never hardcode “Rosemead/Garvey”.
- Empty market: draw the lattice at fill 0.06 anyway (so the grid is
  visible). That is logistics. Do not paint random hot spots.

**Paint (Mapbox, stable layer ids — same lesson as the route line):**

```
limecab-coverage-fill   fill-color #c8f031
                        fill-opacity 0.06 + min(0.20, 0.04*(openCount+weekCount))
limecab-coverage-line   line-color #c8f031  opacity 0.35  width 1
```

Driver’s `lastH3`: slightly louder. Cells with `openCount > 0`: a lime
circular marker with a double-chevron **or** just the louder fill — pick
one, not both. No dollar, no “surge”, no color ramp to red.

Coverage GeoJSON on `MapViewProps` as logistics specified
(`coverage?: FeatureCollection`). Rider maps pass nothing.

Visible when: offline (card + expanded), online idle, trends aside.
Hidden when: offer, to_pickup, at_pickup, on_trip, complete.

**Acceptance**

- Rider `/` has no coverage source.
- Two open requests downtown: those cells read louder than empty ones.
- Zero history: quiet lime lattice, still hexagonal, not a heatmap blur.

**Verify**

1. Offline card shows hexes.
2. Online hunting shows hexes; accept a job → hexes gone, route visible.
3. `prefers-reduced-motion` does not pulse fills.

---

### 5. Earnings trends (P1)

**Screenshots:** `05-trends-map.png`, `06-trends-charts.png`.

**Goal.** Charts icon / Opportunities row / Recommended “See earnings
trends” open a **trends aside** on the same map (interrupt). Not a new
`DriverAppState`.

**Map mode (05):**

- Back (closes aside) top leading; “See charts” pill top trailing
  (scrolls the sheet to the list / snaps expanded).
- Recenter control bottom trailing.
- Neighborhood labels **on the map** only for cells that have a `label`
  and weekCount ≥ 1. Do not label every hex.
- Sheet peek:

  ```
  Earnings Trends
  {current cell label or “Your area”}
  Showing trip trends
  [ Hourly trends card — bar chart ]
  [ Go online ]     only if scene is offline; else omit
  ```

**Charts (06):** same aside, expanded (or a TaskScene). Day chips
(Sun–Sat, today selected). Cards: area label, “Current area” or
`{n} mi` from driver ping, chevron-up jumps the camera to that cell,
hourly bars 4am→3am with **this hour** in lime, others muted.

Bars from `driver.trends`: completed trips bucketed by pickupH3 + weekday
+ hour. If the driver has no completed trips, **one** card: “Your area”
with a flat empty chart and copy “Trends fill in as you complete trips.”
Do not seed LA neighborhoods.

Hourly chart: CSS flex bars, no chart library.

**Acceptance**

- Open from offline Opportunities, online charts FAB, and Recommended.
- Back restores the exact idle posture (home vs hunting).
- Day chip changes which buckets render; empty day is empty cards, not
  yesterday’s data relabelled.

**Verify**

1. Fresh driver: empty-state card, no fake Rosemead.
2. After some completed trips: a card for that cell, current hour lime.
3. Chevron on a card pans the map; sheet stays.

---

### 6. Preferences (P1)

**Screenshot:** `07-preferences.png`. Existing route
`/driver/profile/preferences`.

**Goal.** Same URL, Uber’s information order, LimeCab’s actual filters.

```
← Preferences
[ Open to all trips ]          lime-tint banner when no heading and
                               courier+rides both on; otherwise
                               “Filtered” + one-line why

Services
  [ Ride ]  [ Courier ]        selectable cards, black/lime ring + check
                               Ride = not courier-only; Courier =
                               existing courierJobs preference
                               Do not add Deliveries-as-Eats

Trip filters
  Heading                      value: Anywhere / address  → existing
                               setHeading interrupt or search
  Lime XL                      existing switch
  Longer trips                 existing switch
  (omit Accept Cash, Shop & Deliver, max distance — we do not have them)

[ Reset ]                      clears heading, all service toggles on
```

Sliders on §1 and §2 open this route. Profile still links here.

Switches that are still display-only stay honest (navigation voice
already is). Do not pretend Reset persists server-side fields you did
not add. Persist heading + whichever flags already have a mutation;
if XL/long/courier are still mock `defaultChecked`, either wire a
`driver.setPreferences` **or** leave them local and say so in a
ProfileNote. Prefer a small JSON column / three booleans on `drivers`
if you touch the schema — do not keep editing `mock.ts`.

**Acceptance**

- Visual match of 07: banner, service cards, list rows, Reset pill.
- No cash / shop-and-deliver rows.
- Heading change still filters `inbox.open` (`offerHeadsToward`).

**Verify**

1. From online peek sliders: preferences document, back to hunting
   (still online).
2. Toggle Courier off: courier offers stop appearing (if wired) or the
   note says they are display-only — do not silently lie.

---

## Driver tabs (offline + account)

Uber’s five tabs are a different app. LimeCab driver tabs, **offline home
and `/driver/profile*` only**:

| Tab | Target |
|---|---|
| Home | `/driver` |
| Trends | opens §5 aside if already on `/driver`, else `/driver` + query `?trends=1` |
| Earnings | `/driver/profile/earnings` |
| Account | `/driver/profile` |

Hidden on `layout="task"` hunting, on offers, and on jobs — the dash
does not get a tab bar. `DriverChrome` draws them when
`pathname !== "/driver" || scene === "offline"` — chrome cannot see
scene. So: `DriverApp` renders the tab bar itself on offline home;
profile routes keep a compact tab bar in `DriverChrome` (or a small
`DriverTabBar` shared component).

Do not resurrect the rider tab capsule on `/driver`.

---

## Surfaces (named actions to add)

Add to `driver-surfaces.ts` / `driverSurfaces.actions` — do not set
drawers yourself:

| Action | Intent | Meaning |
|---|---|---|
| `expandIdleMap` | interrupt or progress on map presentation | offline, card → full canvas |
| `collapseIdleMap` | return | canvas → card, still offline |
| `goOnline` | progress | existing duty; also `layout` task |
| `goOffline` | progress | existing; also `layout` home |
| `openRecommended` | interrupt | expand hunting sheet |
| `closeRecommended` | return | peek |
| `openTrends` | interrupt | trends sheet + coverage emphasis |
| `closeTrends` | return | prior idle |
| `openHeading` / `openSafety` / `closeAside` | keep | already exist |

`DRIVER_SCENE_SURFACES.offline` must not force a peek sheet on home
layout. Home layout ignores the drawer — keep the recipe valid for the
expanded-offline-map case (`layout="task"` + peek optional).

---

## What we are **not** building

- Uber Pro, quests, airport queues, waybills, instant pay processing
- Eats restaurant pins, shop-and-deliver, cash trips
- Heatmap blur shaders, red choropleth, surge pricing
- WebSockets
- A second map instance for trends
- Changing offer/job scenes, countdown, chime
- Rider app changes

---

## Invariants

- `page.tsx` is a gate. UX is `DriverApp`.
- Offline = home layout. Online idle = task layout. Jobs stay task.
- One mounted map across that switch.
- Go Online is a lime pill on Home. Go Offline is a circular stop on
  Recommended. Neither appears on the other’s surface.
- H3 res 8 is what the driver sees. Res 9 is search (logistics). No
  third resolution.
- Empty demand is a quiet lattice, not invented busy areas.
- Offer interrupt still suspends the hunting peek.
- No `--token` on Vercel CLI.

---

## Key files

| Concern | File |
|---|---|
| Gate only | `src/app/driver/page.tsx` |
| Layout switch, chrome, asides | `src/components/limecab/driver-app.tsx` |
| Offline launcher + hunting peek + recommended | `src/components/limecab/driver-scenes.tsx` |
| Named actions | `src/components/limecab/driver-surfaces.ts` |
| Chrome / tabs | `src/components/limecab/driver-chrome.tsx` |
| Coverage GeoJSON | `src/components/service-app/mapbox-canvas.tsx`, `map-adapter.ts` |
| H3 | `src/lib/limecab/h3.ts` (logistics §1 if missing) |
| Demand / trends API | `src/server/api/routers/driver.ts` |
| Preferences | `src/app/driver/profile/preferences/page.tsx` |
| Daypart | `src/lib/limecab/daypart.ts` + test |
| Screenshots | `.ux-bugs/refs/uber-driver/*.png` |

---

## Suggested order

§1 layout switch + offline document (can ship with a quiet map, no
weights). §2 hunting chrome. §3 recommended + circular offline. §4 H3
weights on those maps. §5 trends aside. §6 preferences. Offer a job
between §2 and §3 to prove the interrupt still works — if it doesn’t,
stop and fix before Recommended.
