# Handoff: driver app (Uber-shaped)

**Status: shipped 2026-08-27** (offer + live job). Idle home composition is
a follow-up: `.ux-bugs/HANDOFF-driver-ux.md` (offline map card, hunting
peek, recommended + GO OFFLINE, trends). Do not redo offers or jobs from
this file.

For the next Claude (or Cursor) session. Rebuild the **driver home and live
job** so it operates like Uber Driver: map-first, one offer at a time, one
primary action per scene, phone-on-the-dash. Do not restyle the current
inbox list. Do not invent a second map/sheet stack.

Read first: `.claude/skills/surface-orchestration/SKILL.md`,
`.claude/skills/adaptive-surfaces/SKILL.md`,
`.claude/skills/scene-preparation/SKILL.md`,
`.claude/skills/perceived-performance/SKILL.md`. Named surface actions only.
One question per scene. Interruptions suspend; they do not unmount.

This is a **new product shell on existing primitives**, not a visual polish
pass on `/driver`. The tRPC router (`src/server/api/routers/driver.ts`) and
the trip state machine (`src/server/limecab/state.ts`) stay. The UI does
not.

---

## What exists today (do not polish this)

`/driver` is a **document inbox**:

- Layout is `max-w-md px-5` with a sticky text header
  (`src/app/driver/layout.tsx`). No map. No sheet. No AdaptiveSurface.
- Duty is a coloured card + Power button (`src/app/driver/page.tsx`).
- Offers are a **list of cards** (`DriverOfferCard`) with Accept/Decline
  and a 20s client timer. Multiple offers stack. Decline is local state
  (`declined: string[]`) — the server has no decline mutation.
- Active jobs are another list that **navigates away** to
  `/driver/trips/[tripId]`, a second document page with addresses and a
  sticky CTA. No map, no navigation, no rider identity.
- Heading filter is chips (Anywhere / Home / Work / Union Station).
- Profile, earnings, documents, safety, help are separate routes and are
  **fine**. Leave them. They are account, not the driving product.
- Inbox polls every 4s. Trip page polls every 4s until terminal.
- `limecab-shell.tsx` already bypasses rider chrome for `/driver`.

A driver in a car cannot use a scrollable list of cards. Uber solved this
years ago: the map is the app, the offer is an interrupt, the job is a
sheet with one thumb-zone action.

---

## How Uber Driver actually operates

Copy the **operating model**, not the Uber logo, GO circle, or purple.
LimeCab already has lime, sheets, and a rider map. Use those.

### The physical context (this decides every layout choice)

The phone is mounted landscape-or-portrait on a dash or in a cup holder.
The driver glances for 300ms, then looks back at the road. Thumbs reach
the bottom third. Sun glare. Gloves. One hand.

Consequences, all non-negotiable:

- **Type is huge.** Fare on an offer is ~40–56px. Primary CTA is 56–64px
  tall, full width, in the thumb zone. Never put the only action behind
  a scroll.
- **One thing to do.** Offline: Go online. Online idle: wait (status, not
  a question). Offer: Accept. En route: I’ve arrived. At curb: Start
  ride. On trip: Complete. Never two primaries.
- **The map is always there.** It is how the driver orients. A list with
  no map is a different product.
- **Sound + haptic on an incoming offer.** Drivers listen for the ping
  with the screen off-ish. A silent list append is a missed ride.
- **No chrome competition during a job.** Account, earnings, heading
  filter recede. Safety and contact stay reachable, but they are
  interruptions, not a second primary.

### The Uber session, beat by beat

Uber Driver is not “an inbox of jobs”. It is a **duty session** that
moves through a small set of postures. LimeCab already has the matching
trip statuses (`requested → matched → arriving → in_progress → complete`).
The driver UI must follow those statuses as **scenes**, not as list
labels.

#### 1. Offline (Uber: big GO)

The map is full-bleed, showing the driver’s location (or last known).
A short bottom sheet (peek) holds:

