# Handoff: Lime Help + Lime Shop

**Status: shipped 2026-08-28.** All four slices are in and were walked in the
browser at 390×844. The spec below is now the *reference* for what the code
means, not a work order — read "What shipped" for where each piece lives and
"Picking back up" for what is deliberately still out.

Original framing, kept because it still governs changes: do not treat this as
a surfaces, driver-shell, logistics, or GO–GET rebuild. Those handoffs already
shipped. Do not invent hotels, membership, a second geocoder, or a second
map/sheet stack.

---

## What shipped

Everything below is live behind the existing chrome. `ServiceAppState` and
`DriverAppState` did not grow a member; there are no new tables.

### Slice 1 — Shop list on courier

| Piece | Where |
|---|---|
| List model, zod schema, parse/normalize/summary (+7 tests) | `src/lib/limecab/shop-list.ts`, `.test.ts` |
| `trips.itemList` — JSON text, nullable, Shop only | `schema.ts`, migration `0006` |
| `courier.itemList` on the wire; empty array rejected | `routers/trip.ts` |
| `SHOP_OPTIONS` — courier options minus fulfillment / item text / count | `lib/limecab/courier.ts` |
| The list editor (rows, note, cap 12, add-another) | `limecab-shop-scene.tsx` |
| `openShopSearch` / `shopSelected` | `components/limecab/surfaces.ts` |
| Job sheet renders the list; "Got the list", no merchant code | `driver-scenes.tsx`, `driver-app.tsx`, `routers/driver.ts` |
| Offer subtitle "Shop · N items"; complete splash honest-empty | `driver-scenes.tsx` |

Shop is `BookingMode "shop"` on `courier-*` products. A courier trip *with a
list* is a Shop trip — that is the only discriminator, client and server.

### Slice 2 — Category shop search

- `MAP_CATEGORIES` / `SHOP_CATEGORIES` widened the existing union in
  `rest-stops.ts`; `restStopsFromFeatures` is still the only mapper.
- `/api/map/category` `ALLOWED` is now every category in that union.
- `fetchNearbyShops` in `places.ts`, with `SHOP_PLACES` (real LA stores) as
  the Mapbox-down fallback, so the scene never renders empty.
- Entry: `/?service=shop`, the Shop tile on `/services`, the ribbon, and One
  Search intent `store` — which now lands on the **list**, not the one-line
  buy field.
- The store search opens with an empty field: the rider's own pickup is not a
  candidate for "which shop?".
- `MapPoint.category` in the kit is an open string token; the marker draws the
  glyphs it knows. No product names moved into `components/service-app/`.

### Slice 3 — Lime Help (light tasks)

| Piece | Where |
|---|---|
| Products, daytime slot filter, labels, Care rules (+7 tests) | `src/lib/limecab/help.ts`, `.test.ts` |
| `trips.scheduledAt`, `drivers.helpJobs`, `helpAcknowledgedAt` | `schema.ts`, migration `0007` |
| Visit fare `estimateFare(product, 0, 60)` — server *and* quote | `routers/trip.ts`, `limecab-app.tsx` |
| When (reused clock, Help copy + slots), Kind (two tiles + note) | `limecab-when-scene.tsx`, `limecab-help-kind-scene.tsx` |
| Explainer interrupt, prefs card, post-register question | `driver-help-optin.tsx`, `driver-preferences.tsx`, `app/driver/page.tsx` |
| Inbox: Help offers only with `helpJobs`; ride filters skipped | `routers/driver.ts` |
| Visit duty copy: arrive at the house → start → complete | `driver-state.ts`, `driver-scenes.tsx` |

Pickup = destination = the house. One pin, one address in the route bar, the
itinerary, the offer card and the job chip — `MapRouteBar` and `Itinerary` now
render a single point when there is no second end. `ridePinRequired` returns
false for Help, so nothing gates the start on digits; the rider may still show
the PIN ("Show this if you want to confirm it's them").

### Slice 4 — Care

- `CARE_RULES_VERSION` + the seven rules in `help.ts`; `careAckCurrent()` is
  the gate both the inbox and the prefs card read.
- `drivers.careJobs`, `careRulesVersion`, `careAcknowledgedAt` (migration
  `0008`).
- `driver.acknowledgeCareRules` is the **only** writer of those three, and
  writes them together. It refuses a stale version, a short walk, or Help off.
  `setPreferences` accepts `careJobs: z.literal(false)` only — a lone
  `careJobs: true` from a client is not consent and cannot be sent.
- Dropping Help drops Care and clears the acknowledgement with it.
- `CareRulesSurface` walks one rule per surface, each with its own **I
  understand**; Back revises; **Enable Care jobs** exists only on rule 7. The
  index is content inside one interruption, reset on dismiss.
- Inbox excludes `lime-care` unless `careJobs && careRulesVersion` is current.
  Verified live: same open trip, current version → Care offer with **Care · in
  the home** as loud as the fare; stale version → no offer at all.

### Scene machine

Two context flags were added to the kit — named by effect, no product names:

```ts
locationAfterConfigure?: boolean; // the place is asked for after the options
selectAfterConfigure?: boolean;   // which service is asked after the options
```

`afterIntent`, `configure_done`, `select_service`, `cancel_search` and every
`backServiceAppState` branch read them. Shop sets `locationAfterConfigure`
only once the store is picked (so back out of the *first* search is home, and
out of the drop-off search is the list). Help sets both, statically.
`state.test.ts` covers both chains forward and backward, plus a plain ride.

