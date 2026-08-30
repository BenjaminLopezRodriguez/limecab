# Handoff: Lime Freight / Partner (doctrine pass)

**Status: domain shipped; UI orchestration needs a rider/driver-grade rebuild.**  
This is a work order for the next Claude session. Do not re-derive the
freight marketplace from Uber marketing pages. Keep the domain modules;
make the surfaces feel like Lime.

Read first:

- `.claude/skills/surface-orchestration/SKILL.md`
- `.claude/skills/adaptive-surfaces/SKILL.md`
- `.claude/skills/scene-preparation/SKILL.md`
- `.claude/skills/perceived-performance/SKILL.md`
- `.ux-bugs/HANDOFF-driver.md` (operating-model rebuild pattern)
- `.ux-bugs/HANDOFF-surfaces.md` (map under sheet, chrome vars)

Named surface actions only. Progression vs interrupt. Do not invent a
second map/sheet stack.

---

## Non-negotiables

1. Copy Uber Freight’s **operating model / IA nouns** only. Do NOT copy Uber
   visual design, assets, wording, logos, or exact screens.
2. Lime is **not assumed to be a motor carrier**. Respect
   `FREIGHT_OPERATING_MODE` / broker isolation. Simulated loads stay
   simulated (no real Stripe/ledger payouts for sim).
3. **Do not create parallel infrastructure** where Lime already has an
   equivalent (auth, drizzle, tRPC, money/ledger, H3/spatial,
   ServiceAppShell, AdaptiveSurface, SurfaceManager, location search).
4. Reference architecture = **rider + driver**, NOT the current freight
   portal card grids:
   - Rider: `src/components/limecab/*`, `surfaces.ts`, scene→recipe bridge
   - Driver: `/driver`, `driver-surfaces.ts`, offer-as-interrupt, map-first
5. Partner is a **gateway only**. Product switching lives there (or
   account) — not sticky Ship/Carrier/App toggles on every freight page.

---

## What already exists (keep domain; question UI)

### Domain (mature — do not rebuild blindly)

- Lib: `src/lib/freight/*` (load-state, pricing, economics, types, tests)
- Server: `src/server/freight/*`, `src/server/api/routers/freight.ts`,
  authz, booking CAS, settlement/advance
- Migrations: `drizzle/0012_*`, `drizzle/0013_freight_settlements.sql`
- Seed: `pnpm db:seed:freight`

### Routes today

| Path | Role |
|------|------|
| `/partner` | Gateway: Drive, Freight app, Fleets, Shipping, Carrier, Merchants |
| `/partner/fleets` (+ invite/join) | Fleet hub stubs |
| `/partner/merchants` | Merchant interest form stub |
| `/freight` | Shipper desk (New move · Shipments) |
| `/freight/shipments`, `/freight/shipments/[id]` | Shipper list/detail |
| `/freight/carrier/*` | Portal: Search · Lanes · Loads · Fleet |
| `/freight/driver` | Tabbed “freight app” |
| `/driver` | Lime rides driver (generic road app) |

### Chrome debt

- `FreightChrome` — phone product switcher (mostly leftover for driver)
- `FreightShipperShell` — shipper desk + `--service-app-chrome`
- `FreightPortalShell` — carrier portal top nav
- Custom bottom tabs on freight driver
- `freight-carrier-surfaces.ts` / `freight-driver-surfaces.ts` largely
  **unwired** (false promises)

---

## Why it feels unclean vs rider / driver

Prompt path was: marketplace domain mega-spec → route split → “one
generic driver” → `/partner` hub → `/freight/driver` Uber app again →
portal IA → desktop widen late.

Rider/driver were prompted as **one composition rule** (map + sheet,
named actions). Freight was prompted as **Uber’s product map** with Lime
tokens bolted on. Multiple chromes, card/pill inventory UI, domain ahead
of surface orchestration.

Mid-session contradiction (must freeze before coding):

- **A** — Unified `/driver`; freight unlocks via fleet/qualification;
  `/freight/driver` redirects or deep-links into driver freight mode.
- **B** — Permanent Uber-shaped split: keep `/freight/driver` app +
  `/freight/carrier` portal + `/freight` shipper.

**Default if human is asleep / unreachable: freeze A** (matches the
explicit “one generic driver interface” intent). Document the freeze at
the top of your plan.

---

## Implementation goals

1. **Audit** partner/freight vs rider/driver doctrine. Short plan: keep /
   rewrite / delete. If human is present, wait for yes; if running via
   `scripts/claude-implement-freight-partner.sh` unattended, freeze **A**,
   write the plan into this file under “Session plan”, then implement.
2. **Collapse chrome**: one shell per product; correct
   `--service-app-chrome`; no production role toggles (gateway = `/partner`).
3. **Shipper `/freight`**: keep desktop expand via `ServiceAppShell` home
   grid. Compose → quote → publish = progressions; loc search = interrupt.
