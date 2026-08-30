
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
