
### Session 2026-08-30
- Scope: standalone H3 active-cell spatial index; Railway service + Postgres; wired into rider/driver apps.
- Tasks: 2 parallel | Agents: general-purpose x2 | Wall time: ~12m (longest agent 730s)
- Durations (median s):
  - build-service x general-purpose: 730s (n=1)
  - wire-integration x general-purpose: 343s (n=1)
- Direction signals: user wants Mapbox kept and ALSO indexed, not replaced; GMP-conservative caching (place id durable, 30d field TTL); prod env enabled despite cold index.
- Open questions: provider keys blocked server-side (google referrer-restricted, mapbox lacks Search Box scope) — console fix, documented in services/spatial/README.md.

### Session 2026-08-30 (b)
- Scope: payments/ledger/earnings/payouts architecture + audit. Design only, no implementation.
- Tasks: 2 parallel (read-only audits) | Agents: Explore x2 | Wall time: ~4m
- Durations (median s):
  - audit-financial-schema x Explore: 231s (n=1)
  - audit-service-flows x Explore: 186s (n=1)
- Direction signals: user insists Connect topology NOT be baked in before legal classification; REAL_CHARGES_ENABLED + PROVIDER_PAYOUTS_ENABLED hard off; test mode only; STOP after architecture.
- Open questions: take rate undefined (no commission model exists); whether payments belong on Railway (recommended NO — ledger needs same txn as trip completion); S1 simulation has no DB flag; S3 email linking + no unique email.

### Session 2026-08-30 (c)
- Scope: Phase 0 audit for extracting a platform-neutral interaction design system (SceneRecipe/tokens) + Storybook lab from service-app/limecab/freight. Audit only, no code.
- Tasks: 4 parallel (read-only) | Agents: Explore x4 | Wall time: ~2.5m (longest 148s)
- Durations (median s):
  - audit-* x Explore: 136s (n=4; 135/148/135/137)
- Direction signals: user wants recipes->renderers, NOT JSX translation; hard rule against <LimeScene> god-component and Platform.OS branches; production must stay untouched (spec §37).
- Findings that constrain design: minimize has TWO real semantics (rider preserve-in-place vs freight rehydrate-from-server) — forcing one is a stop condition; carrier portal has no surface manager (out of scope); map-overlay.ts is a global DOM side-channel and must be redesigned as OcclusionRecipe not ported; product names (limecab:overlay, limecab-route layer ids) inside shared kit mean lab COPIES, app cannot import it without a separate approved refactor; no springs exist anywhere.
- Packaging: standalone package w/ own lockfile (NOT pnpm workspace) — root tsconfig include is repo-wide and would pull any workspace member into prod typecheck. Storybook 9 + react-vite (NOT @storybook/nextjs — next.config.js imports env.js which hard-fails on DATABASE_URL).
- Open questions: 5 escalated (H-1 restore fidelity, H-2 name both minimize semantics, H-3 carrier scope, H-4 ChromeRecipe as extension, H-5 springs invented vs tuned). No implementation until answered.

### Session 2026-08-31 (rev 2)
- Scope: applied external architecture review to Phase 0 design review. Still audit-only, no production code.
- Tasks: 2 parallel (read-only) | Agents: Explore x2 | Wall time: ~2.1m
- Durations (median s): audit-* x Explore: 118s (n=2; 128/108). Running median across 6 audit lanes: 131s.
- Direction signals: user accepts external review wholesale. Governing rule sharpened to "core holds semantics; values/policies/timings live in recipes". Copy-out reframed as TEMPORARY fork w/ 3-phase convergence + SOURCE-MAP.json drift tracking; doctrine now "app must not import DURING extraction" (not "never").
- Contract changes: intent moved off scene onto Transition; SceneState/ShellIntent/ExperienceFrame split; SNAP + SURFACE_MOTION_MS out of core into recipes/; RestoreStrategy demoted to harness ScenarioRestoreMode; recenterNonce -> InteractionCommand union; SurfaceId/SceneId branded; RendererEnvironment added; OcclusionIntent variants. Declined: `extensions?: unknown` bag (typed composition instead).
- New findings: BACK has 16 mechanisms and ZERO arbiter; precedence emergent from DOM nesting + JSX ternary limecab-app.tsx:1524-1530; no handled/unhandled anywhere; backDriverAppState DEAD code; scenes push NO browser history (no pushState/popstate/beforeunload repo-wide); wiring unhandled->goBack WOULD change rider home-back from no-op to route pop = production behavior change.
- A11y: ~410 portable-semantic vs ~28 web-mechanism; interaction->inert and locked->aria-busy are an EXISTING core-enum->renderer-attr mapping (contract's proven shape); rider/driver/partner announce serviceAppQuestion via sr-only aria-live; FREIGHT has zero live region.
- Open questions: 6 decisions (H-1..H-6). H-6 back-ownership is Phase-1 blocking. No implementation until answered.

### Session 2026-08-31 (rev 3) — PHASE 1 APPROVED
- Scope: applied second external review round. Still audit-only, zero production code.
- Tasks: 1 (read-only) | Agent: Explore | 95s. Audit-lane median across 7 lanes: 128s.
- Disposition: Phase 1 APPROVED with 4 edits + revised H-6. Ready to build core + tokens.
- Contract rev3: RendererEnvironment -> PresentationEnvironment in policy/ (invariant: no reducer imports it); InteractionCommand split ExperienceCommand vs WebRendererCommand (anchor:string stays web); LogicalInsets -> EdgeInsets; AccessibilitySemantics added to core; announcement moved onto Transition w/ eventId (cold remount must not re-announce); metadata marked DIAGNOSTIC ONLY; surfaceId()/sceneId() constructors.
- H-6 RESOLVED: Back is coordination not one reducer op. BackDisposition union (dismiss-transient|return-interrupt|regress-scene|minimize-live-work|exit-product|delegate-to-host|consume) + BackResolver. Resolve, don't execute. `consume` distinct from "handled" — rider Home no-op preserved without becoming host nav. Ownership split 5 ways; SurfaceManager does NOT own all regression. Android ladder deferred to Phase 4 (precedence is emergent, asserting a law = invention).
- LAYERING CORRECTED (audit beat reviewer): surface-manager.ts -> core whole (3 products, 0 domain tokens). surface-progress.ts -> core WHOLE, NOT split (4 products; taskStatus/error inseparable from reducer :118,144,152-174). state.ts -> scenarios/rider (1 importer, 9/13 scenes booking domain; driver-state.ts:8 explicitly refuses reuse; freight+partner wrote own machines). status.ts -> SPLIT (only GlanceMetric/glanceLabel/formatTimeCounter core). Reviewer had progress/status backwards.
- Convergence hardened: 8 objective Phase-1 exit criteria; docs/CONVERGENCE.md ledger w/ forced classification; drift budget 3-state (UNCHANGED|CHANGED_UNREVIEWED|CHANGED_RECONCILED).
- Next: Phase 1 implementation — package skeleton + root tsconfig exclude, then core/ + tokens/.