```
CLAUDE BRIEF
============
You are implementing Lime Help and Lime Shop on LimeCab as it exists: web
rider + the current driver duty session. Read this whole file before
writing code.

Read first:
  .claude/skills/surface-orchestration/SKILL.md
  .claude/skills/adaptive-surfaces/SKILL.md
  .claude/skills/scene-preparation/SKILL.md
  .claude/skills/perceived-performance/SKILL.md
  .ux-bugs/HANDOFF-surfaces.md   (state doc — do not redo)
  .ux-bugs/HANDOFF-driver.md     (duty session — extend, do not rebuild)
  .ux-bugs/HANDOFF-goget-2026.md (Reserve When? + courier buy-for-me — reuse)
  .ux-bugs/HANDOFF-logistics.md  (places / H3 — do not redo)

Named surface actions only. One question per scene. Interruptions suspend;
they do not unmount. No independent drawer / map / footer choreography.

Ponytail: fewest new product ids, fewest new tables. Prefer columns/flags
on `trips` + `drivers`. Shop is courier with a list and a store. Help is
a scheduled house visit, not a ride with a different icon.

Do not:
  - Re-derive the sheet/map contract in HANDOFF-surfaces.md
  - Rebuild /driver (driver-app.tsx, driver-scenes.tsx, driver-surfaces.ts,
    driver-state.ts, driver-chrome.tsx). Add copy + an opt-in path; keep
    the six duty scenes.
  - Rename Assist (coming_soon, "extra help getting in") into Help.
    Assist is ride accessibility. Help is someone coming to the house.
  - Add Expedia/hotels, Uber One, a shopper marketplace, barcode scanning,
    or a real LLM vendor
  - Put a keyboard search field on Home
  - Add useState booleans that name screens (showCareRules, shopListOpen, …)
  - Add `kind: "list"` to `lib/service-app/options.ts`. List UI lives in
    LimeCab, still inside the `configure` scene.
  - Put product names (Help, Shop, Care) inside `components/service-app/`
    or `lib/service-app/`
  - Commit unless asked

Implement in the order at the bottom. Verify each slice in the browser
(390×844) before moving on. tsc --noEmit and existing tests must stay green.
```

---

## What this is

Two products. One trip row. One driver duty session.

| Product | Rider question | What the provider actually does |
|---|---|---|
| **Lime Help** | Schedule someone to come to the house. | Light household tasks, **or** Care (companionship / daily living). Not a ride. |
| **Lime Shop** | Pick a shop, make a list, send a courier. | Courier buys from that list at that store, then delivers. |

Uber-shaped analogues (for operating-model only, not branding): scheduled
home services; Shop for Me / a grocery list on a courier job. Size both
to LimeCab: LA fixtures, Mapbox Places / Category Search, no item catalog,
no medical license, no reimbursement ledger.

---

## Non-negotiable (do not bargain)

### Lime Help

- **Scheduling, not on-demand only.** First question: *When?* Then *what
  kind?* Then *where?* Do not start Help with a live “4 min away” car.
- **Light tasks vs Care are distinct.** Care is not rideshare with a
  different icon. Two product ids under one `/services` tile. Different
  inbox gates.
- **Driver opt-in copy must explain Help in plain language before the
  flag flips.** A silent `SettingSwitch` is not consent.
- **Care: numbered rules, each with its own acknowledge control.** Not a
  wall of text + one checkbox. Persist ack: who, which rules version,
  when. Cannot receive Care jobs without a current ack.
- **No medical advice. No lifting beyond the stated limit. Overnight is
  OUT** (do not offer it; do not add a duration that crosses midnight).

### Lime Shop

- **Search a shop** with Mapbox Category / Places (grocery, pharmacy,
  supermarket). Reuse `/api/map/category` + `places.ts`. Do not stand up
  a second geocoder.
- **Rider makes a list** (items + optional notes). The courier buys from
  that list. The list **is** the order. Do not fake barcode scanning,
  aisle maps, or SKU prices.
- **Payment: honest.** Quote is the **transport fare** (`estimateFare`,
  same as courier). Item cost is paid in store by the courier. This
  build has **no reimbursement / receipt-capture money path** — mark it
  OUT, show one footnote, do not invent a paid-out ledger.
- **Driver/courier sees the list on the job sheet.** If they cannot see
  the list, Shop is not shipped.

---

## What exists today (do not polish this)

### Catalogue

`src/lib/limecab/mock.ts`:

| Id | What it is | Status |
|---|---|---|
| `lime`, `lime-xl`, `lime-comfort`, `lime-pool` | Immediate rides | available |
| `lime-reserve` | Book-ahead ride | available |
| `courier-small`, `courier-medium`, `courier-large` | Same-day delivery | available |
| `LIMECAB_SERVICES`: ride, reserve, courier, **assist** | Assist = “Extra help getting in” | assist is **coming_soon** |

Do **not** flip Assist. Do **not** reuse `assist` as house Help.

### Courier (Shop’s substrate)

- Configure: size, quantity, recipient, proof, instructions, plus
  GO–GET §6 `fulfillment: packed | buy` and a single `itemDescription`
  (`src/lib/limecab/courier.ts`, `LimeCabConfigureScene`).
- Trip extras already on the row: `recipientName`, `recipientPhone`,
  `packageCount`, `deliveryProof`, `deliveryPin`, verification timestamps
  (`schema.ts`). `fulfillment` and the item text are **not** columns —
  buy-for-me is crammed into `pickupMeetingPoint` as `Buy: …`.
- One Search “Get from a store” (`search-intent.ts`, intent `store`)
  already sets courier pickup to that place and lands on configure.
- Driver job sheet already branches on `isCourierProduct`: Merchant /
  Deliver to, pickup code, recipient PIN (`driver-scenes.tsx`).
- Inbox already filters `courierJobs` (`driver.ts`).

Shop is this path with a **store + a list**, not a new vertical enum
and not a new trip table.

### Reserve (Help’s schedule substrate)

- `/?service=reserve` → `needsConfigure: true` → `LimeCabWhenScene`
  (`limecab-when-scene.tsx`, `reserve.ts`: today/tomorrow, next 8
  half-hours). **No `scheduledAt` column.** The clock is client-side
  copy (`reservedLabel`). Matching still assigns immediately; the
  scheduled string is a label, not a wait.