- Today’s earnings (tappable → `/driver/profile/earnings`)
- A heading/destination chip if set
- One primary: **Go online**

The rest of the account (profile avatar) lives in a corner of the map,
not in a document header that eats vertical space. Safety (911) is a
small map-overlay control, always visible, never competing with GO.

Uber’s GO is a giant circle. We do not need the circle. We need the
**same information hierarchy**: map dominant, earnings glanceable, one
loud duty action.

Going online is a `setAvailable({ available: true })` mutation. The
surface must acknowledge on the tap (`surface.transition` / lock) — do
not freeze the GO button for 800ms with no map change.

#### 2. Online idle (Uber: “Looking for trips”)

The map stays. The sheet **drops to peek**. Copy is status, not a
question: “Looking for rides” + today’s $ + hours-online if we have it
(we may not; today’s $ is enough).

The driver can:

- Pan the map (interaction: active on the canvas)
- Tap earnings
- Change heading (interrupt or a chip that opens search — heading
  already exists as `setHeading`)
- Go offline (secondary, not next to a primary that does not exist)

There is **no “New rides” list**. An empty list titled “Waiting for
requests” is the current bug. Uber shows an empty peek and a live map.
The next event is an offer interrupt, not a row appearing under a
heading.

Poll faster while online (1s is fine for this build; sockets are out of
scope). When `inbox.open` gains a trip the driver can take, do not
append a card — **open the offer interrupt**.

#### 3. Incoming offer (Uber’s most important surface)

This is the moment the whole app exists for. Uber treats it as a
**full-attention interrupt**:

- A distinct sound (and haptic if the device allows).
- The idle peek is **suspended, still mounted** (earnings, online
  state, map camera survive a decline).
- A large sheet (or compact-interrupt that is visually a sheet, not a
  tiny dialog) rises with a **countdown**.
- Map mode switches to show pickup (and a line from the driver to
  pickup). Dropoff pin is optional until accept — Uber often shows
  neighbourhood + trip time, not the exact street, until the driver
  commits. LimeCab already exposes both addresses; showing both is OK
  for this build, but **fare and time-to-pickup are louder than the
  street strings**.

**Offer anatomy, in this order, top to bottom of the sheet:**

1. **Fare** — `formatMoney(trip.totalCents)`, the largest number on
   screen. This is how drivers decide in two seconds.
2. **Product + shape** — `productLabel` · trip miles · trip minutes.
3. **Time to pickup** — `arrivalMinutes` as “4 min away”, not buried
   in a middot list. This is the second decision input (deadhead).
4. **Route rail** — pickup (dot) then destination (square). Same visual
   language as the current trip page. Courier: merchant then recipient.
5. **Countdown** — a determinate ring or bar around/beside Accept,
   15–20s (`OFFER_SECONDS` is already 20). When it hits 0 the interrupt
   **returns** to online idle (parent restored). Same as today’s
   `onGone`, but it must dismiss the surface, not splice a list.
6. **Accept** — the only primary. Full width, 56–64px.
7. **Decline** — ghost/outline, or just let the timer expire. Do not
   make Decline equal visual weight to Accept. Uber sometimes hides
   explicit decline; timeout is the decline. Keep an explicit Decline
   so testers are not stuck, but style it as secondary.

**One offer at a time.** If `inbox.open` has three trips, show the
best one (nearest pickup / highest fare — pick nearest pickup, it is
the Uber default when not surfing). Do not stack cards. When that
offer expires or is declined, the next eligible open trip may
interrupt immediately.

**Accept is progression, not an interrupt return.**

```
online (peek, map idle)
  --offer arrives--> interrupt offer (parent online stays mounted)
       --Decline / timeout--> return to online
       --Accept--> progress to to_pickup  (clears interrupt history)
```

`driver.accept` is compare-and-set. On CONFLICT (“That ride is no
longer available.”) **return** to online with an inline error, do not
navigate to a 404 trip page. Today the trip page handles `taken` as a
flag; fold that into the offer interrupt.