4. **Carrier portal**: desktop IA nouns can stay (Search · Saved Lanes ·
   My Loads · Fleet), but rebuild using Lime patterns. Wire or delete
   `carrierSurfaces`. Map hunt only as a real duty session.
5. **Road freight** per freeze A or B:
   - A: extend `/driver` with freight capability gating from fleet
     membership; thin `/freight/driver` → redirect.
   - B: rebuild `/freight/driver` on ServiceAppShell + SurfaceManager
     like `/driver` (live job/book = map+sheet, not document lists).
6. **Partner**: gateway only; desktop-capable; fleets/merchants stubs OK
   if labeled.
7. **Delete dead code**: unused surface managers, obsolete chrome paths,
   duplicate nav contradicting `/partner`.
8. Keep seed + authz; capability-aware empty states.
9. Do not restyle Uber. No purple. Match Lime tokens.
10. Verify: `tsc`, freight unit tests, smoke partner → each path.
    Browser check mobile (390×844) for road surfaces and desktop width
    for shipper/carrier/partner.

## Out of scope unless asked

- Real carrier Connect / live payouts for simulated loads
- Full facility ratings product
- Replacing the freight domain schema
- Visual clone of Uber Freight marketing

## Success criteria

- A rider/driver engineer recognizes the same surface vocabulary.
- `/partner` chooses Lime products, not escapes a mess.
- ≤ one primary chrome per product entrypoint.
- Zero unwired `*surfaces.ts` false promises.
- Shipper still expands on desktop; carrier stays a desk; road work is
  glanceable (map-first).

## Do not commit unless asked

Leave a clean working tree summary for the human.

---

## Session plan

**Freeze: A** — decided 2026-08-30 by the default rule in this file (human
unreachable). `/driver` is the one road app. Freight is a **capability on it**,
unlocked by carrier fleet membership, not a second driver product.
`/freight/driver` becomes a redirect. B is closed; do not reopen it without a
new handoff.

### What A means, concretely

A freight load assigned to this user is a **job on the existing duty session**:
the same map, the same sheet, the same one-question/one-primary-action rule as
a ride. It is not a tab bar, not a board, not a document page.

- The **duty scene** (`to_pickup | at_pickup | on_trip`) is derived from the
  load status and only drives surface posture + map mode.
- The **question and the primary action** come from the freight ladder
  (`primaryDriverAction` / `DRIVER_CTA`), which is finer-grained than the ride
  ladder (arrive → load → depart → arrive → unload → deliver → POD). The server
  stays the source of legal actions; the sheet offers the one it returns.
- There is **no offer/accept for freight** — a dispatcher assigns it. So no
  countdown, no interrupt. It is simply the job that is running.
- While a freight load is live, **ride offers are suppressed** and duty cannot
  be dropped. One driver, one job.
- Finding and booking loads is **dispatch**, not driving. It stays in the
  carrier portal desk. The road app does not carry a load board.

### File-level keep / rewrite / delete

| File | Verdict |
|---|---|
| `src/lib/freight/*`, `src/server/freight/*`, router, migrations, seed | **keep** — untouched |
| `components/freight/freight-chrome.tsx` | **delete** — phone product switcher = the role toggle the gateway replaces |
| `components/freight/driver/freight-driver-app.tsx` | **delete** — tabbed Uber-app clone; road work moves to `/driver` |
| `components/freight/driver/freight-driver-load-detail.tsx` | **delete** — dispatch half duplicates the portal, road half moves to `/driver` |
| `components/freight/driver/freight-driver-surfaces.ts` | **delete** — never wired (false promise) |
| `components/freight/carrier/freight-carrier-surfaces.ts` | **delete** — never wired; the portal is a desk, not a duty session |
| `app/freight/driver/**` | **rewrite** → `redirect("/driver")` |
| `components/limecab/driver-freight-scene.tsx` | **new** — the freight job sheet |
| `lib/limecab/driver-state.ts` | **extend** — `freight` job kind, freight questions, load-status → scene |
| `components/limecab/driver-app.tsx` | **extend** — `freight.driverCurrent`, freight target/route, freight advance under `surface.transition` |
| `components/freight/shipper/freight-shipper-app.tsx` | **fix** — quote was derived from *surface posture*; publish was a bare `mutate` |
| `components/freight/carrier/freight-portal-shell.tsx` | **fix** — drop the App/Ship product switcher; `/partner` is the gateway |
| `app/partner/**` | **fix** — remove the second driver product from the gateway and the fleet hub |

### Out of scope this session

Freight-specific registration (a fleet driver still registers once on
`/driver` — one road app, one vehicle record), freight earnings on the peek,
exception reporting UI, accessorials, POD file capture.

---

## Status — done 2026-08-30 (freeze A implemented, uncommitted)

### Shipped

