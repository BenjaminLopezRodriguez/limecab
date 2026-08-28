# Handoff: GO–GET 2026 rider product

**Status: open work order.** Research snapshot 2026-08-27. Do not treat this
as a surfaces or driver rebuild. Those two handoffs already shipped (or are
being finished on another session). This is a **new rider-side work order**
inspired by Uber’s GO–GET 2026 announcements, sized for LimeCab as it exists:
web rider + the current driver app. Implement the six sections below. Do not
invent hotels, a membership program, or a second map/sheet stack.

```
CLAUDE BRIEF
============
You are implementing LimeCab rider features inspired by Uber GO–GET 2026
("one app for everything": go, get, travel). Read this whole file before
writing code.

Read first:
  .claude/skills/surface-orchestration/SKILL.md
  .claude/skills/adaptive-surfaces/SKILL.md
  .claude/skills/scene-preparation/SKILL.md
  .claude/skills/perceived-performance/SKILL.md
  .ux-bugs/HANDOFF-surfaces.md   (state doc — do not redo)
  .ux-bugs/HANDOFF-driver.md     (driver rebuild — do not touch)

Named surface actions only. One question per scene. Interruptions suspend;
they do not unmount. No independent drawer / map / footer choreography.

Do not:
  - Edit driver-app files (driver-app.tsx, driver-scenes.tsx,
    driver-surfaces.ts, driver-state.ts, driver-chrome.tsx, /driver/*)
  - Re-derive the sheet/map contract in HANDOFF-surfaces.md
  - Add Expedia/hotels, Uber One credits, indoor airport maps, robotaxis,
    OpenTable, or a real LLM vendor
  - Put a keyboard search field on Home (search stays a prepared scene)
  - Add useState booleans that name screens (showVoice, travelModeOn, …)
  - Commit unless asked

Implement sections 1–6 in order. Verify each in the browser (390×844) before
moving on. tsc --noEmit and existing tests must stay green.
```

---

## Research summary — Uber GO–GET 2026

**What it is.** Uber’s **sixth annual GO–GET** (styled GO–GET, GO—GET, Go-Get)
is a **public product showcase**, not an internal eng conference and not a
developer summit. CEO Dara Khosrowshahi and CPO Sachin Kansal presented to
press. CTO Praveen Neppalli Naga spoke to TechCrunch about building the new
products faster with agentic AI tools — that was an interview, not a separate
engineering keynote.

**When / where.** Wednesday **29 April 2026**, **New York City**.

**Theme (Uber’s words).** “One app for everything — helping you go, get, and
now travel.” 2026 is a super-app / travel year. **2025** (“For Every Day”,
14 May 2025, also NYC) was affordability: Route Share, Ride Passes, Commute
Hub, Dine Out / OpenTable, VW shared autonomous rides in LA. Label any 2025
idea as 2025 if you borrow it; do not mix years in commit messages or copy.

**Primary sources**

| Source | URL |
|---|---|
| Uber Newsroom — GO–GET 2026 | https://www.uber.com/us/en/newsroom/go-get-2026/ |
| Uber event page | https://www.uber.com/us/en/u/go-get/ |
| Business Wire / investor PR (29 Apr 2026, NYC) | https://www.businesswire.com/news/home/20260429280841/en/Uber-Expands-into-Travel-with-Hotel-Bookings-and-New-In-App-Features |
| TechCrunch | https://techcrunch.com/2026/04/29/uber-is-in-the-hotel-business-now-thanks-in-part-to-ai/ |
| The Verge | https://www.theverge.com/transportation/919393/uber-hotel-expedia-vrbo-ai-voice-search |
| Axios | https://www.axios.com/2026/04/29/uber-app-hotels-expansion |
| ABC News (sixth annual; Voice mic in search; Eats cities) | https://abcnews.com/Business/uber-rolls-new-travel-features-hotel-booking-eats/story?id=132465202 |
| 2025 newsroom (prior year, labeled) | https://www.uber.com/us/en/newsroom/go-get-2025/ |

**What was actually new in 2026 vs incremental**