On success, do **not** `router.push(/driver/trips/id)`. Stay on
`/driver`. The scene becomes `to_pickup` with the accepted trip id in
app data. The trip detail route can remain as a deep link / fallback
but it is not the live product.

Use `surface.transition({ intent: "progress", from: "online", to: "to_pickup", task: () => accept.mutateAsync(...) })`.
Interim: map. Do not show “Head to pickup” or a named rider until
`taskStatus === "fulfilled"`. Copy during the gap: “Taking this ride…”.

#### 4. En route to pickup (Uber: navigation dominates)

Uber’s screen after accept:

- **Map is the subject.** Follow-cam, route from driver → pickup.
  Mode: `provider_arrival` / LimeCab `tracking`. The rider app already
  does follow-cam + road-following polyline — reuse it. The driver is
  now the “provider” point; the pickup is the target.
- **Top of canvas:** next-street / destination chip — for this build a
  compact **pickup address + ETA** bar is enough. Do not build a
  turn-by-turn engine. Optional: “Open in Maps” using a
  `maps.apple.com` / Google maps URL from the pickup coords. That is
  how a lot of real drivers navigate anyway.
- **Sheet is peek or short sheet**, not expanded. Question: *Have you
  arrived?*
- Content: rider first name (join `trips.userId` → `users.name` in
  `driver.get` if missing — first name only), rating if we have it
  (we may not on the rider; skip rather than fake), pickup address,
  meeting point, **PIN** (rides only — already on `driver.get` once
  assigned).
- Contact: Call / Message as interruptions or `tel:` / a stub. Masked
  numbers are out of scope; `tel:` to a placeholder is OK if we lack a
  rider phone.
- Primary: **I’ve arrived** → `driver.advance({ action: "arrive" })`.
- Secondary: Cancel this job — **interruption** (confirm), then
  whatever cancel path exists. If the driver cannot cancel server-side
  today, do not fake a working cancel; omit or honest-empty. Do not
  invent a status.

Peek during this scene must still fit the CTA. If peek is too short,
use `sheet` (40%), not `expanded`. The map has to remain visible —
this is a driving task.

Courier variant: “Head to merchant”, meeting point, no rider PIN.
Primary is still I’ve arrived.

#### 5. At the curb (Uber: waiting + Start trip)

Uber switches copy to “Waiting for [Name]”, starts a wait clock, and
the primary becomes **Start trip** / **Pick up [Name]**. PIN is now
the verification: driver reads it, rider confirms.

LimeCab: `arriving` status. Question: *Is the rider with you?*

- PIN stays large (the trip page already does a lime PIN block — keep
  that treatment in the sheet).
- Primary: **Start ride** → `advance({ action: "start" })`.
- Courier: **Scan pickup** + the merchant code field that already
  exists on the trip page. The code field is the answer to the scene’s
  question; the button confirms it. Do not put the code field on every
  scene.

Do not geofence in this build (Uber greys Arrive if you are far). If
easy, disable Arrive until the device is roughly near pickup; if not,
leave it tappable. Do not block the demo.

#### 6. On trip (Uber: navigate to dropoff)

Map mode `active_route` / LimeCab `trip`. Follow-cam along the route
to destination. Sheet question: *Have you finished?*

- Destination address is now the loud location (pickup becomes a
  summary).
- Rider card stays (contact still available).
- Primary: **Complete ride** → `advance({ action: "complete" })`.
- Courier: recipient + proof (PIN / left at door / signature) — the
  trip page already branches on `deliveryProof`. Move that UI into
  this scene’s sheet, still one primary.

Uber does not let you cancel once the rider is in the car. LimeCab’s
state machine already forbids it (`in_progress` → complete only).
Do not add a cancel button here.

#### 7. Complete (Uber: fare splash, then immediately hunt again)

A short expanded (or sheet) **result**: fare collected, destination,
then one action **Done** / auto-return to **online idle** after ~2s.
Uber keeps you online and will fire the next offer on top.