- Help **must persist** `scheduledAt`. Add the column. Reserve **may**
  write the same field in `trip.request` if the client already has the
  Date (one extra input). Do not rebuild Reserve. Do not add a
  reservations table.

### Driver opt-in (Help’s prefs substrate)

- Register form: name + vehicle only (`/driver` `RegisterForm`). No
  job-type consent. Defaults: `acceptXl`, `longTrips`, `courierJobs`
  all `true` (`schema.ts`).
- Prefs: Ride (locked on) + Courier card; XL / long-trips switches
  (`driver-preferences.tsx`). Comment in that file already says there
  are no shop-and-deliver rows. There will be. Help is a third service
  card, not a fourth ride filter.
- `driver.setPreferences` accepts `acceptXl | longTrips | courierJobs`.
- Inbox: `courierJobs` / `acceptXl` / `longTrips` then heading then H3
  disk.

### Rider shell

- `BookingMode = "ride" | "courier" | "reserve"` (`limecab-app.tsx`).
- `/?service=` wired for courier and reserve (`limecab-shell.tsx`,
  `/services`).
- Scene machine: `ServiceAppState` in `lib/service-app/state.ts`.
  Location first, then service, then configure, then quote. Help’s
  when → kind → where is a **context-driven entry order**, not a second
  reducer.
- Map/sheet: task layout in HANDOFF-surfaces.md. Home is still a
  sibling column. Do not inset the map.

### Category search (Shop’s store substrate)

- `GET /api/map/category?lat=&lng=&categories=` — Search Box Category
  Search. `ALLOWED` is currently `coffee | rest_area` only
  (`src/app/api/map/category/route.ts`), used for rest stops.
- Mapper: `restStopsFromFeatures` (`rest-stops.ts`). Widen the allowed
  set and the category union. Do not add `/api/map/shops`.

### Money

- Trip fare is integer cents, computed in `trip.request` via
  `estimateFare`. No Stripe item capture. No driver expense object.
- Shop item cost: **honest-empty / OUT**. Quote footnote only.

---

## Operating model

### Physical context (this decides layout)

**Help rider.** Kitchen table, not a curb. They are booking a visit,
not hailing a car. Huge type on the time and the kind. The map waits
until *Where?* The house pin is the whole geometry — pickup and
destination are the same place.

**Help driver.** Still phone-on-the-dash until they park. Offer is a
glance: fare, clock, neighbourhood, Care vs tasks (Care must be
unmissable). Once they arrive they are **inside a home**. The sheet
is the job: what to do, who, the window. PIN is the wrong object.
One primary: Arrived → Start visit → Complete visit.

**Shop rider.** Grocery-list energy. Keyboard for the list. Store
search is a prepared fullscreen search scene (scene-preparation
rule 5). Quote is transport, not a cart total.

**Shop courier.** Same as today’s courier duty: merchant then
recipient. The sheet shows the **list**, not a sealed-package story.
At the store the question is *Did you get the list?* — not *Scan the
pickup code?*. Delivery proof stays today’s courier proof.

### One question per scene

Never combine When + Kind, or Shop + List, on one surface. Current
surface captures one piece of intent; the next surface is built
around what is still unknown. Resolved inputs become a tappable
summary chip that returns to their scene (back revises).

---

## Do not clobber

### HANDOFF-surfaces.md

Map under the sheet. Snap fraction is the contract. `SheetActions`
sticky `shrink-0`. `minimizeRide` / `restoreRide`. Payment is
`openPayment` fullscreen interrupt. Do not measure the drawer, portal
actions, or spring sheet height from list content.

### HANDOFF-driver.md

`/driver` is a duty session. Offer is an **interrupt of `online`**.
`DriverAppState` is `offline | online | to_pickup | at_pickup |
on_trip | complete` — **do not add `offer`, `help`, or `shop`
members.** Derive Help/Shop from `productId` / `itemList` the way
courier already derives from `isCourierProduct`. One job, one
primary. Do not `router.push` on accept.

### HANDOFF-goget-2026.md

Voice, One Search, Travel Mode, Reserve, For the Way, packed courier
— do not redo. Shop **absorbs** the store / buy-for-me landing:
a One Search “Get from a store” row should enter Shop (list), not
the single `itemDescription` field. Packed courier (`/?service=courier`
+ Already packed) stays bit-for-bit.

### Shared primitives

`components/service-app/*` and `lib/service-app/*` stay vertical-agnostic.
Prefer slots/callbacks. Category results feed `LocationSearch` the same
`LocationSuggestion` shape. No `if (app === "help")` in the kit.

---

## Target composition (unchanged chrome)

Rider task layout — Help and Shop live **in scenes**, not a new shell:

```
[ destination / summary bar ]   overlay
[ recenter ]                    overlay, pre-commit only
[ map — full bleed ]            canvas UNDER the sheet
[ sheet
    [ scene content ]
    [ action band ]             sticky, one primary
]
```

Help *When?* and *What kind?* may keep the map in `home` / locating
posture (no route yet). *Where?* is `location_search` fullscreen, then
pin. Quote is `expanded`. Same recipes as Reserve/courier; add rows to
`surfaces.ts`, do not fork a Help shell.

Driver: same z-order as HANDOFF-driver (avatar, shield, map, sheet).
Help/Shop change **sheet copy and extra rows**, not the chrome.

Desktop: AdaptiveSurface already maps sheet → side card, interrupt →
dialog. No `isMobile` in reducers or tRPC.

---

## Scene counts

| Flow | Planning scenes | Live / duty | New `*AppState` members |
|---|---|---|---|
| Help rider | **4** (when, kind, where, quote) | 5 reused (`matching` … `complete`) | **0** |
| Help driver | **0** | **6** reused + offer interrupt | **0** |
| Shop rider | **4** (shop, list, drop-off, quote) | 5 reused | **0** |
| Shop courier | **0** | **6** reused + offer interrupt | **0** |