| Announcement | New in 2026? | Notes |
|---|---|---|
| Hotels on Uber (Expedia, 700k properties; Vrbo later) | **New** | Distribution deal. Not a ride feature. |
| Travel Mode | **New** | Away-from-home concierge: airport, local spots, later OpenTable / “room service”. Indoor walking directions mentioned by The Verge. |
| Uber One International | **New** | Membership credits abroad. |
| Shop for Me | **New** | Personal shopper for stores *not* on the app; photo + confirm before buy. |
| Eats for the Way | **New** | Reserve Black / Black SUV; driver picks up coffee/snack en route. Cities: Atlanta, Austin, LA, Philadelphia, San Diego, SF. |
| Voice Bookings | **New** | Mic in the search bar; conversational assistant; destination + prefs (pet, bags, cheap, airport); presents options before confirm. |
| One Search | **New** | Redesigned “Where to?” — places, food, and items in one query (e.g. “ice cream”). |
| Uber Boat (Europe, summer) | **New, regional** | Hardware / local operator. |
| OpenTable in-app | Incremental | Announced as Dine Out at **GO–GET 2025**; Travel Mode extends it. |
| Shared autonomous (VW ID. Buzz, LA) | Incremental | **GO–GET 2025** for early 2026. Not a 2026 headline. |
| Route Share / Ride Passes / Commute Hub | 2025 only | Affordability year. Not in the 2026 newsroom post. |
| Live Video on Teen Trips | **Not GO–GET** | Uber Newsroom 25 Aug 2026. Camera / teen accounts. Out of this spec. |

Driver impact of the 2026 show: almost none for accept/dispatch. Eats for the
Way is the exception (driver does a courier hop on the way to pickup). LimeCab
implements the **rider** side of that hop only — see “Do not clobber”.

---

## Map to LimeCab (in vs out)

LimeCab is a rideshare + same-day courier web app in Los Angeles fixtures.
It is not a super-app, has no hotel inventory, no membership, no Eats catalog,
and no `OPENAI_API_KEY` (see `.env.example`). Size every feature to that.

| Uber 2026 feature | LimeCab-sized take | Scope |
|---|---|---|
| Voice Bookings | Mic on Home + search. SpeechRecognition (or typed fallback). Local parser → destination + product prefs. Present tiers, then Confirm. Never auto-request. | **§1 implement** |
| One Search | Same search scene returns *intents*: ride to a place, courier to a place, “get from a store”. Not food/hotels. | **§2 implement** |
| Travel Mode | Home launcher adapts when the rider is “away” (demo toggle + LAX / tourist fixtures). Curated spots, airport chip, typical wait. No indoor maps, no OpenTable, no hotels. | **§3 implement** |
| Eats for the Way | After confirming Lime Comfort or Lime Reserve: interrupt “Add something for the car?” Mock 3 items. Uses the existing stop slot. Live copy: driver picking up the order. | **§5 implement** |
| Reserve (needed for Eats for the Way) | Flip `reserve` from `coming_soon` to a real scheduled-ride path. One question: *When?* | **§4 implement** |
| Shop for Me | Courier configure: store name + item note (optional photo honest-empty). Pickup can be a typed store from geocode. No personal-shopper marketplace. | **§6 implement** |
| Share trip while traveling | Safety interrupt already exists but is buried. Surface “Share this trip” on live rides, louder in Travel Mode. Use the existing share sheet. | fold into **§3** |
| Hotels / Expedia / Vrbo | No inventory, no Rapid API, not this product. | **Out** — listing a “Hotels (soon)” tile on `/services` is the most we would ever do; **do not add it**. Honest-empty on a new vertical is how Assist/Reserve used to work; we are *using* Reserve this spec, not adding a fifth dead tile. |
| Uber One International | No subscription, no credits ledger. | **Out** |
| Uber Boat | No marine operator. | **Out** |
| Indoor airport walking | No indoor map data. | **Out** — airport is a pickup fixture + copy, not a mall map. |
| Robotaxis / VW Buzz | No AV stack. | **Out** |
| Driver multi-stop food job | Would rewrite the duty session. | **Out** — rider map/status only. |
| Live Video teen trips (Aug 2026, not GO–GET) | Camera + teen accounts. | **Out** |
| 2025 Route Share / Ride Passes / Commute Hub | Lime Pool already exists as a tier. Do not build shuttles, $2.99 passes, or a commute product. | **Out of this order** (optional later; label 2025) |

