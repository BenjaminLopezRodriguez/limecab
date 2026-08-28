# UX bugs — LimeCab

## 2026-08-26 — Audit Session

Ledger: 0 open bugs, 0 recurring patterns.
Top categories: layout/overflow, map fit.

### Bugs found
| ID | Slug | File | Severity | Status |
|----|------|------|----------|--------|
| L1 | out-of-frame-content | src/components/limecab/limecab-shell.tsx | P0 | fixed 2026-08-26 |
| L3 | text-clipping | src/components/service-app/service-app-shell.tsx | P1 | fixed 2026-08-26 |
| R1 | mobile-layout-broken | src/components/service-app/service-app-shell.tsx | P0 | fixed 2026-08-26 |
| A3 | cumulative-layout-shift | src/components/service-app/mapbox-canvas.tsx | P1 | fixed 2026-08-26 |

### Bugs fixed
| ID | Slug | File | Fix |
|----|------|------|-----|
| L1 | out-of-frame-content | limecab-shell.tsx | Header-only chrome; `--nav-pill-clear` so lists sit above the floating tab capsule |
| R1 | mobile-layout-broken | service-app-shell.tsx | Home is one paper surface — map card + input, no fake sheet |
| L3 | text-clipping | service-app-shell.tsx | Dropped `max-h` clip and sheet chrome on the launcher |
| A3 | map-not-fitting | mapbox-canvas.tsx | `resize()` on container change; `fitBounds` padding from visible sheet height |

### Recurring patterns
- Overlay sheets must report *visible* coverage (`innerHeight - top`), not full element height, or the map pads itself off-screen.

## 2026-08-27 — Fix Session

Ledger: 1 open (now fixed), 0 recurring patterns.
Top categories: interactive states.

### Bugs found
| ID | Slug | File | Severity | Status |
|----|------|------|----------|--------|
| I2 | selected-state-mismatch | src/components/service-app/location-search-scene.tsx | P1 | fixed 2026-08-27 |

### Bugs fixed
| ID | Slug | File | Fix |
|----|------|------|-----|
| I2 | selected-state-mismatch | location-search-scene.tsx | Route-stack search input matches RouteField: no muted fill, no focus ring |

### Recurring patterns
- Stacked route fields inherit Input's pill chrome (`bg-muted`, focus ring) unless the scene overrides it.

## 2026-08-27 — Fix Session (ride select)

Ledger: 0 open, 1 recurring-adjacent (tap vs confirm).
Top categories: interactive states, spacing.

### Bugs found
| ID | Slug | File | Severity | Status |
|----|------|------|----------|--------|
| I7 | missing-checked-state | src/components/limecab/limecab-ride-select-scene.tsx | P0 | fixed 2026-08-27 |
| L6 | element-bleed-to-edge | src/components/limecab/limecab-ride-select-scene.tsx | P2 | fixed 2026-08-27 |

### Bugs fixed
| ID | Slug | File | Fix |
|----|------|------|-----|
| I7 | missing-checked-state | limecab-ride-select-scene.tsx / limecab-app.tsx | Row tap selects only; Confirm is the progression |
| L6 | element-bleed-to-edge | limecab-ride-select-scene.tsx | Ride rows bleed to the sheet edges (`-mx-5` / `md:-mx-6`) |

## 2026-08-27 — Fix Session (sheet height)

Ledger: 0 open.
Top categories: layout.

### Bugs found
| ID | Slug | File | Severity | Status |
|----|------|------|----------|--------|
| L1 | out-of-frame-content | src/components/service-app/service-sheet.tsx | P0 | fixed 2026-08-27 |

### Bugs fixed
| ID | Slug | File | Fix |
|----|------|------|-----|
| L1 | sheet-springs-too-high | service-sheet.tsx | Snap ladder is 22% / 40% / 60%; taller work uses TaskScene overlay. Map sits in the remaining frame above the sheet. |

### Recurring patterns
- Measuring sheet height from scene content lets comparison/status swallow the map. Cap the rung; scroll inside it.

## 2026-08-27 — Handoff (open)

Open work for the next session: `.ux-bugs/HANDOFF-surfaces.md`.

| ID | Slug | File | Severity | Status |
|----|------|------|----------|--------|
| L8 | coordinator-jank | service-sheet.tsx / map-overlay.ts | P0 | open |
| N1 | live-ride-no-minimize | limecab-app.tsx / limecab-shell.tsx | P0 | open |
| M1 | map-should-sit-under-sheet | service-app-shell.tsx | P0 | open |
| M2 | recenter-control | map overlay | P1 | open |
| I8 | payment-not-full-overlay | limecab-interrupts.tsx | P1 | open |

## 2026-08-27 — Driver app handoff (open)

Open work: `.ux-bugs/HANDOFF-driver.md`. Rebuild driver home as a map-first
Uber-shaped duty session. Do not polish the inbox list.