Do not dump the driver on a document “Ride finished” page with “Back
to inbox”. Progress: `on_trip → complete → online`. `complete` may be
a brief scene (question: *What did you earn?*) then auto-progress.

Today’s earnings in the peek must include this trip after refetch.

#### 8. Earnings, heading, safety (always around, never the product)

- **Today $** is on the idle peek, tappable to the existing earnings
  route. Uber puts this on every idle frame because drivers optimize
  for it.
- **Heading** is Uber Destination Filter. We already have
  `offerHeadsToward` + `setHeading`. Surface it as one chip on the
  idle peek (“Heading to Home” / “Anywhere”). Changing it is an
  interrupt or a small search overlay; it must not be a row of chips
  that eat the map on every state.
- **Safety toolkit + 911** stay one tap from the map overlay, as
  Uber’s shield. They are already on the inbox; move them to a map
  control so they survive the redesign.
- **Profile** is the existing `/driver/profile` stack. Avatar on the
  map opens it. Do not rebuild profile.

### What Uber does that we are **not** building

Leave these out unless a later handoff says otherwise:

- Heat maps / surge polygons
- Airport queues
- Uber Pro tiers / points
- In-app turn-by-turn with spoken prompts (pref toggle already exists
  as honest-empty in preferences)
- Acceptance-rate scoring / consecutive-trip bonuses
- Destination-filter radius editor on the map
- Multiple simultaneous stacked offers
- Driver photo upload, documents OCR
- Instant pay processing
- WebSockets (poll while online; 1s)

---

## Target composition (mobile, `/driver` once registered)

Always `layout="task"` on the driver home. The map is the background.
The sheet floats. Same rule as the rider task handoff: **do not inset
the map box** to sit above the sheet; pad the camera.

Z-order:

```
[ map overlay ]
    [ avatar ]              top-leading, opens /driver/profile
    [ 911 / safety ]        top-trailing
    [ optional job bar ]    pickup/dropoff chip during a live job
[ map — full bleed ]
[ sheet
    [ handle ]
    [ scene content ]
    [ action band ]         one primary, optional secondary
]
```

Desktop: sheet becomes a floating side card (AdaptiveSurface already
does this). Same scenes, no `isMobile` in the reducer.

Registration (`RegisterForm`) can stay a document **until** they have a
driver row. After `driver.inbox` returns a driver, the map product
takes over. Do not wrap the map around the empty register form.

---

## Driver scene machine (new)

Do **not** reuse rider `ServiceAppState`. The questions are different.
Add a driver state enum (name it clearly, e.g. `DriverAppState`) in
something like `src/lib/limecab/driver-state.ts` (UI scenes — the
server file `src/server/limecab/state.ts` is the trip machine and
must not be overloaded).

```
offline | online | offer | to_pickup | at_pickup | on_trip | complete
```

| Scene       | Question (one)              | Trip status     | Presentation | Map mode   |
|-------------|-----------------------------|-----------------|--------------|------------|
| offline     | Do you want work?           | —               | peek         | home/bounded |
| online      | (status: looking)           | —               | peek         | home or coverage |
| offer       | Do you take this job?       | requested       | sheet / compact-interrupt | tracking to pickup |
| to_pickup   | Have you arrived?           | matched         | sheet        | tracking   |
| at_pickup   | Is the rider with you?      | arriving        | sheet        | tracking   |
| on_trip     | Have you finished?          | in_progress     | sheet        | trip       |
| complete    | What did you earn?          | complete        | sheet        | receipt    |

`offer` is an **interrupt** of `online` if you model it as a surface
interrupt with scene still `online`. Either is fine; pick one and
stick to it:

- **Preferred:** scene stays `online`; offer is
  `surfaces.perform("offerIncoming")` + `AdaptiveSurface.Interrupt`.
  Accept is `progress` to `to_pickup`. Decline/timeout is `return`.
- **Also fine:** scene `offer` with `back` → `online`. Then Accept is
  `progress` to `to_pickup`.

