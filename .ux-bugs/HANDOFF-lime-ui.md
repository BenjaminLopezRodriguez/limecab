# Handoff: `@lime/ui` portable UI SDK

**Status: approved spec — implement now.**  
This is a work order for Claude Code. Do not re-negotiate the product identity.

## Read first (required)

1. `docs/superpowers/specs/2026-08-31-lime-ui-rn-primitives-design.md` — **source of truth**
2. `packages/lime-interaction-system/src/web/ui.tsx` — reference atoms (copy behavior, do not keep DOM)
3. `packages/lime-interaction-system/src/web/primitives.tsx` — reference primitives
4. `packages/lime-interaction-system/src/tokens/` — move ownership into `@lime/ui`

## Product identity (non-negotiable)

The end product is **NOT** “make Storybook primitives RN-compatible.”

Build **`@lime/ui` as a standalone, portable Lime-branded UI SDK** that any Expo / React Native project can import. Web Storybook is **one consumer**, not the architecture.

Orientation: **React Native–first portable, web-renderable.**

A greenfield Expo app must be able to:

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

## Hard constraints

`@lime/ui` must have **zero** dependency on:

- LimeCab app structure / production `src/`
- Next.js, tRPC, Drizzle, Mapbox
- Storybook (Storybook is only a consumer’s tool)
- `@lime/interaction-system` / core / fixtures / domain types
- App routing, auth, server state, Expo Router layout, state managers
- Ride / Freight / Driver domain types

**Dependency direction:**

```
@lime/ui  ←  any Expo app
@lime/ui  ←  @lime/interaction-system (first lab consumer)
```

Never `@lime/ui` → interaction-system.

## Portability test

For every export: *Could a brand-new Expo app that never heard of LimeCab use this?*  
If no → generalize only if genuinely reusable, else leave in interaction-system.

Do not overfit props to Storybook fixtures. Presentation-only APIs.

## Implement (this phase)

1. Create `packages/lime-ui` (`@lime/ui`) with README aimed at greenfield Expo install/import
2. Platform adapters: `native` (react-native primary) + `web` (DOM adapter for Storybook only)
3. Own tokens under `@lime/ui` (move from interaction-system)
4. Atoms: Button, Input, ProgressBar, Separator, IconGlyph, MapFloatingButton
5. Primitives: ChoiceList/Row/Glyph, LocationTrigger, MapRouteBar, RouteRail, LiveSheetHeader, ProviderCard, QuotePanel, CompletionPanel, Primary/Secondary/Confirm actions, SurfaceSkeleton
6. Wire `@lime/interaction-system` as consumer; remove duplicated tokens/primitives (short re-export OK for cutover)
7. Storybook still runs via web adapter — Storybook is not part of the library
8. Contract checks: no DOM tags in atoms/primitives; no forbidden imports
9. Typecheck `@lime/ui` and `@lime/interaction-system`

## Do NOT

- Copy Uber visuals
- Port SurfaceSheet / SceneRenderer / map scene semantics / domain fixtures into `@lime/ui`
- Commit unless asked
- Publish to npm this phase
- Add Next/tRPC/Mapbox/Storybook as library deps

## Done when

- Spec success criteria in the design doc are met
- README shows Expo-style import without monorepo assumptions
- interaction-system Storybook Primitives/UI still work as a consumer smoke test