| Concern | File |
|---|---|
| Freight job on the duty sheet | `src/components/limecab/driver-freight-scene.tsx` (new) |
| `freight` job kind, freight questions, load-status → scene | `src/lib/limecab/driver-state.ts` (+ 3 tests) |
| `driverCurrent` poll, scene precedence, offer suppression, map target, `advance`/`submitPod` under `surface.transition` | `src/components/limecab/driver-app.tsx` |
| `freightLoadQuestion` — question + CTA from the server's legal-action list | `src/components/freight/freight-api.ts` |
| `/freight/driver` and `/freight/driver/loads/[id]` → `redirect("/driver")` | `src/app/freight/driver/**` |
| Quote/publish as real progressions; scene no longer read off surface posture | `src/components/freight/shipper/freight-shipper-app.tsx` |
| Product switcher gone; `AdaptiveSurface.Root` added | `src/components/freight/carrier/freight-portal-shell.tsx` |
| One driver product on the gateway and the fleet hub | `src/app/partner/**` |

Deleted: `freight-chrome.tsx`, `driver/freight-driver-app.tsx`,
`driver/freight-driver-load-detail.tsx`, `driver/freight-driver-surfaces.ts`,
`carrier/freight-carrier-surfaces.ts`. Zero unwired `*surfaces.ts` remain.
`src/lib/freight/*`, `src/server/freight/*`, the router, migrations and seed
are untouched.

### Two bugs found in the browser, not in the plan

1. **`/freight/carrier` threw on render** — `FreightPortalSearch` mounts
   `LocSearch`, which is an `AdaptiveSurface.Interrupt`, and the portal had no
   `AdaptiveSurface.Root`. The membership gate had been hiding it. Root now
   lives in `FreightPortalShell`. It cannot go in the server layout: a
   namespace import of a client component does not survive the RSC boundary,
   so `AdaptiveSurface.Root` comes back `undefined` there.
2. **The location search drew two frames.** `LocSearch` passed a `label` to
   the Interrupt *and* a `title` to `LocationSearchScene`, so the fullscreen
   interrupt's header sat on top of the scene's own. Fixed with
   `framed={false}`, which is what `driver-app.tsx` already does.

### Deliberately not built

- **No fare splash for freight.** When the load completes it leaves
  `driverCurrent` and the reconcile effect puts the driver straight back in
  the ride hunt. A splash would need a retained copy of the row and its own
  timer for one screen.
- **No freight registration.** A fleet driver still registers once on
  `/driver`; the vehicle record is the truck.
- **No freight affordance on the idle peek.** A fleet member with no assigned
  load sees the ordinary rides home. Add it when there is something to say.
- **POD is still `mock://pod/<id>`.** File capture, accessorials and exception
  reporting have no UI.
- `POD_PENDING` / `EXCEPTION` render a status line and no button, because the
  server exposes no legal driver action for them.

### Verified 2026-08-30

Dev server on **:3000**, Playwright, 1280×860 and 390×844, against the live
database as a phone-signed-in user made OWNER of `seed_freight_carrier`.

Desktop: `/partner` → `/freight` compose → location interrupt (one frame now)
→ quote → publish → the load appears under Shipments. `/freight/carrier`
search → load detail → Book → Assign driver (self) → `DRIVER_ASSIGNED`.

Mobile: `/freight/driver` redirects to `/driver`, which shows the load as a
duty job — full-bleed map, lane chip, avatar/shield/911 overlay, one primary
in the thumb zone. Walked the whole ladder: en route → arrived → start
loading → depart (map target flips to the receiver) → arrived → start
unloading → finish delivery → Submit POD → load closes out and the driver is
back on "Looking for rides", still online.

`tsc --noEmit` clean. 348 tests, 0 fail. `next lint` 20 errors, all
pre-existing (26 on the stashed baseline). Console clean — no errors and no
`[SurfaceManager]` invariant warnings.

### How to re-run the whole workflow yourself

Sign-in needs no bypass: this build has no SMS, so
`login.requestPhoneCode` returns the code and the page prints it. Any fake
number works — enter it, read the six digits off the screen, sign in.

The one step with no UI is joining a fleet (`/partner/fleets/join` is a
labelled stub), so the carrier membership is still a hand-written row:

```sql
insert into <freight_carrier_member> (id, "carrierId", "userId", role)
values ('demo_freight_member', 'seed_freight_carrier', '<your user id>', 'OWNER');
```

OWNER is the useful role for a solo walkthrough — it can book on the desk,
assign, and drive the load itself. Then: `/freight/carrier` search Ontario →
open *Ontario → Phoenix* → Book → assign it to yourself → `/driver`.

### Test data left in the dev database

- Two phone accounts, `(323) 555-0199` and `(323) 555-0142`, are members of
  `seed_freight_carrier` as **OWNER**. Delete the rows to test the gate.
- `seed_freight_load_ontario_phoenix` was run end to end twice and has been
  **reset to `AVAILABLE`** both times, so it is ready to run again.
  `pnpm db:seed:freight` also resets it.
- One published shipment, "California → Arizona 85004", `AVAILABLE`.