Do not introduce booleans (`showOffer`, `isArriving`, `drawerOpen`).
Derive the live-job scenes from `inbox.active[0]` (a driver has at
most one non-terminal trip in practice; if the API returns several,
take the newest). Hydrate on load: if they refresh mid-job, land in
the matching scene, not offline.

Events (illustrative): `go_online`, `go_offline`, `offer_shown`,
`offer_dismissed`, `accepted`, `arrived`, `started`, `completed`,
`done`. Wire each to `reduce` + `backDriverAppState`. Offline from
online is allowed. Offline during a live job is **not** — Uber
prevents going offline on a trip; hide GO until complete.

`serviceAppQuestion` equivalent: a `driverAppQuestion(state)` that
owns the headline + primary label. Scene components do not hardcode
“I’ve arrived”.

---

## Surface recipes

New file: `src/components/limecab/driver-surfaces.ts` (do not cram
into rider `surfaces.ts`). Same `createSurfaceManager` pattern.

Named actions (interaction names, not animation names):

| Action            | When                         | What moves                                      |
|-------------------|------------------------------|-------------------------------------------------|
| `goOnline`        | tap Go online                | peek stays; duty chrome switches                |
| `goOffline`       | tap Go offline               | peek stays                                      |
| `offerIncoming`   | poll sees an open trip       | interrupt up; map → tracking                    |
| `offerDismissed`  | decline / timeout            | interrupt return; map back to idle              |
| `accepted`        | accept fulfilled             | interrupt gone; primary sheet; map tracking     |
| `arrived`         | arrive fulfilled             | same sheet, new scene content                   |
| `started`         | start fulfilled              | map → trip; sheet still primary                 |
| `completed`       | complete fulfilled           | map → receipt; then `resumeIdle`                |
| `resumeIdle`      | after complete / dismiss     | peek; map idle; still online                    |
| `openHeading`     | tap heading chip             | interrupt or search overlay                     |
| `openSafety`      | tap shield                   | compact-interrupt                               |

One `perform` per gesture. The trip mutation runs under
`surface.transition({ task })`. On rejection, restore the origin
scene with the inline error next to the CTA (perceived-performance
rule 6).

---

## Work to do

### 1. Map-first driver shell (P0)

Replace the document layout of `/driver` (once registered) with
`ServiceAppShell layout="task"`, the existing Mapbox canvas, and a
driver sheet.

- Keep `/driver` as the only live URL for duty + job. Do not hop to
  `/driver/trips/[id]` on accept.
- Reuse `ServiceMap` + the rider Mapbox adapter. Driver location:
  `navigator.geolocation.watchPosition` while the page is open (the
  rider app already uses `getCurrentPosition` for recenter). Center
  the idle map on the device. Fallback: `CURRENT_LOCATION` /
  `DRIVER_START` from `mock.ts` if geolocation fails, same as rider.
- Driver layout currently sets `max-w-md px-5`. The map product needs
  a full-bleed shell. Keep the register form in the padded column.
  After register, render a full-viewport shell **inside** the driver
  layout or split the layout: no horizontal padding on the map
  product. Profile routes can keep the padded column.
- `--service-app-chrome`: driver has no rider tab bar. Use a thin
  overlay (avatar) instead of the current 4rem sticky header on the
  map product so the map can go under the status bar.

Files: `src/app/driver/layout.tsx`, `src/app/driver/page.tsx`, new
`src/components/limecab/driver-app.tsx` (mirror `limecab-app.tsx` at
a smaller scale), `driver-surfaces.ts`.

### 2. Duty peek + earnings (P0)

Offline and online are the same peek geometry, different copy and
primary.

- Offline primary: Go online.
- Online: no primary (or a quiet Go offline as a text button). Status
  line “Looking for rides”.
- Today’s $ from `inbox.todayCents`, tappable to earnings.
- Heading as **one chip**, not a wrap row of four buttons. Tap opens
  the existing presets (interrupt). `offerHeadsToward` stays the
  filter.

