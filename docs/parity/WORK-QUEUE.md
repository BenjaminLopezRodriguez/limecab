# Parity work queue

Statuses follow the ladder in `ACCEPTANCE.md`: CODEX IMPLEMENTED -> CLAUDE STATIC REVIEWED ->
READY FOR IOS -> IOS VISUALLY VERIFIED -> DONE. Static review is not acceptance.

Two independent lanes. A fresh session should read this file first to see where capacity is.
Product truth lives in the packets; architecture doctrine lives in
`docs/specs/lime-web-to-native-parity-spec.md`; this file is scheduling only.

Provenance tags used in packets: `[OBSERVED]` · `[SOURCE-DERIVED]` · `[FIXTURE NEEDED]` ·
`[BLOCKED]`.

---

## RIDER

| cluster | states | status | packets |
|---|---|---|---|
| A | home · search · destination | **READY FOR IOS REFINEMENT** — visual pass FAILED, see `tasks/rider-visual-refinement.md` | `rider/home.md` `rider/search.md` `rider/destination.md` |
| B | ride options · upsell · confirm pickup | **CODEX IMPLEMENTING** | `rider/ride-options.md` `rider/upsell.md` `rider/confirm-pickup.md` |
| C | request · matching · assigned | CAPTURING — `matching` observed, `assigned` not | `reference/web/rider/matching.png` |
| D | arrival · PIN · in-ride | BLOCKED — needs a dispatched driver | — |
| E | complete · rating · tip · receipt | BLOCKED — needs a completed trip | — |

Dispatch file: `tasks/rider-cluster-b.md`

## DRIVER

| cluster | states | status | packets |
|---|---|---|---|
| A | offline · online · duty posture | **DONE** (device-verified; gaps listed in packets) | `driver/offline.md` `driver/online.md` `driver/duty-posture.md` |
| B | offer · decline · accept · into accepted work | **CODEX IMPLEMENTING** | `driver/offer.md` |
| C | en route · arrived · PIN/start | BLOCKED — needs an accepted job | — |
| D | active trip · minimize/restore · complete | BLOCKED | — |
| E | earnings / result | BLOCKED | — |

Dispatch file: `tasks/driver-cluster-b.md`

---

## SHARED INFRASTRUCTURE

- worktree baseline: **`967e650` on `native/parity`** — reviewed, tests + contract green
- Rider worktree (`../limecab-codex-rider`, branch `codex/rider`): **LIVE**, warming
- Driver worktree (`../limecab-codex-driver`, branch `codex/driver`): **LIVE**, warming
- Watchman: VERIFIED
- parity gallery: VERIFIED
- docs checkpoint commit: `5b35b1e` on `native/parity`
- production web: `localhost:3100`, signed in as (424) 242-4242, driver session online

## CAPTURE NOTES

- **Geocoding is unconfigured** — typing an address returns no result rows. The whole rider
  flow is still reachable via `Set location with pin` → `Set destination`, which lands on the
  identical states with a `Pinned location` label. Use that path.
- **Mapbox is live** and the production map ground is **dark**. Native's light graticule is a
  standing gap in every map-bearing packet.
- **Driver offers could not be triggered** from a rider request on this machine — the driver
  stayed idle through a full rider `matching`. Everything downstream of the offer (Driver C–E,
  Rider D–E) is blocked on that. Unblocking it needs a seeded trip near the driver rather than
  more Playwright driving.

## QUEUED WORK

- `tasks/rider-visual-refinement.md` — combined Rider A+B pass. Dispatch to the Rider worker the
  moment Rider B returns; do not dispatch sooner and do not touch that worktree meanwhile.

## OPEN ARCHITECTURAL QUESTIONS

- **`hidden` surfaces are mounted.** `NativeSceneRenderer` gives `hidden` depth 0 but never
  filters it, so a hidden surface's `autoFocus` fires and the keyboard opens on Rider Home.
  Decided: `hidden` must not mount, `suspended` must. Not a contract change — the renderer is
  collapsing a distinction the contract already makes. Queued in the refinement pass.

Otherwise none blocking. The upsell interrupt discovered on 2026-09-01 is expressible with the existing
contract (`suspended` primary + `interrupt` surface); architecture stays frozen.