Live rider states are the existing lifecycle. Driver stays the existing
duty machine. Copy and sheet content branch; the enum does not grow.

---

## Lime Help — beat by beat

### Rider

Entry: `/services` tile **Help** or `/?service=help`. Not Home “Where
to?”. Immediate ride path unchanged.

`BookingMode` grows `"help"`. `needsServiceSelect` starts false for
the *vertical*, then true for the *kind* (see scene table).
`needsConfigure: true`. `hasLocation` starts false.

#### 1. When? — `configure` + `LimeCabWhenScene`

Reuse the Reserve clock (today / tomorrow, next half-hours). Headline
via `serviceAppQuestion` / a Help-specific question helper: *When
should they arrive?* Do not use “picked up”.

No overnight slots. If a half-hour would land after 21:00 or before
08:00, omit it (same `upcomingHalfHours` filter, Help-only). Do not
add a date picker.

Primary: Continue (not “See price” — price waits until where is known).
If you must share the component, pass the action label in; do not fork
the file into `help-when-scene.tsx` unless the copy split is messy.

Back → Home (Help entry), destination not invented.

#### 2. What kind? — `service_select`

Two tiles only, not the ride comparison list:

| Product id | Tile | What it means |
|---|---|---|
| `lime-help` | Light tasks | Household jobs: bring in bags, basic tidy, wait for a delivery, assemble a small item. No nursing. |
| `lime-care` | Care | Companionship / daily living help in the home. Not medical care. |

This is the distinction. Do not show Lime / XL / Pool here.

Optional notes (`kind: "text"`, “What needs doing?”) belong **on this
surface as an inline field after the choice**, not as a fifth scene.
A binary-plus-note is still *What kind?* If the note needs a keyboard
wall, keep it on this sheet; do not open fullscreen.

Care tile: one line under the name — “Your helper has agreed to Care
rules. This is not medical care.” Do not dump the driver rule list on
the rider.

Back → When, clock kept.

#### 3. Where? — `location_search` / `location_pin`

The house. Saved Home chip if they have one (logistics `places.list`).
Search and pin as today. Pickup **and** destination are this location
(same coords, same address). `trip.request` still has both columns;
send both. Do not draw a cross-town route.

Back → kind, place kept on revise.

#### 4. Purchase? — `quote`

Fare: `estimateFare(product, 0, 60)` (zero miles, one-hour visit). Set
`lime-help` / `lime-care` `priceCents` so that total is a visit price,
not a $4 hop. Quote shows the **clock**, the kind, the address,
the note. Primary: **Schedule Help** / **Schedule Care**.

Truthfulness: matching copy is `reservedLabel(scheduledAt)` (e.g.
“Scheduled for 2:00 PM”), never “Finding a driver nearby” with a fake
ETA if the window is later. If sim assigns immediately, show the
scheduled label on assigned/live anyway (same deal as Reserve).

#### 5. Live — reused states

`matching` → `assigned` → `provider_en_route` → `active` → `complete`.

- En route: helper heading to the house. Map: driver → house.
- Active: they are there. Map stays on the house. No second pin.
- Complete: visit summary, fare, kind. Not “You’ve arrived.”

Share trip / safety interrupt: keep, same as rides. Help is still a
stranger coming to a home.

PIN: schema still requires `pickupPin`. Rider may show it as “Show this
if you want to confirm it’s them.” Driver Help sheet does **not**
lead with PIN (courier already hides the ride PIN).

### Driver — duty session (same six scenes)

Offers for `lime-help` / `lime-care` only if the flags + ack below
pass. Same interrupt: fare first, then product, then **clock**, then
address. Care: the word **Care** is as loud as the fare. Tasks: “Help ·
light tasks”.

| Scene | Help question | Primary |
|---|---|---|
| offer (interrupt) | Do you take this visit? | Accept |
| `to_pickup` | Have you arrived at the house? | I’ve arrived |
| `at_pickup` | Ready to start the visit? | Start visit |
| `on_trip` | Have you finished the visit? | Complete visit |
| `complete` | What did you earn? | Done → online |

`driverAppQuestion(state, courier)` grows a third mode (a `jobKind`:
`"ride" | "courier" | "help"` — Shop stays `"courier"`). Do not add
booleans `isHelp` + `isCourier` soup in every scene.

Map: `to_pickup` routes to the house. `on_trip` does **not** grow a
new destination — stay on the house. Coverage lattice still off during
a job.

Cancel-this-job: still no server path. Do not fake it.

### Driver opt-in + Care ack (must click to understand)

Help is **off** by default (`helpJobs: false`, `careJobs: false`).
Courier defaults stay as they are.

#### Help (light tasks) — explain, then enable

Surfaces: (1) after `RegisterForm` success, a skippable interrupt
“Also take Help jobs?”; (2) `/driver/profile/preferences` third
service card, **not** a raw switch.

Named action `openHelpExplain`. Parent prefs/register stay mounted.

Copy, plain language, short. Implementer may tighten, not soften:

> Lime Help sends you to someone’s home for a scheduled visit. Light
> tasks means household jobs: bringing in groceries, a basic tidy,
> waiting for a delivery, simple assembly. You are not a cleaner on
> contract, not a mover, and not a nurse. You can decline any offer.
> Care is separate — it has its own rules.

Primary: **I understand — enable Help**. Secondary: Not now.

Only then `setPreferences({ helpJobs: true })`. Store
`helpAcknowledgedAt = now()`. Turning the card off clears the flag;
re-enable repeats the interrupt (do not silently restore).

Register: **Start driving** must not require Help. Vehicle form stays
the gate.

#### Care — numbered rules, each acked

Cannot set `careJobs: true` and cannot see `lime-care` offers unless
ack is current.

