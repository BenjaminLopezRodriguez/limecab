# Design: `@lime/ui` — portable Lime-branded UI SDK

**Date:** 2026-08-31  
**Status:** Draft for review (revised)  
**Package:** `packages/lime-ui` (structured as if it will eventually live in its own repo)  
**Orientation:** **React Native–first portable, web-renderable** — not “RN-compatible extraction of Storybook.”  
**Consumers:** any Expo / React Native project; `@lime/interaction-system` is the **first development consumer**, not a runtime assumption.

## Intent (read this first)

The end product is **not** merely an RN-compatible extraction for this repo.

Build `@lime/ui` as a **genuinely portable reusable library** that can be dropped into **any** Expo / React Native project later.

Treat the current Lime repo and Storybook as:

- **source / reference** for visual language and component inventory  
- **first proof consumer**

Do **not** treat them as runtime assumptions.

A completely separate Expo app should eventually be able to install/import and write:

```ts
import {
  Button,
  Input,
  ChoiceList,
  ProviderCard,
  LocationTrigger,
  QuotePanel,
  CompletionPanel,
} from "@lime/ui";
```

without importing anything else from this repository.

Design the public API as if `@lime/ui` will eventually live in its own repository/package.

## Dependency direction (hard rule)

```
@lime/ui
    ↑
any Expo app

@lime/ui
    ↑
@lime/interaction-system  (web / Storybook lab)
```

**Never:**

```
@lime/ui → interaction-system
@lime/ui → LimeCab app
@lime/ui → Storybook
```

Clean end-state:

```
@lime/ui
  ├── tokens
  ├── atoms
  ├── portable primitives
  └── platform adapters
        │
        ├── Expo app A
        ├── Expo app B
        ├── future Lime native app
        └── Storybook web lab   ← development environment only
```

Storybook is a **development environment**, not part of the library architecture.

## Hard independence constraints

`@lime/ui` must have:

| Constraint | Rule |
|---|---|
| LimeCab app structure | zero dependency |
| Next.js | zero |
| tRPC | zero |
| Drizzle | zero |
| Mapbox | zero |
| Storybook | zero (devDependency of the lab consumer only) |
| `@lime/interaction-system` / core | zero |
| Production `src/` | zero imports |
| App routing | no assumptions |
| Authentication | no assumptions |
| Server state | no assumptions |
| Expo Router layout | no assumptions |
| State manager | no assumptions |
| Ride / Freight / Driver domain types | no knowledge |

**Allowed peers / runtime deps for consumers:** React + React Native (and whatever tiny pure helpers the package itself ships). Web Storybook uses a **platform adapter** so primitives render on DOM without RN being a hard install requirement for the lab — but the **API and quality bar are native-first**.

## Goal

Ship `@lime/ui` as a **portable Lime-branded UI SDK**:

1. **Native-first** public API and component behavior suitable for Expo / RN  
2. **Web-renderable** via a thin platform adapter so this monorepo’s Storybook can develop/verify  
3. **Importable across projects** with no monorepo coupling  

`@lime/interaction-system` continues to own interaction grammar (surfaces, scenes, sheets, fixtures, scenarios) and **consumes** `@lime/ui`. It is not the product being extracted into a library.

## Non-goals (this phase)

- Publishing to npm (structure for it; don’t ship registry yet)
- Building a full Expo demo app in this repo (optional later proof)
- Porting `SurfaceSheet`, `SceneRenderer`, map scene semantics
- Changing production LimeCab app imports
- Moving workflow/domain state into the UI package

## What `@lime/ui` owns

- Visual tokens (color, typography, spacing, radius, elevation, surface metrics as needed for controls)
- Portable atoms
- Portable presentation primitives
- Minimal cross-platform platform abstraction where necessary

## What `@lime/ui` does NOT own

- `SceneState`, `SurfaceManager`, workflow state
- `BackResolver`
- Map scene semantics
- Freight / rider / driver state machines or domain types
- Business fixtures
- App navigation
- API clients

## Portability test (every export)

For every exported component, ask:

> Could I reasonably use this in a brand-new Expo app that has never heard of LimeCab?

If **no** because the name or props encode current product state:

1. **Generalize** only if the underlying abstraction is genuinely reusable, or  
2. **Leave it** in `@lime/interaction-system`

