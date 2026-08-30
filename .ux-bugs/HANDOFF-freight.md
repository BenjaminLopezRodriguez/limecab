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

_(Agent: write freeze A/B + file-level keep/rewrite/delete here before
large UI rewrites.)_