The loud colour switch on the current duty card can become a 8–10px
status dot + “Online” on the peek. Do not keep a 200px green panel
that eats the map.

### 3. Offer as interrupt (P0) — the load-bearing implementation

Kill `DriverOfferCard` as a list item. Rebuild it as the offer
surface (you may keep the timer math).

Must-haves:

- Determinate countdown the driver can see at a glance (ring around
  Accept or a thick bar). `left` already ticks every 250ms.
- Fare first, then deadhead, then route rail.
- Sound: a short `Audio` chime on interrupt open (bundle a small mp3
  or use `AudioContext` beep). Respect `prefers-reduced-motion` for
  *animation*, not for the sound — but mute if the document is not
  yet unlocked; do not break Safari. If autoplay is blocked, the
  visual interrupt is still the product.
- Accept → `driver.accept` under `transition`. Conflict → return to
  online + error.
- Decline / 0s → `onGone` + `return`. Then if another open trip
  exists, `offerIncoming` again.
- Poll interval 1s while `available && scene === "online"`. 4s is too
  slow for this surface.

Do not show offers when `available === false`.

### 4. Live job sheet + map (P0)

One sheet component (or three tiny scene files) bound to
`to_pickup | at_pickup | on_trip | complete`.

Move from `src/app/driver/trips/[tripId]/page.tsx`:

- Status eyebrow + headline via `driverAppQuestion`
- PIN block
- Courier merchant/recipient + proof fields
- Single advance CTA (`I’ve arrived` / `Start ride` / `Complete`)
- Sticky action band in the sheet (`SheetActions`), not a page-level
  `sticky bottom-0 -mx-5`

Map:

- `to_pickup` / `at_pickup`: route driver → pickup, follow-cam
- `on_trip`: route driver → destination, follow-cam
- Reuse rider directions + `Referer` (`mapbox-request.ts`). Mercator,
  pitch 0. No globe.

Hydration: on `inbox` load, if `active.length > 0`, skip idle and
`perform("accepted")` (or equivalent) into the right scene from
`trip.status`. Refresh mid-job must not flash the GO button.

Keep `/driver/trips/[id]` working as a fallback (direct URL) but it
can render the same scenes or redirect to `/driver`. Do not leave two
divergent UIs.

### 5. Rider identity on the job (P1)

`driver.get` does not currently return the rider. Join `users` for
`name` (first token only) on assigned trips. Show it on the sheet the
way Uber shows the rider card: name, then pickup, then PIN. Do not
fake a rating. Initials avatar via `ProviderCard` is fine (the
component is vertical-agnostic).

Courier: keep `recipientName` as today; do not invent a rider.

### 6. Map overlay controls (P1)

- Avatar → `/driver/profile`
- Shield / 911 (keep both; 911 is `tel:911`)
- Recenter on the driver (same geolocation path as rider
  `recenterPickup`)
- During a job: compact address chip (pickup then destination)

These sit on the canvas between the top safe area and the sheet, same
as the rider destination bar. They are not sheet content.

### 7. Complete → back online (P1)

After `complete`, show fare for a beat, refetch inbox, `resumeIdle`
while still `available: true`. The next offer may interrupt
immediately. Do not force a navigation to earnings.

---

## Invariants (do not violate)

- One question per scene. Confirm/Accept/Arrive/Start/Complete is the
  answer to that question, in the sheet action band.
- Interruptions (offer, heading, safety, decline-confirm) suspend the
  parent. Online peek state (earnings, heading, scroll) comes back
  byte-for-byte after a declined offer.
- No `isMobile` in the driver reducer or in tRPC handlers.
- No product name inside `components/service-app/`. Driver-specific
  copy lives under `components/limecab/`.
- Do not unmount the map between offline → online → offer → job.
- Do not `router.push` on accept.
- Do not list multiple offers.
- Do not go offline during `matched | arriving | in_progress`.
- Truthfulness: never show “Head to pickup” or a PIN before accept
  has fulfilled.