Entry: prefs, only if `helpJobs` is already on. Care card disabled
with “Enable Help first” until then. Action `openCareRules`.

Presentation: `fullscreen` interrupt (or existing search-sized
fullscreen). **One rule visible as the question, then Next.** Not
seven checkboxes under a scroll. Not one “I agree to all”.

`CARE_RULES_VERSION = "2026-08-28"`. Rules, in order:

1. **Not medical care.** You do not diagnose, advise on medication, or
   act as a nurse. If they need a clinician, this job is the wrong job.
2. **Emergencies.** If someone is in danger, you call 911. You do not
   “handle it”.
3. **Lifting.** You do not lift or transfer a person. You do not lift
   more than 25 lb. If the visit needs that, you decline and leave.
4. **No overnight.** The visit ends at the scheduled window. You do
   not stay the night. You do not accept a “just until morning”.
5. **Privacy.** No photos or video of the client or the inside of the
   home. No posting.
6. **You can leave.** If you feel unsafe, you leave. You tell support.
   A Care accept is not a lock-in to stay.
7. **Companionship and daily living only.** Presence, a meal they can
   eat, help they can still do with you there. Not bathing that needs
   training, not wound care, not controlled meds.

Each rule: body + primary **I understand** (or equivalent). That click
is the ack for that index. Progress to the next rule. Back revises the
previous rule (does not skip). After rule 7, a final **Enable Care
jobs** commits.

Persist on `drivers` (no ack table):

- `careRulesVersion` = `CARE_RULES_VERSION`
- `careAcknowledgedAt` = now()
- `careJobs` = true

Who = `drivers.userId`. Server **rejects** `careJobs: true` if version
is missing or ≠ current constant. Inbox **excludes** `lime-care` unless
`careJobs && careRulesVersion === CARE_RULES_VERSION`.

Bump the constant when copy changes; Care drivers must walk the list
again. Do not auto-keep `careJobs` across a version mismatch.

Do not put Care rules in `RegisterForm`. Do not enable Care as a
side effect of enabling Help.

---

## Lime Shop — beat by beat

Shop is **courier with a list and a store**. Product ids stay
`courier-small | courier-medium | courier-large`. No `lime-shop` id.

Entry: `/services` tile **Shop** → `/?service=shop`, or One Search
intent `store`, or Home courier path when they choose “Buy for me”
**and** a store pickup (prefer routing that to Shop so there is one
list UI).

`BookingMode` grows `"shop"` (or reuse `"courier"` + `fulfillment`
app data — prefer an explicit mode so Home title can say “Shop”
without branching the kit). Packed courier remains `"courier"`.

### Rider

#### 1. Which shop? — `location_search`

Prepared search, fullscreen. Empty query: recents + saved, plus a
**category row** (Grocery / Pharmacy) that hits `/api/map/category`
with `grocery,supermarket,pharmacy`. Typed query: Mapbox Places as
today; if the classifier says `store`, keep grouping “Get from a
store”.

Extend `ALLOWED` in `category/route.ts`. Widen `RestStop["category"]`
(or rename the union in `rest-stops.ts` to a generic category result —
do not add a parallel mapper). Cap 8.

Choosing a shop sets **pickup** to that place. Map pin on the store.

Back → Home. Do not skip to the list without a store.

#### 2. What should they buy? — `configure`

Not the packed courier form. A LimeCab list editor **inside**
`configure` (new `LimeCabShopList` or a branch in
`LimeCabConfigureScene` keyed on booking mode, not on a kit option
kind).

- Rows: item label (required) + optional note.
- Cap **12** items. Label max 80, note max 80.
- Add-another control. Empty list is not ready.
- Size: keep courier size (seat / trunk / XL) as a compact choice —
  it still picks `courier-*`. Default small.
- Recipient: default “send it to me” (today’s rider prefill). Still
  require a phone if drop-off is not the rider — same
  `courierDraftReady` bar, but **item list** replaces
  `itemDescription`.
- Proof: keep packed defaults (hand / door / signature).
- Photo: keep GO–GET honest-empty (“this build has no upload”).

The list is the order. No quantities-as-SKU, no substitutions UI
beyond a note (“any brand of oat milk”).

Primary: Continue. Ready when `items.length >= 1` and recipient is
ready.

Back → shop search, store kept.

#### 3. Where is it going? — `location_search` (destination)

Drop-off. If Home is set, show it as a chip (same SavedPlaces). Still
a scene: they confirm or pick another. Do not bury drop-off as a
fifth configure field.

Back → list, items kept.

#### 4. Purchase? — `quote`

Transport fare only (`courierProductFromOptions` + `estimateFare` as
today). Footnote, exact intent:

> Item cost is paid in store by the courier. This price is the trip.
> This build does not reimburse or scan receipts.

Do not show a fake cart total. Do not show “$0.00 items”. List
summary on the quote (first 3 items + “and N more”).

Primary: **Request Shop** / existing courier confirm copy, whichever
matches the quote scene’s one-primary rule.

Matching: “Finding a courier…” — same as courier, truthful.

#### 5. Live — reused courier states

Status copy may read “Buying your list, then delivering” while
`assigned | arriving`, then “On the way to you” once `in_progress`.
Do not fake “aisle 4” or a scanned barcode.

Complete: delivery proof + transport total. No itemized receipt.

### Courier / driver

Same duty scenes as courier. Differences:

- Offer route rail: store → drop-off. Fare is transport. Subtitle:
  “Shop · N items”.
- Sheet always renders `itemList` (label + note). If the list is
  missing, the job is mis-saved — fail the request on the server
  rather than ship a blank sheet.
- `to_pickup`: *Have you reached the store?* (today’s merchant copy
  is fine).
- `at_pickup`: **Do not require the packed pickup PIN** when
  `itemList` is present. Question: *Did you get everything on the
  list?* Primary: **Got the list**. No barcode. No photo of shelves.
