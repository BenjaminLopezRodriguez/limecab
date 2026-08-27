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