Do **not** overfit APIs to current Storybook fixtures.

Same-source web/native is preferred for small primitives, but **portability and native quality matter more than forcing one implementation**. Prefer a great RN component + web adapter over a web-DOM component that “happens to compile” on RN.

## Architecture

```
packages/lime-ui/                 ← portable SDK (repo-agnostic)
  src/tokens/
  src/platform/                   ← adapters only
    types.ts
    native.tsx                    ← primary (react-native)
    web.tsx                       ← Storybook / web consumer adapter
  src/atoms/
  src/primitives/
  src/index.ts                    ← public API surface

packages/lime-interaction-system/ ← first consumer
  depends on @lime/ui
  keeps domain/scene/sheet/harness/stories
```

**Governing rule:** `@lime/ui` is presentation kit. Interaction-system (and any Expo app) compose it. Core semantic packages must not import `@lime/ui` if they remain pure; interaction-system’s `web/` layer may.

## Approach

**Native-first components + platform adapters**

| Option | Why not for this intent |
|---|---|
| “Make Storybook primitives RN-compatible” | Centers the wrong product; overfits lab |
| react-native-web as sole identity | Fine as a technique later; not the package’s meaning |
| Dual full UIs with shared types only | Weaker “drop-in library” story for atoms |

**Recommendation:** Implement primitives against RN-shaped primitives (`View` / `Text` / `Pressable` / `TextInput`). Provide `platform/native` (real RN) and `platform/web` (DOM adapter for Storybook). Public exports resolve native in Expo; web in Storybook via `package.json` `exports` conditions.

## Package shape

```
packages/lime-ui/
  package.json          # name @lime/ui; peers: react, react-native
  tsconfig.json
  README.md             # install + import for a greenfield Expo app
  src/
    index.ts
    tokens/
    platform/
      types.ts
      native.tsx
      web.tsx
    atoms/
      button.tsx
      input.tsx
      progress.tsx
      separator.tsx
      icon-glyph.tsx
      map-floating-button.tsx
      index.ts
    primitives/
      choice-list.tsx
      location-trigger.tsx
      map-route-bar.tsx
      route-rail.tsx
      live-sheet-header.tsx
      provider-card.tsx
      quote-panel.tsx
      completion-panel.tsx
      actions.tsx
      surface-skeleton.tsx
      index.ts
    style/
      type-style.ts     # letterSpacing em→px helper, etc.
```

### Public API (illustrative)

```ts
// @lime/ui
export * from "./tokens";
export { Button, Input, ProgressBar, Separator, IconGlyph, MapFloatingButton } from "./atoms";
export {
  ChoiceList, ChoiceRow, ChoiceGlyph,
  LocationTrigger, MapRouteBar, RouteRail,
  LiveSheetHeader, ProviderCard,
  QuotePanel, CompletionPanel,
  PrimaryAction, SecondaryAction, ConfirmActionSurface,
  SurfaceSkeleton,
} from "./primitives";
```

`Input` is the public name; `LimeInput` may be a deprecated alias only if a short migration needs it inside this monorepo — not part of the long-term external API.

### `package.json` exports (intent)

```json
{
  "name": "@lime/ui",
  "peerDependencies": {
    "react": "*",
    "react-native": "*"
  },
  "exports": {
    ".": {
      "react-native": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./tokens": "./src/tokens/index.ts",
    "./platform": {
      "react-native": "./src/platform/native.tsx",
      "default": "./src/platform/web.tsx"
    }
  }
}
```

A future independent Expo project needs **React + React Native as peers** and can consume the library **without this monorepo**.

Atoms/primitives import platform only through `@lime/ui/platform` (or internal resolution that picks native vs web). They never import DOM tags, `react-dom`, Next, or lab packages.

## Platform shim API

RN-shaped subset (native is the source of truth for prop names):

| Component | Role |
|---|---|
| `View` | Layout |
| `Text` | Text (no raw strings as View children) |
| `Pressable` | Tap targets |
| `TextInput` | Controlled text fields |

**Style rules:** plain objects; RN-safe keys; no classNames; no CSS selectors; no hover-only affordances as the only interaction path. Token letterSpacing converted for RN via `typeStyle()`.

**Web adapter:** maps to `div` / `span` / `button` / `input` solely so Storybook can render. Web quality should be good enough for design review; **native quality is the bar**.