---

## Do not clobber (read before any edit)

### HANDOFF-surfaces.md — done 2026-08-27, working tree may still be dirty

State doc, not a work order. The map sits **under** the sheet. Snap fraction
is the contract (`publishSheetSnap` / `readMapPadding`). `SheetActions` is
normal flow + `sticky` + `shrink-0`. `minimizeRide` / `restoreRide` exist.
Payment is `openPayment` fullscreen interrupt. Recenter is a canvas control
hidden once committed.

Do **not**: measure the drawer, portal `SheetActions`, inset the task map,
curve the task map, spring sheet height from content, merge minimize with
cancel, or rename `standby` back to `minimized`.

`--drawer-snap-point-offset` does not inherit. The action band needs
`shrink-0` or it collapses to ~23px. Both are load-bearing; see that file.

### HANDOFF-driver.md — rebuild shipped / another session may still be in it

`/driver` is a map-first duty session (`driver-app.tsx`, `driver-scenes.tsx`,
`driver-surfaces.ts`, `driver-state.ts`, `driver-chrome.tsx`). A
`./scripts/claude-implement-driver.sh` session may still be running against
that file.

**Do not edit any driver product file.** Do not add a food-pickup waypoint,
a second active job, or a courier-hop scene to the driver offer/job sheet.
Eats for the Way on Uber pays the driver for both jobs; we simulate that
only as rider copy and an extra stop on the *rider* route. The driver app
keeps one job, one primary.

Do not overload `src/components/limecab/surfaces.ts` with driver actions.
Do not change `src/server/limecab/state.ts` legal actions unless a section
below says so (none of them do).

### Shared primitives — touch carefully

`components/service-app/*` and `lib/service-app/*` are the kit. No product
name (Lime, Uber, GO–GET, Travel Mode) inside them. Prefer slots/callbacks
on `LocationTrigger` and `LocationSearch` over forking search into a
LimeCab-only scene.

`mock.ts`: HANDOFF-surfaces notes `lime-pool` was flipped
`coming_soon` → `available` by someone else. Leave Pool available. You *will*
flip `reserve` to `available` in §4 — that is this spec, not a drive-by.

---

## Target composition (rider, unchanged)

Home stays a sibling column (rounded map *card* + launcher). Task layout is
already:

```
[ destination bar ]          overlay
[ recenter ]                 overlay, pre-commit only
[ map — full bleed ]         canvas UNDER the sheet
[ sheet                      overlay, thumb zone
    [ scene content ]
    [ action band ]          sticky, optional, one primary
]
```

GO–GET work lives **in scenes and interrupts**, not in a new chrome layer.
Travel Mode does not become a second Home. Voice does not become an inline
dropdown on the launcher. One Search does not put a keyboard on Home.

---

## Work to do

### 1. Voice Bookings (P0)

**Goal.** Hands-full booking: tap a mic, say where and how, land on ride
select with the destination filled and a sensible tier preselected. Confirm
is still the purchase. Uber: mic in the search bar; assistant understands
destination + preferences (pet, bags, cheap, airport); **presents options
before confirming**.

**Current LimeCab**

- `LocationTrigger` is a single search button. Search icon only
  (`src/components/service-app/location-trigger.tsx`).
- Home launcher: `LimeCabHomeScene` → `onSearch("destination")` →
  `surfaces.perform("openDestinationSearch")` (`limecab-home-scene.tsx`,
  `limecab-app.tsx`, `surfaces.ts`).
- `LocationSearchScene` is keyboard + recents + current location. No mic.
- No SpeechRecognition usage in the repo. `.env.example` has no LLM key.
- Ride prefs exist as display-only (`RIDER_PREFERENCES` in `mock.ts`:
  quietRide, extraStops, waitOnArrival). They do not affect dispatch.
- Products: Lime, Lime XL, Lime Comfort, Lime Pool (`RIDE_PRODUCTS`).

**Desired**

- Mic is a **second control** on the large Home trigger and a trailing
  control on the search input. Tapping it is a named action
  `openVoiceBooking`, not `setShowMic(true)`.