| ID | Slug | File | Severity | Status |
|----|------|------|----------|--------|
| D1 | driver-is-inbox-not-map | src/app/driver/page.tsx | P0 | open |
| D2 | offers-are-a-list | driver-offer-card.tsx | P0 | open |
| D3 | accept-navigates-away | src/app/driver/trips/[tripId]/page.tsx | P0 | open |
| D4 | no-driver-scene-machine | (missing driver-app.tsx) | P0 | open |
| D5 | no-offer-sound-countdown-ring | driver-offer-card.tsx | P1 | open |


## 2026-08-27 — Driver app handoff (shipped)

`.ux-bugs/HANDOFF-driver.md` is implemented, verified at 390×844 and 1280,
merged to `main` (`35411e4` / `a8fc92c`) and live on production (`lime.cab`,
`dpl_FtkwEy59pQQpX3miFK4xZmetVup4`). See that file's "Status — built
2026-08-27" section for the file map and the decisions it left open.

| ID | Slug | File | Severity | Status |
|----|------|------|----------|--------|
| D1 | driver-is-inbox-not-map | src/app/driver/page.tsx | P0 | fixed 2026-08-27 |
| D2 | offers-are-a-list | driver-offer-card.tsx | P0 | fixed 2026-08-27 |
| D3 | accept-navigates-away | src/app/driver/trips/[tripId]/page.tsx | P0 | fixed 2026-08-27 |
| D4 | no-driver-scene-machine | (missing driver-app.tsx) | P0 | fixed 2026-08-27 |
| D5 | no-offer-sound-countdown-ring | driver-offer-card.tsx | P1 | fixed 2026-08-27 |

### Bugs fixed
| ID | Slug | File | Fix |
|----|------|------|-----|
| D1 | driver-is-inbox-not-map | driver-app.tsx / driver-chrome.tsx | `/driver` is `ServiceAppShell layout="task"` over one mounted map; profile routes keep the padded column |
| D2 | offers-are-a-list | driver-scenes.tsx / driver-surfaces.ts | One offer at a time as `AdaptiveSurface.Interrupt`; the idle peek suspends and returns |
| D3 | accept-navigates-away | driver-app.tsx | Accept is a `progress` transition; `/driver/trips/[id]` redirects to `/driver` |
| D4 | no-driver-scene-machine | lib/limecab/driver-state.ts | `DriverAppState` + reducer + `driverAppQuestion`, with tests |
| D5 | no-offer-sound-countdown-ring | driver-scenes.tsx | Determinate countdown bar; `AudioContext` chime + `navigator.vibrate`, both fail-soft |

## 2026-08-27 — Fix Session (surfaces leftovers)

Ledger: 0 open from the surfaces handoff. Committed as `7fdcf5e`.
Top categories: layout, map.

### Bugs found
| ID | Slug | File | Severity | Status |
|----|------|------|----------|--------|
| L9 | action-band-not-in-thumb-zone | limecab-quote-scene.tsx, limecab-configure-scene.tsx, location-pin-scene.tsx, quote-panel.tsx | P1 | fixed 2026-08-27 |
| M3 | route-layer-remount | src/components/service-app/mapbox-canvas.tsx | P1 | fixed 2026-08-27 |

### Bugs fixed
| ID | Slug | File | Fix |
|----|------|------|-----|
| L9 | action-band-not-in-thumb-zone | four scenes | Wrapper `<div>`s stretch (`flex min-h-full flex-col`) so `SheetActions`' `mt-auto` reaches the sheet's bottom edge. No portal — the handoff ruled that out |
| M3 | route-layer-remount | mapbox-canvas.tsx | One layer id, two paint states, same paint keys (`line-dasharray: [1,0]` = solid). Was tearing down the route line on every mute change |

### Recurring patterns
- `mt-auto` only reaches the sheet edge from a **direct child** of the sheet's
  flex scrollport. A scene that returns a wrapper element must stretch it.
- A react-map-gl `<Layer>` whose `id` changes is a remount, not a restyle.
  Vary paint, keep the id.

## 2026-08-27 — Open, not mine (GO–GET session)

Found while verifying the above; **introduced by the in-flight GO–GET work**,
not pre-existing. Production (`a8fc92c`, no GO–GET code) shows 0 errors on the
same interaction; the local tree throws ~429 in four seconds.

| ID | Slug | File | Severity | Status |
|----|------|------|----------|--------|
| R2 | pin-scene-render-loop | limecab-app.tsx (pin ↔ camera) | P0 | open |

Repro: Home → tap the map card → `location_pin`. Console fills with
"Maximum update depth exceeded". Reverting the surfaces fixes above does not
change it. Suspect the `setPin` ↔ `onCameraChange`/`easeTo` feedback now that
Home and the search scene have new props.

## 2026-08-27 — GO–GET handoff (shipped + verified)

`.ux-bugs/HANDOFF-goget-2026.md` §1–§6 were implemented in a parallel session
(`cf56c18`, `73318ef`) and verified here against the handoff's acceptance
criteria at 390×844 and 1280. Live on production (`lime.cab`).