- `on_trip`: same delivery proof as courier (PIN / door / signature).
- Reimbursement: **OUT**. No “I spent $42” field. No upload. A
  one-line honest-empty on the complete splash is allowed: “Item cost
  stays between you and the store in this build.”

Inbox: existing `courierJobs`. Shop jobs **are** courier jobs. Do not
add `shopJobs`.

---

## Scene machine / questions table

Do **not** add `ServiceAppState` members. Extend `ServiceAppContext`
and LimeCab entry state.

```
Help entry  → configure (when) → service_select (kind) → location_search (house) → quote → matching…
Shop entry  → location_search (shop) → configure (list) → location_search (drop-off) → quote → matching…
```

`configure_done` today always goes to `quote`. Help/Shop need a
context flag so configure can progress to **search** when the next
unknown is a place:

```ts
// ServiceAppContext additions (kit, no product names):
locationAfterConfigure?: boolean; // configure_done → location_search if !hasLocation
selectAfterConfigure?: boolean;   // configure_done → service_select if kind unknown
```

Name them by effect, not “helpMode”. LimeCab sets the flags from
`bookingMode`. Reducer + `backServiceAppState` + tests in
`state.test.ts` — all three, or the scene is fake.

Help `back`:

| From | Back revises to | Kept |
|---|---|---|
| when (`configure`) | home | — |
| kind (`service_select`) | when | clock |
| where | kind | clock + product |
| quote | where | all of the above |

Shop `back`:

| From | Back revises to | Kept |
|---|---|---|
| shop search | home | — |
| list (`configure`) | shop search | store |
| drop-off | list | store + items |
| quote | drop-off | all of the above |

Never back-clear to Home from mid-chain.

### Rider questions

| Scene | Question | Primary | Presentation | Map |
|---|---|---|---|---|
| Help when | When should they arrive? | Continue | expanded | locating / idle |
| Help kind | Light tasks or Care? | Continue | expanded | idle |
| Help where | Where is the house? | Select | fullscreen search | select_location |
| Help quote | Schedule this visit? | Schedule Help/Care | expanded | pin on house |
| Shop shop | Which shop? | Select | fullscreen search | select_location |
| Shop list | What should they buy? | Continue | expanded | store pin |
| Shop drop-off | Where is it going? | Select | fullscreen search | both pins |
| Shop quote | Request this trip? | Request | expanded | route store → drop-off |

Live states: existing `serviceAppQuestion` copy, with LimeCab
headlines swapped for Help/Shop (status scene already branches
courier).

### Driver questions

Existing `driverAppQuestion` + `jobKind`. Offer remains an interrupt
of `online`. Hydration from `inbox.active[0].status` unchanged.

---

## Data model diffs only

No new tables. No `help_visits`, no `shop_orders`, no `care_ack_events`.

### `drivers`

```ts
helpJobs: boolean().default(false).notNull()
careJobs: boolean().default(false).notNull()
helpAcknowledgedAt: timestamp({ withTimezone: true }) // nullable
careRulesVersion: varchar({ length: 16 })             // nullable, e.g. "2026-08-28"
careAcknowledgedAt: timestamp({ withTimezone: true }) // nullable
```

Inbox: exclude `lime-help` unless `helpJobs`. Exclude `lime-care`
unless `careJobs && careRulesVersion === CARE_RULES_VERSION`.
`setPreferences` accepts the new booleans; **server-side** Care
enable requires current version + timestamp (set them in the same
mutation as `careJobs: true`, or a dedicated `acknowledgeCareRules`
that writes all three). Do not trust a lone `careJobs: true` from the
client.

### `trips`

```ts
scheduledAt: timestamp({ withTimezone: true }) // nullable; Help required; Reserve may write
itemList: text()                               // nullable; JSON array, Shop only
```

`itemList` payload:

```ts
{ label: string; note?: string }[]  // max 12, label 1–80, note ≤80
```

No `jsonb` (schema elsewhere is varchar/text/int/bool). Validate in
`trip.request` with zod, store `JSON.stringify`.

Help: `productId` `lime-help` | `lime-care`; `scheduledAt` required;
pickup = destination = house; `itemList` null; courier recipient
fields null.

Shop: `productId` one of `COURIER_PRODUCTS`; `itemList` required
non-empty; pickup = store; destination = drop-off; existing courier
recipient/proof fields as today.

Do **not** add `fulfillment` if `itemList != null` means Shop.
Packed courier keeps `itemList` null.

### Catalogue (`mock.ts`)

```ts
// RIDE_PRODUCTS (or a HELP_PRODUCTS array findBookableProduct already merges)
{ id: "lime-help", name: "Lime Help", description: "Light tasks at home", seats: 0, etaMinutes: 0, priceCents: 280, status: "available" }
{ id: "lime-care", name: "Lime Care", description: "Care at home", seats: 0, etaMinutes: 0, priceCents: 320, status: "available" }

// LIMECAB_SERVICES — add, do not replace assist
{ id: "help", title: "Help", description: "Someone to help at home", status: "available" }
{ id: "shop", title: "Shop", description: "A courier buys your list", status: "available" }
```

Two Help product ids. Zero Shop product ids. Assist stays
`coming_soon`.

`findBookableProduct` must see Help products (pass `RIDE_PRODUCTS` as
today, or concat). `isCourierProduct` unchanged. Add
`isHelpProduct(id)` next to it.

### tRPC

- `trip.request`: `scheduledAt` optional datetime; `courier.itemList`
  optional array. Reject Help without `scheduledAt`. Reject Shop
  without `itemList`. Reject `lime-care` request the same as any
  product — the **driver** gate is inbox, not the rider request.
- `driver.setPreferences` / `driver.acknowledgeCareRules`.
- `driver.register`: still vehicle-only. Help opt-in is a follow-up
  mutation, not a register field.
