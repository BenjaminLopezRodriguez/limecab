# @lime/interaction-system

An **executable specification** of Lime's interaction system — the grammar already proven
across rider, driver and freight, extracted so it can be inspected, tuned, and eventually
rendered by React Native.

## What it is not

- not a production backend — it never imports tRPC, Drizzle, auth, or `env.js`
- not a copy of the Lime app
- not a generic SaaS design system
- not a static component gallery

## Status: Phase 1 (extraction fork)

Production is authoritative. **The app must not import this package during extraction** — a
phase boundary with an expiry, not a permanent law. See `docs/CONVERGENCE.md`.

```
npm run typecheck   # tsc, package-local
npm test            # boundary invariants + policy behaviour
npm run drift       # classify divergence from production (read-only)
```

## Layering

```
core/       semantics only — no React, no DOM, no Mapbox, no Next
            SurfaceRole · Emphasis · Interaction · Presentation
            SceneState · Transition · ShellIntent · ExperienceFrame
            BackDisposition · AccessibilitySemantics
            surface-manager.ts · surface-progress.ts (extracted verbatim)

policy/     PresentationEnvironment — safe area, viewport, keyboard, font scale
            NEVER imported by a semantic reducer (enforced by test)

recipes/    renderer policy — snap extents, motion timings
tokens/     serializable values — colour, type, spacing, radius, elevation
```

The governing rule: **core holds semantics; values, policies and timings live in recipes.**
A number answering "how much" is policy for one renderer family, not shared truth.

## Not here, deliberately

`state.ts` and most of `status.ts` are **rider-specific**, not core — 9 of 13 scenes are
booking domain, and `driver-state.ts:8` says outright that the rider machine is not reused.
They belong in `scenarios/rider/` when scenarios land.
