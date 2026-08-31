# Extraction inventory

Every production source file considered for `packages/lime-interaction-system` is classified below.
Nothing is silently omitted.

Classifications: **COPY** · **ADAPT** · **REFERENCE** · **MOCK** · **IGNORE** · **OUT_OF_SCOPE**

Run `npm run coverage` for a machine-readable summary.

## Storybook coverage (2026-08-31)

| Area | Represented | P2 pending | Internal | Reference-only |
|---|---:|---:|---:|---:|
| service-app | 28 / 28 visual | 0 | 2 | 4 adapters |
| ui | 7 / 7 | 0 | 0 | 0 |
| limecab | 22 / 35 visual | 13 | 0 | 11 containers |
| freight | 10 / 10 visual | 0 | 1 | 4 orchestrators |
| partner | 4 / 4 visual | 0 | 0 | 2 |

## Uber in-ride reference (Aug 2026)

Lab implementation under `Rider/In ride` — modeled on in-ride Uber screenshots:

| Story | Uber screenshot |
|---|---|
| In ride · spatial | Map + card stack (5932, 5934) |
| Interrupt · ride details | Ride details sheet (5933) |
| Interrupt · driver details | Driver details (5935) |
| Interrupt · safety | Safety tools (5936) |
| Activity · ongoing + past | Activity tab (5931) |

Production convergence target: replace three-band `LimeCabStatusScene` with `InRideCardStack` composition.

These are intentionally deferred; they reuse primitives already in Storybook:

- `limecab-when-scene.tsx` — schedule picker
- `limecab-shop-scene.tsx` — courier shopping list
- `limecab-help-kind-scene.tsx` — help vs care tiles
- `limecab-spaces-*` — parking/storage flows
- `limecab-station-*` — station parking
- `limecab-assist-*` — assist composer/results
- `limecab-save-place.tsx` — save address interrupt
- `assist-textcon.tsx` — @-mention chips
- `driver-preferences.tsx` — preference form
- `driver-help-optin.tsx` — help onboarding
- `driver-safety-toolkit.tsx` — safety page (data-bound)

## Production accessibility gaps (lab fixes, production unchanged)

| Gap | Production | Lab |
|---|---|---|
| Freight live region | zero `aria-live` under `components/freight/**` | `SceneRenderer` + scenario announcements |
| Trip pill | polls API | presentational `TripPill` with fixtures |

See `docs/CONVERGENCE.md` for divergence ledger.

## Reference-only (never copied)

App orchestrators and surface configs:

- `limecab-app.tsx`, `driver-app.tsx`, `limecab-shell.tsx`
- `freight-shipper-app.tsx`, `freight-shipper-shell.tsx`
- `partner-places-app.tsx`, `partner-places-chrome.tsx`
- `*-surfaces.ts`, `freight-api.ts`, `map-overlay.ts`
- `phone-signin.tsx`, `verify-settings.tsx`, `saved-places-editor.tsx`

## Layer placement

| Layer | Contents |
|---|---|
| `src/core/` | semantic contracts — no React, no DOM |
| `src/recipes/` | renderer-family policy |
| `src/policy/` | presentation environment |
| `src/web/` | React implementations |
| `src/fixtures/` | deterministic demo data |
| `src/scenarios/` | flow projections |
| `src/stories/` | Storybook catalogue |

## Lab-only additions (not in production)

- `src/harness/back-resolver.ts` — observed Back dispositions
- `src/web/registry.tsx` — renderer-owned scene registry
- `src/storybook/decorators.tsx` — viewport / fontScale / keyboard toolbar