- Inbox filter as above. `isHelpProduct` trips skip XL/long-trip
  filters (they are not rides). Distance ~0 must not fail `longTrips`.

### Fare

Help: `estimateFare(product, 0, 60)` in `trip.request` when
`isHelpProduct`. Do not use driving miles between identical coords as
the story.

Shop: existing courier fare. No item cents.

---

## Named actions

Rider `surfaces.ts` — add only what a gesture needs:

| Action | When | What moves |
|---|---|---|
| `openShopSearch` | Shop tile / empty shop step | search primary fullscreen; map locating |
| `shopSelected` | picked a store | same as pickup selected; sheet → configure |
| `helpWhere` | after kind | search fullscreen; map select_location |

Do not add `setHelpKind` as a surface action. Kind is scene data.

Driver `driver-surfaces.ts`:

| Action | When | What moves |
|---|---|---|
| `openHelpExplain` | Help card / post-register | interrupt (sheet or fullscreen); parent mounted |
| `helpExplainDismissed` | Not now | return |
| `openCareRules` | Care card | fullscreen interrupt; parent mounted |
| `careRulesDismissed` | abandon mid-list | return; `careJobs` still false |

Ack clicks are mutations, not a surface action per rule. The Care
walk can live in one interrupt whose **content** steps through rules
(app data `careRuleIndex`, not a `ServiceAppState` / `DriverAppState`
member). Index is not a screen boolean if it is not a second machine
— keep it inside the interrupt component, reset on dismiss.

---

## What we are **not** building

Leave these out unless a later handoff says otherwise:

- Overnight Help, multi-day booking, recurring visits, a full calendar
- Medical advice, medication management, licensed home-health, HIPAA
  product claims, background-check *product* beyond today’s mock docs
- Lifting / transfer / bathing-as-a-service
- A second map/sheet stack, a Help-only shell, hotels, membership
- A second geocoder; indoor store maps; barcode / POS / SKU catalog
- Item reimbursement, receipt OCR, courier wallet, Stripe item capture
- Shopper confirmation chat (GO–GET already honest-empty’d this)
- `kind: "list"` in the kit; `lime-shop` product id; `shopJobs` flag
- Renaming Assist → Help; flipping Assist to available
- Driver cancel path, WebSockets, surge, heatmaps
- New tables: visits, orders, ack_events, line_items
- Putting Care rules on the register vehicle form
- On-demand (unscheduled) Help as the default path

---

## Invariants (do not violate)

- One question per scene. When ≠ kind ≠ where. Shop ≠ list ≠ drop-off.
- Interruptions suspend; they do not unmount. Prefs, register, and
  quote drafts come back.
- Named actions only. No component sets drawer + map + footer itself.
- No `isMobile` in parsers, reducers, or tRPC.
- No product name in `components/service-app/` or `lib/service-app/`.
- Map stays mounted. Help active: house pin, no fake cross-town line.
- Truthfulness: no driver/ETA clock as “on the way now” for a visit
  hours out. No cart total that was not charged. No “receipt uploaded”.
- Care jobs require current `careRulesVersion`. Help jobs require
  `helpJobs` after the explainer, not a default-true column.
- Packed courier path unchanged. Immediate ride Home path unchanged.
- Cap: ribbon + one primary. Care ack is one rule at a time.
- No `--token` on Vercel CLI.

---

## Key files

| Concern | File |
|---|---|
| Catalogue | `src/lib/limecab/mock.ts` |
| Courier + buy-for-me | `src/lib/limecab/courier.ts`, `limecab-configure-scene.tsx` |
| When? clock | `src/lib/limecab/reserve.ts`, `limecab-when-scene.tsx` |
| Rider flow | `src/components/limecab/limecab-app.tsx` |
| Rider recipes | `src/components/limecab/surfaces.ts` |
| Services tiles | `src/app/services/page.tsx`, `limecab-shell.tsx` |
| One Search store | `src/lib/limecab/search-intent.ts`, `limecab-search-results.tsx` |
| Category search | `src/app/api/map/category/route.ts`, `src/lib/limecab/rest-stops.ts`, `places.ts` |
| Scene machine | `src/lib/service-app/state.ts` (+ `.test.ts`) |
| Quote / status / complete | `limecab-quote-scene.tsx`, `limecab-status-scene.tsx`, `limecab-complete-scene.tsx` |
| Trip write | `src/server/api/routers/trip.ts` |
| Schema | `src/server/db/schema.ts` |
| Driver inbox + prefs API | `src/server/api/routers/driver.ts` |
| Driver duty UI | `driver-app.tsx`, `driver-scenes.tsx`, `driver-state.ts` |
| Driver prefs / register | `driver-preferences.tsx`, `src/app/driver/page.tsx` |
| Find product | `findBookableProduct` in `courier.ts` |

New (suggested, LimeCab only): `src/lib/limecab/help.ts` (product
guards, Care rules constant + tests), `src/lib/limecab/shop-list.ts`
(parse/validate list + tests). Care walk UI next to
`driver-preferences.tsx`, not in the kit.

---

## Implementation order (smallest vertical slice first)

1. **Shop list on existing courier** — persist `itemList`, Shop
   configure editor, driver sheet renders the list, quote footnote.
   Store can be a fixture / Places result; category ALLOWED expansion
   can land in the same slice or immediately after. Packed path must
   still pass. This is the slice that proves “courier + list + store”
   without Help’s legal ack.

2. **Category shop search** — widen `/api/map/category`, Shop entry
   `/?service=shop`, One Search store row lands on the list (not the
   one-line buy field).

3. **Help light tasks** — `lime-help`, `scheduledAt`, when → kind →
   where → quote, `helpJobs` + explainer interrupt, inbox filter,
   driver copy for a house visit. No Care yet.

4. **Care** — `lime-care`, per-rule ack, persist version + timestamp,
   server reject + inbox gate, Care loud on the offer.