- Voice is an **interruption of Home or of search**, parent stays mounted
  (draft / recents survive cancel). Presentation: `compact-interrupt` is
  too small for a live transcript + “listening”; use the existing search
  fullscreen *or* a dedicated interrupt at `fullscreen`. Pick one and stick
  to it. Preferred: stay in `location_search` (same scene question: *Where?*)
  and put listening UI in the search scene. Do **not** add a
  `ServiceAppState` member named `voice`.
- Capture: `window.SpeechRecognition` / `webkitSpeechRecognition` when
  present. If missing or permission denied, a single textarea “Type what
  you’d say” is the honest fallback — not a fake waveform.
- Parse **locally**. No new vendor, no API route to OpenAI. A small
  `parseRideUtterance(text)` in `src/lib/limecab/` returns
  `{ destinationQuery, productHint, notes }` from fixtures + keywords:
  - place: match `geocodeAdapter` / `SAVED_PLACES` (LAX, Home, Work,
    Union Station, Griffith, Pier, Dodger, Pasadena, …)
  - XL / bags / luggage / six people → `lime-xl`
  - cheap / pool / share → `lime-pool`
  - comfort / quiet → `lime-comfort`
  - otherwise → default Lime
- On a confident place: `select_location` with that destination, then
  `service_select` with `productId` preselected. The rider still taps
  Confirm. Copy during listen: “Listening…” / the transcript. Copy on
  parse fail: inline error, stay on search, do not invent a pin.
- Do not request a trip from voice. Perceived-performance: the listen
  lock is local (don’t double-start recognition). Nothing here is a
  `surface.transition({ task })` against the server.

**Acceptance**

- Home large trigger has a mic that does not steal the “Where to?” tap.
- “Take me to LAX in an XL” → destination LAX Terminal 4, Lime XL selected
  on the comparison list, Confirm still required.
- Denied mic → typed fallback works end to end.
- Cancel / Back from listening restores Home (or search) with no destination
  unless one was already chosen.
- No new `ServiceAppState`. No LLM dependency.

**Verify (390×844)**

1. Home: tap “Where to?” still opens search as today.
2. Tap mic (no speech API): fallback field. Type “airport cheap”. Land on
   ride select with LAX + Lime Pool highlighted. Do not Confirm yet. Back
   revises; destination kept.
3. If the browser has speech: grant mic, say a fixture place, same landing.
4. Deny mic: fallback, no crash, no stuck lock.
5. Desktop: same flow; interrupt/search is the desktop counterpart, no
   `isMobile` in the parser.

---

### 2. One Search (P0)

**Goal.** One query, three kinds of result: a place to ride to, a place to
send a package, a store to get something from. Uber’s One Search also
returns food; we do not have Eats. Do not fake restaurants.

**Current LimeCab**

- Vertical is `ride | courier`, switched by `/?service=courier`
  (`limecab-app.tsx`). Home title can be “Send a package”.
- `LocationSearch` talks to a `GeocodeAdapter` and returns addresses only
  (`location-search.tsx`, `geocode-adapter.ts`). Suggestion shape is
  `{ id, address, context? }`.
- `/services` tiles: Ride (live), Courier (live), Reserve (soon), Assist
  (soon) (`src/app/services/page.tsx`, `LIMECAB_SERVICES` in `mock.ts`).
- Search is already a prepared fullscreen scene. Keep that (scene-preparation
  rule 5). Do **not** expand an inline field on Home.

**Desired**

- Keep one search scene. Results group into at most three sections when the
  query is ambiguous: **Ride there**, **Send there**, **Get from a store**.
  A query that is clearly an address (“Traction Ave”) can stay a flat list
  of places — do not pad with fake courier rows.
- Choosing “Ride there” is today’s `select_location` (vertical ride).
- Choosing “Send there” sets `vertical` to courier, destination (or pickup,
  if they were on courier home) from the place, then the existing configure
  scene. One tap, then *What are we carrying?* — do not skip configure.
- Choosing “Get from a store” is courier with the **store as pickup** and
  an item prompt waiting in configure (§6). If §6 is not done yet, still
  enter courier configure with pickup = that place.