- Server trip machine stays the source of legal actions
  (`driverMay` / `advance`). The UI only offers the one legal action.
- No `--token` on Vercel CLI.
- Car-mount: primary CTA ≥ 56px, fare glanceable, no action only
  reachable by scrolling.

---

## Key files

| Concern | File |
|---|---|
| Current inbox (replace body) | `src/app/driver/page.tsx` |
| Driver layout chrome | `src/app/driver/layout.tsx` |
| Offer card (reuse timer, not list) | `src/components/limecab/driver-offer-card.tsx` |
| Job document page (fold in) | `src/app/driver/trips/[tripId]/page.tsx` |
| tRPC (keep, maybe join rider name) | `src/server/api/routers/driver.ts` |
| Trip legal actions | `src/server/limecab/state.ts` |
| Heading filter | `src/lib/limecab/heading.ts` |
| Rider shell bypass | `src/components/limecab/limecab-shell.tsx` |
| Rider surface recipes (do not overload) | `src/components/limecab/surfaces.ts` |
| Shell / map / sheet primitives | `src/components/service-app/service-app-shell.tsx`, `service-sheet.tsx`, `service-map.tsx` |
| Map modes | `src/lib/service-app/map-adapter.ts` |
| New: driver app | `src/components/limecab/driver-app.tsx` |
| New: driver scenes | `src/lib/limecab/driver-state.ts` (UI enum) |
| New: driver recipes | `src/components/limecab/driver-surfaces.ts` |

Profile / earnings / safety / documents / preferences: **do not
rebuild**.

---

## Verify in the browser (390×844)

Use two sessions if you can (rider + driver). Simulation
(`SIMULATE_DRIVERS`) will steal `requested` trips in non-prod — for
driver testing, accept as the human driver **before** the sim assigns,
or disable sim. A real accept always wins (`simulate-driver.ts`).

1. Sign in as a driver. `/driver` after register is a **full-bleed
   map**, not a padded card stack. Register form still works for a
   new user.
2. Offline: peek + Go online + today’s $. Map visible above the peek.
3. Go online: peek shortens/stays, copy becomes Looking, GO becomes
   secondary Go offline. Map does not remount (no flash).
4. From a rider, request a ride. Within ~1s the **offer interrupt**
   covers the peek: huge fare, countdown, Accept. A chime if unmuted.
5. Wait out the timer: interrupt leaves, idle peek restored
   (earnings still there).
6. Trigger another offer. Tap Accept: sheet becomes Head to pickup,
   map shows route to pickup, PIN visible, I’ve arrived in the thumb
   zone. URL still `/driver`.
7. I’ve arrived → PIN still there, primary becomes Start ride.
8. Start ride → map toward destination, primary Complete.
9. Complete → fare, then back to Looking (still online).
10. Decline path, accept CONFLICT path (two browsers), courier pickup
    code + delivery PIN if you touch courier.
11. Mid-job refresh lands on the job, not GO.
12. Avatar opens profile. 911 is reachable during a job. Heading chip
    on idle only.
13. Desktop: sheet as a card, same actions, no second state machine.

If any step still looks like a list titled “New rides”, the job is
not done.

---

# Status — built 2026-08-27

The rebuild in this handoff is **done and verified**. `/driver` is a duty
session on a map; it is no longer an inbox. Read this section first if you
are picking the work back up.

## What shipped

| Concern | File |
|---|---|
| Driver scene machine (UI) | `src/lib/limecab/driver-state.ts` (+ `.test.ts`) |
| Surface recipes | `src/components/limecab/driver-surfaces.ts` |
| Map-first shell, polling, offer detection | `src/components/limecab/driver-app.tsx` |
| Duty peek / offer / job / fare scenes | `src/components/limecab/driver-scenes.tsx` |
| `/driver` full-bleed vs. padded profile routes | `src/components/limecab/driver-chrome.tsx` |
| Register form + product switch | `src/app/driver/page.tsx` |
| Session gate only | `src/app/driver/layout.tsx` |
| Old job document → `redirect("/driver")` | `src/app/driver/trips/[tripId]/page.tsx` |
| Rider first name + phone on active trips | `src/server/api/routers/driver.ts` (`inbox`) |

