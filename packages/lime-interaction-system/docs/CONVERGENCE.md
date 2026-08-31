# Convergence ledger

Phase 1 is a deliberate fork. **Production is authoritative for behaviour; the lab is
authoritative for type precision.** Every divergence is classified — nothing sits undeclared.

Classifications: `production bug` · `lab experiment` · `intentional platform divergence` ·
`candidate shared abstraction` · `unresolved`

| Concept | Production | Lab | Classification |
|---|---|---|---|
| `SurfaceState.presentation` | `string \| null` (open, untyped) — `surface-manager.ts:58` | real `SurfacePresentation` union | candidate shared abstraction |
| `SurfaceLayout` key | bare `string` | branded `SurfaceId` | candidate shared abstraction |
| Snap fractions | in component — `service-sheet.tsx:49-52` | `recipes/web-mobile/` policy | candidate shared abstraction |
| Motion timings | in core reducer — `surface-manager.ts:98` | `recipes/web/motion.ts` | candidate shared abstraction |
| Transition intent | on the surface recipe | on `Transition` | candidate shared abstraction |
| Map occlusion | DOM side-channel — `map-overlay.ts:12,21,37` | `OcclusionIntent` | candidate production refactor |
| Motion phase | carries `taskStatus` + `error` — `surface-progress.ts:17-27` | unchanged (inseparable) | unresolved |
| Back handling | 16 mechanisms, no arbiter | `BackResolver` prototype | unresolved — Phase 4 |
| Freight live region | absent — zero `aria-live` under `components/freight/**` | `AccessibilitySemantics` | **production gap** |
| Product names in kit | `"limecab:overlay"`, `limecab-route` layer ids | not copied | intentional — renaming production is a behaviour change |

## Phase 1 exit criteria

Leaves Phase 1 only when **all eight** hold:

1. Freight reference flow passes
2. Rider reference flow passes
3. Driver reference flow passes
4. Interrupt restoration passes
5. Minimize/restore scenarios pass — both strategies
6. Core has no platform dependencies *(enforced: `tests/contract.test.ts`)*
7. Back semantics have a demonstrated lab model
8. No copied core file carries unexplained production drift *(enforced: `npm run drift`)*

Two of the eight are already machine-checked. The rest need Phases 2-4.