**Native adapter:** thin wrappers / re-exports from `react-native`.

## First slice inventory

### Include in `@lime/ui` (pass the portability test)

**Tokens:** color, typography, spacing, radius, elevation, surface (control metrics). Chrome metrics that encode LimeCab shell layout may stay in interaction-system if they aren’t reusable kit — prefer keeping shell-specific chrome out of `@lime/ui` unless clearly generic.

**Atoms:** `Button`, `Input`, `ProgressBar`, `Separator`, `IconGlyph`, `MapFloatingButton`

**Primitives:** `ChoiceList` / `ChoiceRow` / `ChoiceGlyph`, `LocationTrigger`, `MapRouteBar`, `RouteRail`, `LiveSheetHeader`, `ProviderCard`, `QuotePanel`, `CompletionPanel`, `PrimaryAction`, `SecondaryAction`, `ConfirmActionSurface`, `SurfaceSkeleton`

Prop surfaces must be **presentation-only** (labels, callbacks, optional trailing nodes) — not Trip/Quote/tRPC entities.

### Leave in `@lime/interaction-system`

- `DialogFrame`, `DrawerFrame`, `SurfaceSheet`, `InterruptSurface`, `SceneRenderer`
- Map markers tied to scene/map semantics
- Status panels wired to service/trip domain
- Lists/freight/partner/profile/activity/ride compositions that encode product flows
- Fixtures, scenarios, harness, stories
- Anything that fails: “usable in a greenfield Expo app with no LimeCab knowledge”

If a current Storybook “primitive” is secretly a domain widget, **do not move it** — compose it from `@lime/ui` inside interaction-system instead.

## Migration steps (this monorepo as first consumer)

1. Create `packages/lime-ui` as a standalone package (README written for Expo install/import)
2. Add platform adapters (native + web) + tokens owned by `@lime/ui`
3. Implement atoms against the platform API (native-first)
4. Implement portable primitives; apply portability test per export
5. Wire `@lime/interaction-system` as consumer; remove duplicated tokens/primitives from it (re-export briefly only if needed for a soft cutover)
6. Point Storybook at `@lime/ui` via workspace resolution — Storybook remains outside the library
7. Contract tests: no DOM tags in atoms/primitives; no imports from interaction-system / app `src/` / Next / tRPC / etc.
8. Document greenfield usage in `packages/lime-ui/README.md`

## Dependency rules

| Package | May depend on |
|---|---|
| `@lime/ui` | `react`, `react-native` (peer); own tokens/platform only |
| `@lime/interaction-system` | `@lime/ui` + lab tooling |
| Production LimeCab `src/` | not yet |
| Future Expo app | `@lime/ui` only (for UI kit) |

Forbidden inside `@lime/ui`: interaction-system, Storybook, Next, tRPC, Drizzle, Mapbox, app `src/`, domain fixtures.

## Testing & verification

- `pnpm --filter @lime/ui typecheck`
- Grep/contract: atoms/primitives have no `<div|<span|<button|<input` and no forbidden package imports
- interaction-system typecheck + Storybook smoke (consumer check only)
- Mental check: README example compiles in a hypothetical empty Expo app

## Success criteria

1. `@lime/ui` is a standalone package with a greenfield Expo-oriented README  
2. Public API is usable without this monorepo  
3. Zero forbidden dependencies / domain types in the package  
4. Native-first platform + web adapter; Storybook is only a consumer  
5. interaction-system consumes `@lime/ui` for tokens + portable primitives  
6. Every export passes the portability test (or was left in interaction-system)

## Follow-ups (later)

- Independent Expo proof app (separate folder or repo)
- npm publish / own repository extract
- RN Storybook or Expo story host
- Broader primitive set only after portability test
- Production / native Lime app adoption

## Decisions log

| Decision | Choice |
|---|---|
| Product identity | Portable Lime-branded UI SDK (not lab extraction) |
| Orientation | React Native–first, web-renderable |
| Package layout | `packages/lime-ui`, structured for eventual separate repo |
| First slice | Portable atoms + presentation primitives |
| Tokens | Owned by `@lime/ui` |
| Storybook / interaction-system | First consumers only |
| Brand | Lime identity |
| Domain/scene/workflow | Stay out of `@lime/ui` |