- Intent classification is local (keywords: send, package, courier, get,
  pick up, store, butcher, plant, gift). Do not add `kind` to the kit’s
  `LocationSuggestion` unless you can do it without putting “courier” in
  `components/service-app`. Prefer wrapping results in `limecab-app` /
  a LimeCab search footer slot (`LocationSearch` already has `after`).
- Home hint may become “Where to?” still — Uber kept the phrase. Optional
  quieter subhint under the trigger (“Ride, send, or get”) is fine. The
  launcher still asks one question.

**Acceptance**

- “Griffith” → ride results (observatory). Tap → ride select as today.
- “send this to work” → courier configure, destination = Work saved place.
- “snake plant” / “butcher” → store-style result using a fixture (add 1–2
  store entries to the static geocoder: e.g. a plant shop, a butcher in LA).
  Tap → courier, pickup = that store.
- Empty / 2-character query: recents + saved, unchanged.
- No hotels, no menu items, no second search product on `/services`.

**Verify**

1. Ride path through One Search matches the pre-change booking path.
2. Courier path from a Send row does not skip configure; See price still
   waits for recipient (`LimeCabConfigureScene`).
3. Back from configure revises; location intact.
4. Minimized live ride: Home search still restores the ride instead of
   starting a second trip (existing guards in `limecab-app.tsx`). Do not
   break them.

---

### 3. Travel Mode (P0)

**Goal.** When the rider is away from their usual city, Home is a concierge
for *this* place: airport pickup, curated spots, typical wait — then the
same booking chain. Uber: Travel Mode on arrival in a new city; airport
guidance; local favorites; later OpenTable and hotel “room service”. We
take the first half.

**Current LimeCab**

- Home launcher: Where to? + Saved (Home, Work) + Recent (`limecab-home-scene.tsx`).
- Pickup defaults to `CURRENT_LOCATION` downtown LA (`mock.ts`). Home saved
  place is Echo Park.
- Geocode fixtures already include **LAX Terminal 4**, Griffith, Santa Monica
  Pier, Dodger Stadium, Union Station, Big Bear (outside service area).
- Live ride safety is a compact interrupt with trip id / plate and a share
  button (`LimeCabDetailSurface` `detail === "safety"`,
  `limecab-interrupts.tsx`). Profile `/profile/safety` has a Share trip
  switch that does not drive the live scene.
- `RIDER_SAFETY.shareTrip` is display-only.

**Desired**

- Travel Mode is **app data**, not a scene. Derive it:
  - Demo: a single control on Home (or Profile → Preferences) “I’m traveling”
    that sets a flag. Default **on** if pickup is LAX or destination was just
    set to LAX — optional, don’t over-detect.
  - When on: Home title/eyebrow “In Los Angeles” (or “Traveling”), a short
    **airport** row (LAX Terminal 4 → ride), a **curated** list of 3–4 fixture
    spots with wait copy (“usually 4 min”), then saved/recents as today.
  - When off: today’s Home, bit-for-bit.
- Tapping a curated spot is `chooseLocation` — same as SavedPlaces. Do not
  invent a city-guide TaskScene.
- Typical wait is copy from `RIDE_PRODUCTS[0].etaMinutes`, not a live
  heatmap. No surge polygons (driver handoff already forbids those).
- **Share trip:** on `assigned | provider_en_route | active`, the status
  scene already has a Safety detail. Add a direct **Share trip** control
  in the live sheet (secondary, not next to Cancel) that opens the existing
  safety interrupt / share sheet. In Travel Mode the label can read “Share
  with someone at home”. Do not add Live Video. Do not add teen accounts.
- Do not change Home from a sibling column. Curated rows live in the
  launcher, not on the map card.

**Acceptance**

- Travel Mode off: Home matches current layout (trigger, saved, recents).
- Travel Mode on: airport + curated spots visible; each starts a ride to
  that fixture; Big Bear still fails as outside the area if used.
- Live ride: Share trip reachable without opening Profile. Share still
  honest-empty (device share sheet / existing copy). Cancel remains an
  interrupt; Share is not Cancel.
- No indoor walking directions. No OpenTable. No hotel room service.

**Verify**

1. Toggle traveling on Home. Curated spots appear. Toggle off. They go.
2. Tap LAX row → ride select to Terminal 4.
3. Book any ride. On live sheet, Share trip → safety interrupt → dismiss →
   sheet restored (scroll, driver card). Minimize still works.