Verified: §1 mic → honest-empty typed fallback · §2 one query splits into
"Ride there" / "Get from a store" · §3 travel toggle on → airport + spots,
off → old Home · §4 Services → When? → "Reserved for 9:00 PM" · §5 Comfort →
interrupt → cafe stop on route + rail, Lime → no interrupt · §6 store row →
buy-for-me with pickup = store, photo honest-empty. `/driver` untouched. No
SurfaceManager invariant warnings.

### Bugs found
| ID | Slug | File | Severity | Status |
|----|------|------|----------|--------|
| R2 | pin-scene-render-loop | service-app/mapbox-canvas.tsx | P0 | fixed 2026-08-27 |
| F1 | quote-charges-what-server-wont | limecab-app.tsx | P0 | fixed 2026-08-27 |
| G1 | reverse-geocode-always-502 | api/map/reverse, api/map/places | P1 | fixed 2026-08-27 |

### Bugs fixed
| ID | Slug | File | Fix |
|----|------|------|-----|
| R2 | pin-scene-render-loop | mapbox-canvas.tsx | `setPadding` is a `jumpTo` that fires `moveend`; in pin mode that fed `onCameraChange` → `setPin` → camera → repeat (~256 errors / 4s). Only gesture events (`originalEvent`) move the pin now |
| F1 | quote-charges-what-server-wont | limecab-app.tsx | For the Way added $5 to the quote, but `trip.request` takes no add-on and prices server-side — rider saw $46.02, would be charged $41.02. Drink is now a "paid at the counter" line; the stop stays real |
| G1 | reverse-geocode-always-502 | map routes | Mapbox v5 reverse geocoding 422s when `limit` is sent with multiple `types`. Dropped `limit`, kept types |

### Recurring patterns
- A programmatic camera move fires the same events as a gesture. Anything that
  writes map state from a map event must first prove a human caused it.
- A client-side total is a claim about what will be charged. If the server
  prices the request itself, the client may only *display* what it sends.
- A route that maps every upstream failure to 502 hides the upstream's actual
  complaint. The 422 body named the fix exactly.

## 2026-08-27 — Logistics handoff (open)

Open work: `.ux-bugs/HANDOFF-logistics.md`. Real location backend, user
favorite spots, H3 res-8 lattice on the idle driver map, H3 res-9 index
for nearby search. Dummy Home/Work/nearby cars come out. Do not restyle
the driver shell or redo surfaces / GO–GET.

| ID | Slug | File | Severity | Status |
|----|------|------|----------|--------|
| G2 | dummy-saved-places | mock.ts / home / profile/places | P0 | open |
| G3 | no-driver-fix | schema.ts / driver.ts / driver-app.tsx | P0 | open |
| G4 | phantom-nearby-cars | limecab-app.tsx NEARBY_DRIVERS | P0 | open |
| G5 | inbox-is-global | driver.ts inbox | P0 | open |
| G6 | h3-driver-lattice | mapbox-canvas.tsx / driver-app.tsx | P0 | open |
| G7 | h3-search-index | places router (missing) | P0 | open |

## 2026-08-27 — Driver idle UX handoff (open)

Open work: `.ux-bugs/HANDOFF-driver-ux.md`. Match Uber Driver's idle
operating model from `.ux-bugs/refs/uber-driver/`: offline is a home with
a map card; online is full-bleed hunting; Recommended holds GO OFFLINE;
trends + preferences. Offers and live jobs stay as HANDOFF-driver shipped
them. `page.tsx` stays the register/load gate.

| ID | Slug | File | Severity | Status |
|----|------|------|----------|--------|
| D6 | offline-is-still-a-peek | driver-app.tsx / driver-scenes.tsx | P0 | fixed 2026-08-28 |
| D7 | online-peek-is-go-offline | DriverDutyScene | P0 | fixed 2026-08-28 |
| D8 | no-demand-overlay | mapbox-canvas.tsx | P0 | fixed 2026-08-27 |
| D9 | no-earnings-trends | (missing) | P1 | fixed 2026-08-27 |
| D10 | prefs-not-uber-shaped | driver/profile/preferences | P1 | fixed 2026-08-28 |

### Bugs fixed (driver UX P1 follow-up)
| ID | Slug | File | Fix |
|----|------|------|-----|
| D6 | offline-is-still-a-peek | driver-app.tsx / page.tsx | `driverSceneFromInbox` seeds first paint; `useLayoutEffect` applies surfaces before paint |
| D7 | online-peek-is-go-offline | driver-app.tsx setDuty | `perform(goOnline)` only after `setAvailable` succeeds; pill keeps spinner |
| D11 | search-lists-all-customs | limecab-app.tsx searchPlaces | Empty query: Home/Work slots + H3 nearby customs + recents only |
| D12 | pickup-no-reseed | limecab-app.tsx reset | `resetPickupSeed()` clears one-shot geolocation after a trip |
| D13 | demand-stuck-on-pan | driver-app.tsx recenter | `setCamera(null)` on recenter / collapseIdleMap |