`src/components/limecab/driver-offer-card.tsx` is **deleted**. The tRPC router
and `src/server/limecab/state.ts` are unchanged apart from the `users` join.

## Decisions this handoff left open

- **The offer is an interruption of `online`, not a scene.** The handoff
  allowed either; this is the "preferred" branch. So `DriverAppState` is
  `offline | online | to_pickup | at_pickup | on_trip | complete` — there is
  no `offer` member, and declining is `{ intent: "return" }` rather than a
  backwards transition. The ride being offered is app data (`offeredId`).
- **The scene is derived from the server, corrected not commanded.** One
  effect reconciles `scene` against `inbox.active[0].status` (and `available`
  when there is no job), which is what makes a mid-job refresh land on the
  job. User actions still go through `reduceDriverAppState`. The `complete`
  scene is exempt — a completed trip has already left `active`, so the fare
  splash holds its own copy of the row.
- **Failures are owned locally** (`failure` state in `DriverSurfaces`), not
  read off `surface.progress.error`. The progress machine keeps its error
  until the *next* transition starts, so a refused accept would otherwise
  print "That ride is no longer available." on the next ride's card. The
  progress machine still owns the lock, the choreography and the reversal.
- **Accept clears `offeredId` explicitly** (`onOfferTaken`). Without it
  `hunting` stays false forever and no second offer is ever shown. If you
  refactor the offer plumbing, keep a test on this.

## Deliberately not built

- **Idle map panning + recenter.** `ServiceMap`'s `interactive` also draws the
  kit's centre pin crosshair (`mapbox-canvas.tsx`), which is a rider
  affordance and wrong for a driver. The canvas instead auto-follows the
  device fix, which makes a recenter control redundant. To add panning, give
  `MapViewProps` a flag that separates "pannable" from "placing a pin", then
  add the recenter control back — the two go together.
- **Cancel this job.** There is no driver cancel path on the server. Not
  faked, per the handoff's truthfulness rule. Needs a router mutation first.
- **Geofencing Arrive**, turn-by-turn, masked phone numbers. "Open in Maps"
  (a `google.com/maps/dir` link) is the honest navigation escape hatch.
- The courier branch (pickup code, delivery proof) is **implemented but only
  type-checked** — it was never exercised against a real courier trip.

## Gotchas that cost time

- **`pnpm build` fails while `next dev` is running** against the same
  `.next`: it reports `Cannot find module for page` for unrelated routes.
  Not a code error. Build with a separate `distDir` or stop the dev server.
  If you do use a temporary `distDir`, Next rewrites `tsconfig.json` —
  `git checkout -- tsconfig.json` afterwards.
- **The Mapbox token is URL-restricted.** On any origin that is not in its
  allowlist (e.g. a dev server that fell back to port 3001, or a new
  deployment domain) both the tiles and `/api/map/directions` 403. The map
  goes blank and the route line disappears; nothing is wrong with the app.
- **Simulation steals `requested` trips** in non-prod, but only when a rider
  polls `trip.get`. Inserting a trip row straight into the DB and never
  opening it as a rider is the quickest way to test the offer surface.

## Verified at 390×844 (and 1280 desktop)

All thirteen steps of the checklist above, against a live database: offline
peek → GO → offer interrupt → Accept (no navigation, URL stays `/driver`) →
PIN → Start ride → Complete → fare splash → auto-return online with today's
take updated. Plus timeout-dismiss restoring the peek intact, explicit
Decline, accept CONFLICT returning to the peek with an inline reason, mid-job
refresh, the heading interrupt, the register form, and the desktop side card
with the offer as a centred dialog. Console clean — no errors and no
`[SurfaceManager]` invariant warnings. `typecheck`, `lint`, 82 tests and a
production build all pass.