4. Desktop: launcher in the column, not a second map overlay.

---

### 4. Lime Reserve (P1)

**Goal.** Book ahead. Uber Eats for the Way is gated on a **confirmed
Reserve** Black/SUV. LimeCab lists Reserve as coming soon. Make it a real
product so §5 has somewhere to live. Assist stays coming soon.

**Current LimeCab**

- `LIMECAB_SERVICES` reserve: `coming_soon` (`mock.ts`). `/services` renders
  it as a non-button card.
- Ride configure is skipped (`needsConfigure: false` except courier)
  (`limecab-app.tsx`).
- `RIDE_PRODUCTS` have no scheduled-at field. `domain.ts` comments mention
  scheduled rides as future pickup edits.
- Quote is immediate (“Request Lime”).

**Desired**

- Flip Reserve to `available`. `/services` Reserve tile goes to
  `/?service=reserve` (mirror courier).
- Reserve is still a **ride**, not a new vertical enum if you can avoid it.
  Prefer: `vertical` stays `ride`, but `needsConfigure: true` when the
  entry was Reserve (or when the selected product is a reserve product).
  Question: *When do you want to be picked up?* One control: today/tomorrow
  chips + a time list (e.g. next 8 half-hours). Not a full calendar.
- Add `lime-reserve` (or reuse Lime Comfort as the reserve vehicle — one
  product is enough). ETA on the comparison row is the scheduled clock
  time, not “4 min”. Quote primary: **Reserve Lime** / **Confirm pickup**.
- Server: if `trip.request` cannot store a pickup time, keep it client-side
  on the quote and pass a note / meetingPoint, **or** add an optional
  `scheduledAt` on the request input if the schema already has a hole.
  Do not invent a reservations table. Do not block the demo on a migration
  if a client-side scheduled label on the live scene is enough.
- Back from configure revises to location, not Home-cleared.
- Immediate Lime products stay as they are. Reserve does not replace them
  on the default Home path.

**Acceptance**

- `/services` Reserve is tappable and starts a ride booking with a When?
  scene before price.
- Default Home “Where to?” still goes ride select with Lime/XL/Comfort/Pool.
- Confirming Reserve does not dispatch a car **now**. Matching copy:
  “Reserved for 6:30 PM” (truthful). If the existing sim always assigns
  immediately, show the scheduled label on assigned/live anyway and leave
  sim as-is — do not fake a 4-hour wait in the client timer.
- Assist remains coming soon.

**Verify**

1. Services → Reserve → destination → When? → quote → confirm.
2. Home ride path unchanged (no When? scene).
3. Back from When? keeps the destination.

---

### 5. For the Way (P1)

**Goal.** Coffee waiting in the car. Uber: after **Reserve Black / Black SUV**
is confirmed, tap “add Uber Eats”; driver picks up on the way; select cities.
LimeCab: after **Lime Comfort or Lime Reserve** is confirmed (quote, before
or immediately after request), offer a drink/snack add-on as an
**interruption**. Use the existing stop machinery.

**Current LimeCab**

- Route draft already supports up to 2 intermediate stops
  (`route-draft.ts`, wired in `limecab-app.tsx` search `onAddStop`).
- `RIDER_PREFERENCES.extraStops` is a profile switch, unused in booking.
- Quote has promo / payment interrupts, not add-ons
  (`limecab-quote-scene.tsx`).
- Courier is a separate vertical; do not start a second trip.

**Desired**

- After the rider confirms Lime Comfort or Lime Reserve (the moment the
  quote is committed, or a single optional row on that quote *after* the
  tier is chosen — not on Lime / Pool / XL). Prefer an **interrupt** from
  quote: “Add something for the ride?” Items: Coffee, Tea, Sparkling water
  (mock, fixed prices like +$5). Skip / No thanks returns to quote or to
  matching with nothing added.
- Yes → add one stop to a fixture cafe (add one geocode entry, e.g.
  “Grand Central Market” or a named coffee shop near downtown). The rider
  map already draws the route; include the stop. Do not open search.
- Live status subtitle may read “Picking up your coffee, then you” while
  `assigned | provider_en_route`. Once `active`, drop that line.