Do not implement 4 before 3. Do not implement Help before Shop unless
Shop is blocked on Mapbox Category (then do Shop against Places + one
grocery fixture, category as 2b).

`db:generate` as soon as columns land.

---

## Test plan checklist

Ticked = walked in the browser at 390×844 on 2026-08-28. Unticked = not
walked; the boxes are left honest rather than filled in from the code.

### Shop (390×844, then 1280)

- [x] `/?service=courier` packed: recipient still required; no list UI.
- [x] `/?service=shop` (or store One Search): shop search → list →
      drop-off → quote. Back revises; store and items kept.
- [x] Empty list: cannot See price / Request.
- [x] Quote shows transport total + the in-store footnote. No fake
      item total.
- [x] Request writes `itemList`. Driver offer: “Shop · N items”. Job
      sheet shows every label + note. At store: **Got the list**, no
      pickup PIN gate.
- [x] Delivery PIN / door / signature still complete the job.
- [x] Category grocery/pharmacy returns real Mapbox rows when token
      allows. Mapbox-down fallback is wired (`SHOP_PLACES`) but was not
      forced — the token worked.
- [ ] Double-tap Request: one trip (`surface.transition` lock).
- [ ] Minimize a live Shop job: Home does not start a second trip
      (existing guards).

### Help (390×844, then 1280)

- [x] Home “Where to?” still ride select (Lime/XL/Comfort/Pool). No
      When? on that path.
- [x] Services → Help → When? → Kind → Where? → quote. Order is that
      order. Back revises.
- [x] Light vs Care are two products on quote (`lime-help` /
      `lime-care`). Care copy is not a ride. Light tasks was booked end
      to end; Care was exercised as a driver offer, not a rider booking.
- [x] No overnight slot. No medical/overnight control.
- [x] Quote primary schedules; matching/live show the clock, not a
      fake 4-min car when the window is later.
- [x] Pickup and destination are the house. Map during active: one pin.
- [x] Assist tile still coming soon.

### Driver opt-in

- [x] Help off, Care off by default (column defaults + an existing
      driver's prefs page). A brand-new registration was not walked.
- [x] Help card: explainer interrupt; Not now leaves `helpJobs` false.
      Enable only after **I understand — enable Help**.
      `helpAcknowledgedAt` set.
- [x] Care card locked with “Enable Help first” until Help is on;
      turning Help off clears Care and its acknowledgement.
- [x] Care: each rule requires its own acknowledge; **Enable Care jobs**
      exists only on rule 7, and Back revises the previous rule.
      Abandoning mid-walk leaves `careJobs` false by construction (only
      `acknowledgeCareRules` writes it) but was not walked.
- [x] After full ack: `careJobs` true, version `2026-08-28`, timestamp
      set. Inbox shows Care offers; the same open trip disappears when
      the stored version is stale. Checked by flipping the version, not
      with a second browser.
- [x] `setPreferences({ careJobs: true })` is not expressible — the
      input takes `z.literal(false)`, so a client cannot send it at all.
- [x] Help offers gated on `helpJobs`; Help skips the XL / long-trip
      filters so a zero-mile visit is never filtered out as “short”.

### Regression

- [x] Reserve When? still works. Packed courier still works.
- [x] `/driver` arrive → start → complete stays on one URL for Shop and
      for a visit. Console clean of `SurfaceManager` invariant warnings.
      Accept-from-offer was walked for Care only.
- [x] `npx tsc --noEmit`, existing tests, new unit tests for Care
      version gate, `itemList` zod, Help fare (0 mi / 60 min), reducer
      flags for configure → search.

---

## Picking back up

All four slices are done. `npx tsc --noEmit`, `npm test` (161), and the
browser walk at 390×844 are green. Migrations `0006`–`0008` are generated and
applied; run `npm run db:migrate` on any environment that has not seen them.

### Verified in the browser

Shop: `/?service=shop` → store search (live Mapbox grocery/pharmacy rows) →
list → drop-off → quote; back revises at every step and keeps store + items;
request writes `itemList`; driver reads the list, taps **Got the list** with
no code, delivers on the recipient PIN. Packed courier `/?service=courier` is
bit-for-bit unchanged (no list UI, fulfillment choice and package counter
still there).

Help: `/?service=help` → When (daytime half-hours only) → Kind → Where →
quote at the 60-minute price the server charges → live scene shows the clock →
driver arrives at the house, starts and completes the visit.

Driver opt-in: Help off by default; **Not now** leaves `helpJobs` false with a
null timestamp; **I understand — enable Help** sets both. Care walked one rule
at a time; ack persisted as `2026-08-28` with a timestamp; the version gate
proved with a real open Care trip.

Regression: Reserve's When? unchanged, the Home ride path still goes straight
to Lime / XL / Comfort / Pool, Assist still `coming_soon`, console clean of
`SurfaceManager` invariant warnings.

### Known gaps, deliberate

- The fare splash and the honest-empty "Item cost stays between you and the
  store in this build" line were not visually confirmed — the splash
  auto-dismisses faster than a screenshot. The code path is typechecked and
  the earnings total moved by the right amount.
- `driver-scenes.tsx` has one pre-existing lint error (`busy || undefined`,
  `prefer-nullish-coalescing`) that predates this work.
- One Search still classifies "store" with the same regex; no new intents.

### If you are extending this

- Bumping `CARE_RULES_VERSION` is the supported way to make every Care driver
  re-read the rules. Do not migrate old acknowledgements forward.
- A new vertical whose questions run in an unusual order should reuse the two
  context flags rather than adding a third: they compose (Help uses both).
- The next honest thing to build is the money path Shop deliberately lacks —
  reimbursement, receipt capture, a courier wallet. Until then the footnote
  stays exactly as written.
- Still out of scope, unchanged from the list above: overnight Help, recurring
  visits, a real calendar, medical claims, a shopper marketplace, barcode or
  SKU anything, a driver cancel path.
