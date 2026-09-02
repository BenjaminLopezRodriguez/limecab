# Parity work queue

Working document. Read this and the current cluster's packets at session start — **not** the
whole repo. The master architecture doc is `docs/specs/lime-web-to-native-parity-spec.md`; read
it once, not every turn.

**Objective:** converge a finite list of observable Rider and Driver behaviours to zero
discrepancies. Not "port 23,400 lines". The unit of work is observable behaviour.

**Architecture is frozen by default.** It changes only when an observed production behaviour
cannot be represented by the existing contracts — never because something would be cleaner, more
idiomatic, or recommended elsewhere.

**Statuses:** `READY` (packet exists) · `BLOCKED` · `IN CODEX` · `IN CLAUDE` · `READY FOR IOS` ·
`VERIFIED` · `DONE`

A `READY` item must already have a parity packet. Nothing is delegated without one.

---

## Driver — Cluster A · offline / online / availability

| State | Status | Packet | Notes |
|---|---|---|---|
| `offline` | VERIFIED | `driver/offline.md` | launcher; map-as-card; device-checked |
| `online` | VERIFIED | `driver/online.md` | full-bleed canvas; peek has **no** CTA |
| availability toggle | READY | — | production has no separate state; folded into the two above |

Remaining gaps, both **DATA/RENDERER**, neither blocking:
- production's map card is a dark H3 hexagon demand grid; ours is the light graticule placeholder
- production has floating shield / preferences / `$0.00 ›` earnings pill, plus a 4-tab bottom bar
  (`ShellIntent` territory, deliberately deferred)

## Driver — Cluster B · offer / decline / accept

| State | Status | Packet | Notes |
|---|---|---|---|
| `offer` | READY FOR IOS | — | renders as `interrupt` + `sheet` over suspended duty; needs a web capture |
| decline | VERIFIED | — | `return` restores the held surface exactly |
| accept | VERIFIED | — | |

## Driver — Clusters C–E

`en route` · `arrived` · `PIN/start` · `active trip` · `minimize/restore` · `complete` ·
`earnings` — all **BLOCKED on capture**. Reaching them in production web needs a real dispatch,
which needs a rider requesting in a second session. Native versions exist but are unverified
against production.

## Rider — Clusters A–E

All states have a written reference in `docs/specs/rider-ride-production-reference.md` (12 states,
exact type/spacing values with `file:line`), but **no screenshots yet** — production web is
reachable signed-out at `/`, so these are capturable.

| Cluster | States | Status |
|---|---|---|
| A | home · search · destination · configure | READY (configure out of scope — see spec §9) |
| B | ride options · quote · confirm pickup | READY |
| C | request · interstitial · matching · assigned | READY |
| D | arrival · PIN · in ride · minimize/restore | BLOCKED on capture |
| E | complete · rating · tip · receipt | BLOCKED on capture |

---

## Session log

**2026-09-02** — adopted the lead/orchestrator operating model. Built the parity gallery
(`/parity` + `?step=` deep links, reusing `machine.jump()` rather than a second renderer path).
Wrote the first two packets from already-captured production references. Watchman verified.
iOS validated: deep link to `rider?step=assigned` and the gallery itself. Static only for the
gallery gutter fix — a cosmetic change does not earn a device pass.

Tests run: `@lime/ui` typecheck + contract (34 files / 6 adapter exports), interaction-system
typecheck + 64 tests, app typecheck. iOS: yes, one batched pass.

## Next READY item

**Rider Cluster A** — capture `home`, `search` and `destination` from production web at 390px,
write the three packets, then implement as one cluster and take a single batched iOS pass.

## Tooling state

- **Watchman installed and verified** — package edits hot-reload; no Metro restart ritual.
  `--clear` only on evidence of stale resolution.
- **Parity gallery**: `/parity` in the native app, or deep-link `lime://rider?step=assigned`.
  Never replay a flow to reach a state.
- **Simulator is owned by the lead process only.** Subagents deliver statically validated work.
- Production web: `npx next dev -p 3100`. Sign in with any phone; the dev build prints the OTP
  on screen. `/driver` needs a driver row — register once per fresh database.
- `pkill -f "expo start"` does **not** reliably kill Metro. Use `lsof -nP -iTCP:8099 -sTCP:LISTEN`
  then `kill -9`.