- **Driver app: no changes.** Do not add a merchant stop to the driver
  sheet. The extra stop is rider geometry + copy only.
- Payment: add the snack cents into the displayed total on quote if you
  add it *before* request; if you add it after request, show it as a
  line on the fare interrupt and do not lie that the server charged it
  unless you actually pass it through `trip.request`. Honest-empty is
  better than a fake charge. Prefer adding before request so the total
  is real.

**Acceptance**

- Lime / Pool / XL: no For the Way interrupt.
- Comfort (and Reserve): interrupt appears once per booking; Skip leaves
  no stop.
- Add Coffee: one stop on the route rail / map; quote total includes the
  add-on if done pre-request.
- Double-tap Add does not stack two coffees (lock / one add-on max).
- Parent quote or matching restores on Skip.

**Verify**

1. Book Lime: no snack interrupt.
2. Book Comfort: interrupt → Skip → request proceeds.
3. Book Comfort: Add Coffee → stop visible in trip details interrupt;
   live copy before pickup; in-ride copy gone.
4. `/driver` still one job, one CTA. Do not test a food waypoint there.

---

### 6. Courier: get from any store (P1)

**Goal.** Shop for Me, LimeCab-sized. Uber: request an item from a store
not on the app; photo + notes; shopper confirms before buying; in-store
price. We already have Courier. Extend configure — do not build a shopper
network.

**Current LimeCab**

- Courier configure: size, quantity, recipient, proof, instructions
  (`COURIER_OPTIONS` in `courier.ts`, `LimeCabConfigureScene`).
- Copy: “Sealed and ready at pickup.” That is the opposite of Shop for Me
  (the courier buys it).
- Pickup is the rider’s current location unless they edit it.

**Desired**

- Add optional courier options, disclosed only when the user came from a
  One Search “Get from a store” row *or* they pick a new choice
  “Already packed” vs “Buy for me”:
  - Already packed → today’s form.
  - Buy for me → item description (`kind: "text"`), optional “Add a photo”
    that is honest-empty (this build has no upload). Pickup defaults to
    the store if we have one.
- Shopper confirmation: Uber doesn’t buy without approval. We do not have
  messaging. Show a one-line status on matching/assigned: “Courier will
  text to confirm the item — messaging isn’t wired, so they will pick the
  described item.” Do not fake a chat thread.
- Price: keep courier fare as transport. Do not invent SKU prices. A note
  on quote: “Item cost is paid in store; this fare is the trip.”

**Acceptance**

- Packed courier path unchanged (recipient still required).
- Buy-for-me requires an item description before See price.
- Photo button explains there is no upload. Nothing is stored.
- One Search store row (§2) lands on Buy-for-me with pickup = store.

**Verify**

1. `/?service=courier` packed path: same as today.
2. Get-from-store path: item field, See price, quote footnote, request.
3. Progressive disclosure: packed users never see a photo button.

---

## Named actions to add (rider `surfaces.ts` only)

Add only what a gesture needs. Names are interactions, not animations.

| Action | When | What moves |
|---|---|---|
| `openVoiceBooking` | mic on Home or search | search primary fullscreen (or interrupt fullscreen); map locating |
| `voiceResolved` | parser committed a place | same as `destinationSelected` |
| `openTravelShare` | Share trip on live sheet | same as `openDetails` (safety interrupt) |
| `openForTheWay` | Comfort/Reserve quote ready | interrupt compact; quote suspended |
| `skipForTheWay` / `addForTheWay` | skip or choose item | `return` then continue request |

Do not add `setTravelMode` as a surface action. Travel Mode is data; Home
recipe stays `home`.

Do not put these on `driver-surfaces.ts`.

---

## Invariants (do not violate)

- One question per scene. Voice is still *Where?*. Reserve configure is
  *When?*. For the Way is an interruption (*Add a drink?*), not a scene.
- Interruptions suspend; they do not unmount. Quote drafts, search text,
  and live-ride scroll come back.
- Named actions only. No component sets drawer + map + footer itself.
- No `isMobile` in parsers, reducers, or tRPC.
- No product name in `components/service-app/` or `lib/service-app/`.
- Map stays mounted. Mercator, pitch 0. Camera padding from `--sheet-snap`.
- Truthfulness: do not show a driver, ETA clock, or “Reserved ride is on
  the way” before the server has a trip. Scheduled copy is a label, not a
  fake approaching car.
- Honest-empty for missing backends: speech fallback, photo upload, item
  chat, snack charge if not in `trip.request`.
- Progressive disclosure: no Confirm until a tier is chosen; courier See
  price waits for a ready form; For the Way does not appear before the
  Comfort/Reserve choice exists.
- Cap: ribbon + one primary. Snack interrupt is one question; do not also
  push promo + payment in the same breath.
- No `--token` on Vercel CLI.

---

## Do not redo

1. Sheet/map coordinator, minimize, recenter, payment overlay — surfaces
   handoff. Consume them; don’t rebuild them.
2. Driver duty session, offer interrupt, job sheet — driver handoff.
3. Pickup PIN, follow-cam, road polyline, `Referer` on directions.
4. Home as a map *card* + launcher. Task map un-rounded, full bleed.
5. Lime Pool availability (leave available).
6. Assist as coming soon (leave it).

---

## Key files

| Concern | File |
|---|---|
| Rider flow | `src/components/limecab/limecab-app.tsx` |
| Home launcher | `src/components/limecab/limecab-home-scene.tsx` |
| Rider surface recipes | `src/components/limecab/surfaces.ts` |
| Where to? trigger | `src/components/service-app/location-trigger.tsx` |
| Search scene | `src/components/service-app/location-search-scene.tsx` |
| Address combobox | `src/components/service-app/location-search.tsx` |
| Geocode seam | `src/lib/service-app/geocode-adapter.ts` |
| Stops | `src/lib/service-app/route-draft.ts` |
| Scene machine | `src/lib/service-app/state.ts` |
| Ride comparison | `src/components/limecab/limecab-ride-select-scene.tsx` |
| Quote | `src/components/limecab/limecab-quote-scene.tsx` |
| Courier configure | `src/components/limecab/limecab-configure-scene.tsx`, `src/lib/limecab/courier.ts` |
| Live ride + safety | `src/components/limecab/limecab-status-scene.tsx`, `limecab-interrupts.tsx` |
| Catalogue / fixtures | `src/lib/limecab/mock.ts` |
| Services tab | `src/app/services/page.tsx` |
| Trip request | `src/server/api/routers/trip.ts` |
| **Hands off** | `src/components/limecab/driver-*.tsx`, `driver-state.ts`, `src/app/driver/**` |

New (suggested): `src/lib/limecab/voice-booking.ts` (parser + tests),
`src/lib/limecab/search-intent.ts` (One Search classifier + tests).

---

## Verify in the browser (390×844, then 1280)

Dev server on **:3000** if you need a real Mapbox route (token is
URL-restricted; :3001 falls back to a straight line). Walk:

1. **Voice.** Mic → fallback utterance “LAX XL” → ride select, XL selected,
   Confirm still there. Back revises.
2. **One Search.** “Griffith” rides. “send to work” courier configure.
   “plant” store → courier buy-for-me.
3. **Travel Mode.** Toggle on: airport + curated. Toggle off: old Home.
   Live ride Share trip → dismiss → sheet intact. Minimize → pill → restore.
4. **Reserve.** Services → Reserve → When? → quote. Home ride path has no
   When?.
5. **For the Way.** Lime: no snack. Comfort: Skip and Add Coffee. Map shows
   the cafe stop. `/driver` unchanged.
6. **Packed courier** still requires recipient. Buy-for-me requires item
   text. Photo is honest-empty.

Console: no new `SurfaceManager` invariant warnings. `npx tsc --noEmit`
clean. Existing tests pass; add unit tests for the parser and classifier
(no browser required for those).

---

## Picking back up / order

1. Voice (§1) and One Search (§2) share the search scene — do them first,
   together if one session.
2. Travel Mode (§3) is Home-only plus a live Share affordance.
3. Reserve (§4) then For the Way (§5). Do not implement §5 without a
   Comfort/Reserve gate.
4. Courier buy-for-me (§6) pairs with the One Search store row.

If you only ship two sections, ship **§1 + §2**. They are the 2026 keynote
that actually fits a rideshare web app.
