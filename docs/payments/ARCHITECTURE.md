# Lime payments, ledger, earnings and payouts — architecture

Status: **reviewed 2026-08-30. Phase 0 implemented; phases 1+ not started.**
Date: 2026-08-30. Stripe facts verified against live docs this date.

---

## 1. Existing system audit

### What exists

**No payment infrastructure of any kind.** No processor SDK in `package.json`,
nothing in `node_modules` matching stripe/paypal/braintree/adyen/square, no
charge, refund, intent, webhook or payout code anywhere. This is greenfield —
which is good news, because there is no parallel system to reconcile against.

The payment-shaped things that do exist are all facade:

| Artifact | Location | Reality |
|---|---|---|
| `type PaymentMethod` | `src/lib/limecab/domain.ts:95-101` | Comment says "Display only — no processor is wired up" |
| `PAYMENT_METHODS` | `src/lib/limecab/mock.ts:511-520` | Hardcoded fake cards |
| Wallet balance | `src/lib/limecab/mock.ts:517` | The string `"$12.00 balance"` |
| `DRIVER_PAYOUT` | `src/lib/limecab/mock.ts:189-193` | Display strings, `"Bank ···· 4821"` |
| "charged when the ride ends" | `src/app/profile/payment/page.tsx:28` | Aspirational copy |

### What is already right

Three conventions are worth preserving rather than replacing:

1. **Money is already integer cents everywhere it is persisted.**
   `trips.baseCents/distanceCents/timeCents/bookingCents/totalCents` are all
   `integer NOT NULL` (`schema.ts:174-178`). The schema even states the rule at
   `schema.ts:128-131`: "Money is integer cents — never float." No `numeric`,
   `decimal` or `money` column exists. The hard part of the money-representation
   requirement is already done.
2. **Fare is computed server-side and no client total is ever read.**
   `trip.ts:146-153` recomputes distance, minutes and fare from the submitted
   coordinates; `trip.ts:146-147` says so explicitly. **No tRPC input or route
   handler anywhere accepts a `*Cents`, `amount`, `total`, `tip` or `promo`
   value** — verified exhaustively across all routers and route handlers.
3. **An idempotency-key precedent already exists.**
   `unique(limecab_trip_request_idempotency_unique)` on
   `trips.requestIdempotencyKey` (`schema.ts:218`, `drizzle/0000:72`), with
   replay returning the existing row plus an ownership check
   (`trip.ts:104-112`). This is the pattern to extend, not reinvent.

### What is missing and will block financial work

| Gap | Evidence | Consequence |
|---|---|---|
| **No database transactions anywhere** | `db.transaction` appears in zero files. Concurrency is compare-and-set in WHERE clauses (`driver.ts:881-905`, `trip.ts:252-260`) | CAS is fine for one row. A balanced ledger transaction writes N rows that must commit together. This is a hard prerequisite. |
| **No role middleware** | Only `publicProcedure` and `protectedProcedure` exist (`trpc.ts:111,121`). Driver identity is a copy-pasted `drivers.findFirst` in 7+ places | No single place to enforce "is a driver", "owns this payout" |
| **No durable async mechanism** | `vercel.json` has no `crons` key. No queue, worker, outbox, `after()` or `waitUntil` | Webhooks and payouts need durable retry. Nothing to build on. |
| **No webhook receiver** | All 9 route handlers are request/response proxies to Mapbox/Google/DeepSeek | Entire ingestion path is new |
| **Zero DB or router tests** | 39 test files, ~312 tests, all pure-unit and colocated. None touch DB, tRPC or React | Ledger invariants cannot be tested by the existing harness as-is |

### Money that exists today, and what it is not

`estimateFare` (`domain.ts:153-170`) produces base + distance + time + a flat
249¢ booking fee, scaled by a per-product rate multiplier. That is the *whole*
economic model. Specifically absent: **there is no commission, split, take-rate
or platform-fee concept anywhere in the codebase.** `driver.earnings`
(`driver.ts:74-88`) sums `trips.totalCents` over completed trips — i.e. today
the driver's displayed "earnings" is the entire fare the rider was quoted.

Tips and promos exist **only as client-side React state** (`limecab-app.tsx:1649`
for `tipCents`, `:1962` for discount) and reach the server never. `TIP_PRESETS`
is a constant; there is no tip column, no tip input, no tip procedure.

Per-service money reality:

- **Ride** — the fare above. No minimum charge, no cancellation fee, no surge.
- **Courier** — size maps to a rate multiplier (0.80/1.18/1.68×) via product id
  (`courier.ts:155-183`). `packageCount` is stored and displayed but **never
  multiplied into price**.
- **Shop** — **merchandise money does not exist anywhere.** `ShopItem` is
  `{label, note?, qty?}` with no price field (`shop-list.ts:16`). The code
  disclaims it three times, e.g. `shop-list.ts:6-8`: "item cost is paid in store
  and this build has no reimbursement path." A Shop trip is priced as
  `courier-small`. No receipt, no overage, no spend cap, no reimbursement.
- **Help** — priced as a fixed notional hour: `HELP_VISIT_MINUTES = 60`
  (`help.ts:56`) fed to the time term. **Nothing measures actual on-site time** —
  there is no visit clock. No minimum charge, no overtime, no hourly rate constant.
- **Pool** — `pool-match.ts` is a real, wired *ranking* function, but **split
  fares do not exist**. Two matched pool legs are two independent `trips` rows
  with two independent full fares. "Share the trip, split the fare"
  (`mock.ts:77`) is marketing copy with nothing behind it.
- **Reserve** — `reserve.ts` is three date functions. No reservations table, no
  deposit, no cancellation fee. `trip.cancel` charges nothing and checks nothing
  but status.

### One service model, not four

All four verticals share the single `trips` table (`schema.ts:132-215`) and the
single state machine (`state.ts:7-14`), discriminated by `productId` plus
nullable columns. There is no orders table, no line-items table, no reservations
table. **This is a significant advantage** — the financial layer attaches to one
service model, and I recommend keeping it that way rather than introducing a
parallel order model, which the brief also forbids.

---

## 2. Proposed money flow

```
        RIDER (customer)
             │  card, via Stripe Elements — Lime never sees a PAN
             ▼
   ┌─────────────────────┐
   │  STRIPE (processor) │   PaymentIntent: authorize → capture
   └─────────────────────┘   Stripe holds the money and tells us what it did
             │
             │  webhook: payment_intent.*  (converging, not commanding)
             ▼
   ┌───────────────────────────────────────────────────────────┐
   │  LIME LEDGER  — append-only, double-entry, the truth       │
   │                                                            │
   │  service economics decomposed into WHY each cent exists:   │
   │    rider paid ──┬── provider earned    (liability)         │
   │                 ├── Lime fee           (revenue)           │
   │                 ├── tip                (liability, pass-thru)│
   │                 ├── merchant reimb.    (Shop only)         │
   │                 └── processor fee      (expense)           │
   └───────────────────────────────────────────────────────────┘
             │
             │  earnings are recognised here and ONLY here.
             │  no money has moved to anyone yet.
             ▼
   ┌─────────────────────┐
   │  PROVIDER PAYABLE   │  derived from ledger entries.
   │  (a balance, not a  │  "$17.40 owed" ≠ "$17.40 sent"
   │   mutable column)   │
   └─────────────────────┘
             │
             │  eligibility: funds captured + settled + gates on
             ▼
   ┌─────────────────────┐
   │  PAYOUT             │  Stripe Transfer → connected account,
   │  (settlement)       │  then Stripe payout → their bank
   └─────────────────────┘
```

The horizontal separation the brief asked for, stated as an invariant:

> **A trip completing creates an EARNING. It does not move money.**
> **A payment capturing moves money. It does not decide who owns it.**
> The ledger is the only place those two facts meet.

---

## 3. Regulatory assumption matrix

Each row is a decision that would silently encode a legal conclusion. **None of
these are resolved here.** The design's job is to keep each one a configuration
value rather than a hardcoded assumption.

| # | Decision | Assumes Lime is… | How the design defers it | Blocking? |
|---|---|---|---|---|
| R1 | Who is merchant of record on the rider's card statement | Direct charge → provider is MoR. Destination/separate → **Lime is MoR** | Charge-type choice isolated in one adapter module; ledger unaffected | **Blocks production charges.** Not test mode. |
| R2 | Whether Lime holds rider funds before paying provider | Money transmitter / payment facilitator questions | Separate charges + transfers means Lime's balance holds funds between capture and transfer. Flagged, not resolved. | **Blocks production.** |
| R3 | Whether "platform fee" is commission on a service Lime sells, or a SaaS fee to an operator | Marketplace vs software provider | Chart of accounts has *both* `revenue:platform_fee` and `revenue:saas_fee`; which one a service posts to is per-product config, not code | No — both representable |
| R4 | Whether the provider is Lime's contractor or a licensed carrier's driver | Employer / TNC classification | `beneficiary` on an earning is a polymorphic `(type, id)`, where type ∈ `provider \| carrier \| merchant \| platform`. Nothing assumes provider. | No |
| R5 | Whether tips are Lime revenue | Tax and 1099 treatment | Tips post to `liability:tips_payable`, never to revenue. Reversible if counsel says otherwise. | No |
| R6 | Whether Lime participates in payment at all for operator arrangements | Pure software vendor | A service can be marked `settlement_mode: none` — Lime records the economic event with **no** payment and **no** transfer. Ledger still balances. | No |
| R7 | Sales tax / TNC per-ride fees collection and remittance | Seller vs facilitator | `liability:tax_payable` account exists and is unused. No tax is computed. | No — deferred |
| R8 | 1099 / earnings reporting obligation | Payer of record | Not designed. Out of scope per non-goals. | No — deferred |
| R9 | Whether a cancellation fee is a service charge or a penalty | Contract terms | Modelled as an ordinary priced economic event; classification is an account mapping | No |

**Recommendation: R1 and R2 must be answered by counsel before
`REAL_CHARGES_ENABLED` is ever set true.** Everything in phases 2–9 can be built
and fully tested without answering them.

---

## 4. Stripe Connect model analysis

Verified against `docs.stripe.com/connect/charges` and
`docs.stripe.com/connect/separate-charges-and-transfers`, 2026-08-30.

| | Direct charges | Destination charges | Separate charges + transfers |
|---|---|---|---|
| Charge created on | connected account | platform | platform |
| Funds first land in | connected account balance | platform balance, portion transfers immediately | platform balance |
| Merchant of record | connected account | platform (unless `on_behalf_of`) | platform (unless `on_behalf_of`) |
| **Refunds debit** | connected account balance | **platform balance** | **platform balance** |
| **Disputes debit** | connected account balance | **platform balance + fee** | **platform balance + fee** |
| Platform's cut via | `application_fee_amount` | `application_fee_amount` / `transfer_data` | whatever is left after `Transfer` |
| Beneficiary known at charge time | required | required | **not required** |
| One charge → many beneficiaries | no | no | **yes** |
| Stripe's named example | SaaS: Shopify, Thinkific | **"a branded service that uses independent contractors, such as a rideshare app"** | **"DoorDash, a restaurant delivery platform"** |

Note from the docs: direct charges are **not recommended for legacy v1 Express
and Custom accounts**; Stripe directs those to v2 accounts or destination charges.

### Recommendation: separate charges and transfers — with a caveat that matters more than the choice

Destination charges are, on Stripe's own description, the closest fit for Ride
alone. I am **not** recommending them, for three reasons:

1. **It forces the beneficiary decision at charge time.** A destination charge
   requires naming the connected account when the PaymentIntent is created.
   That is precisely the decision the regulatory questions (R1, R4) have not
   answered. Separate charges let Lime capture a rider payment and decide later
   — or never — who receives a transfer. This directly preserves the optionality
   you asked for.
2. **Shop cannot be expressed as a destination charge.** Shop is inherently
   one-to-many: merchandise reimbursement and shopper earnings are different
   money to different parties from one rider payment. Stripe names exactly this
   case ("split between the store and the delivery person") as requiring
   separate charges. Choosing destination now means rewriting for Shop later.
3. **Pooled rides are many-to-one**, another case Stripe names for separate
   charges. `lime-pool` is already bookable today.

The cost of the recommendation, stated plainly: **Lime's platform balance eats
refunds and disputes**, Lime must monitor available balance, and the integration
is more complex. Destination charges would be less work today.

### The caveat, which is the actual recommendation

**Do not choose a Connect topology in phases 2–5, because nothing in those phases
needs to know.** The ledger, earnings, payables and financial snapshots are
provider-agnostic accounting facts. Connect enters only at phase 6 (onboarding)
and phase 7 (transfers).

Concretely: `EARNING` rows and `liability:provider_payable` entries are created
by trip completion and reference **no Stripe object at all**. A `Transfer` is a
later, separate record that *settles* a payable. If we later switch from separate
charges to destination charges, the ledger does not change — only the payout
adapter does. That is the structural answer to "don't bake a topology throughout
the application."

Mechanics we will rely on when we get there:

- `transfer_group` — associates charge and transfers; "must represent a single
  business action". Use the Lime service id. It identifies only; it controls nothing.
- `source_transaction` — ties a Transfer to a charge so the request **succeeds
  regardless of current platform balance**, with funds moving to the connected
  account only once the charge settles. This is the mechanism that makes
  "earning now, money later" work without balance babysitting.
- Transfer reversal for refund recovery — **requires the connected account to
  still hold the balance.** A provider paid out and withdrawn cannot be clawed
  back this way. This is a real risk, recorded in §7.

---

## 5. Data model

Prefix `limecab_`, matching `pgTableCreator`. Idempotent DDL, matching the
hand-written migration style of `0002_support_verify.sql`.

### Money representation

```ts
type Money = { minor: number; currency: CurrencyCode };  // minor units, integer
```

`minor` is a JS `number` constrained to safe integers, not `bigint`: the existing
codebase uses `integer` cents throughout and `bigint` would break Zod/superjson
serialisation across tRPC for no benefit at Lime's amounts. Columns are
`bigint`-capable where a sum could grow (ledger entries), `integer` where they
mirror existing trip columns. **Every amount column is paired with a `currency
char(3)` column. There is no unpaired amount anywhere in the schema.**
Cross-currency arithmetic throws at the type level and is rejected by a check
constraint at the ledger level.

### Tables

**`payment_customer`** — rider ↔ processor customer.
`(id, user_id → users.id, processor, processor_customer_id, created_at)`,
`UNIQUE(processor, processor_customer_id)`, `UNIQUE(user_id, processor)`.

**`payment_method`** — reference only. `(id, payment_customer_id, processor,
processor_payment_method_id, brand, last4, exp_month, exp_year, is_default,
status, created_at)`, `UNIQUE(processor, processor_payment_method_id)`.
**No PAN, no CVC, no bank credentials. Ever.**

**`payment`** — Lime's record of one customer payment.
`(id, service_id → trips.id, user_id, status, intent_amount_minor,
authorized_amount_minor, captured_amount_minor, refunded_amount_minor, currency,
processor, processor_payment_intent_id, processor_charge_id, idempotency_key,
livemode boolean NOT NULL, created_at, updated_at)`.
`UNIQUE(processor, processor_payment_intent_id)`, `UNIQUE(idempotency_key)`,
`CHECK (captured_amount_minor <= authorized_amount_minor)`,
`CHECK (refunded_amount_minor <= captured_amount_minor)`,
`CHECK (all amounts >= 0)`.

**`payment_event`** — append-only attempt/transition log per payment. Every state
change writes a row; `payment.status` is a materialised convenience.

**`service_financial_snapshot`** — immutable terms at completion.
`(id, service_id UNIQUE, currency, subtotal_minor, customer_fees_minor,
taxes_minor, discount_minor, tip_minor, total_charged_minor,
provider_gross_minor, provider_adjustments_minor, provider_net_minor,
platform_fee_minor, merchant_reimbursement_minor NULL, carrier_amount_minor NULL,
pricing_version, product_id, created_at)`.
Written once, **never updated** — enforced by trigger. `pricing_version` is a
constant bumped whenever `estimateFare` changes, so historical money is never
recomputed by today's code.

**`ledger_account`** — chart of accounts.
`(id, key UNIQUE, type ∈ asset|liability|revenue|expense, owner_type NULL,
owner_id NULL, currency)`. Per-provider payable accounts are rows, not columns.

**`ledger_transaction`** — `(id, kind, service_id NULL, currency,
idempotency_key UNIQUE, created_at)`. Append-only.

**`ledger_entry`** — `(id, transaction_id, account_id, direction ∈ debit|credit,
amount_minor bigint CHECK > 0, currency, created_at)`.
**Balance invariant enforced in the database**, not TypeScript: a deferred
constraint trigger asserts `SUM(signed amount) = 0` per `(transaction_id,
currency)` at COMMIT, and that every transaction has ≥ 2 entries. Both tables are
protected by a trigger rejecting `UPDATE` and `DELETE`.

**`earning`** — why a beneficiary is owed money.
`(id, service_id, beneficiary_type ∈ provider|carrier|merchant|platform,
beneficiary_id, component ∈ base|distance|time|bonus|tip|adjustment|reimbursement,
amount_minor, currency, ledger_transaction_id, created_at)`.
`UNIQUE(service_id, beneficiary_type, beneficiary_id, component)` — **this single
constraint is what makes replayed completion unable to duplicate earnings**, and
it lives in the database, not application code.

**`adjustment`** — `(id, reason, amount_minor, currency, beneficiary_type,
beneficiary_id, service_id NULL, created_by_user_id, ledger_transaction_id,
created_at)`. The only sanctioned way to correct a balance. There is no endpoint
that sets a balance.

**`refund`** — `(id, payment_id, service_id, amount_minor, currency, reason,
initiated_by_user_id, status, processor_refund_id, ledger_transaction_id,
idempotency_key UNIQUE, created_at, completed_at)`.
`UNIQUE(processor, processor_refund_id)`.

**`dispute`** — `(id, payment_id, service_id, amount_minor, currency, reason,
status, evidence_due_at, processor_dispute_id UNIQUE, ledger_transaction_id NULL,
created_at, resolved_at)`.

**`provider_payment_account`** — Lime-owned normalised state, separate from user
identity. `(id, provider_id → drivers.id UNIQUE, processor,
processor_account_id UNIQUE, state ∈ not_started|onboarding|pending_verification|
active|restricted|payouts_disabled|disabled, payouts_enabled boolean,
charges_enabled boolean, requirements_json, livemode, created_at, updated_at)`.
Stripe capability state is *source data*, mapped into `state`. Never the reverse.

**`payout`** — settlement of a payable. `(id, provider_payment_account_id,
amount_minor, currency, status ∈ pending|in_transit|paid|failed|reversed,
processor_transfer_id, processor_payout_id, failure_code, ledger_transaction_id,
idempotency_key UNIQUE, created_at, updated_at)`.

**`webhook_event`** — `(id, processor, processor_event_id, type, payload_json,
status ∈ received|processed|failed|ignored, received_at, processed_at,
attempts, last_error)`. **`UNIQUE(processor, processor_event_id)`**.

**`outbox`** — `(id, kind, payload_json, status, attempts, next_attempt_at,
created_at, locked_at, locked_by)`. See §7.

**`reconciliation_run`** / **`reconciliation_finding`** — see §9 of the plan.

### Changes to existing tables

- **`trips` gains `simulated boolean NOT NULL DEFAULT false`.** This is the
  single most important schema change in the proposal — see Security below.
- **`drivers` gains nothing.** No `balance` column. Ever. Payable is derived.

### Payment state machine

```
                    ┌──────────────────────────────┐
created ──> requires_payment_method ──> authorizing ──> authorized
                    │                       │              │
                    │                       ▼              ▼
                    └──────────────────> failed      capturing
                                              │            │
                                    canceled <┘            ▼
                                                       captured
                                                     │    │    │
                          partially_refunded <───────┘    │    └──> disputed
                                    │                     ▼
                                    └──────────────> refunded
```

Mapped to Stripe: `requires_payment_method`/`requires_confirmation` →
`requires_payment_method`; `requires_capture` → `authorized`; `succeeded` →
`captured`; `canceled` → `canceled`.

**`trips.status` and `payment.status` are separate fields on separate tables and
neither is derived from the other.** `trip.status = 'complete'` with
`payment.status = 'authorized'` is a normal, recoverable state — it means the
ride happened and capture has not run yet.

---

## 6. Ledger model

### Chart of accounts

| Key | Type | Meaning |
|---|---|---|
| `asset:processor_cash` | asset | funds held at Stripe |
| `asset:processor_receivable` | asset | captured, not yet settled |
| `liability:provider_payable:<id>` | liability | owed to one provider |
| `liability:carrier_payable:<id>` | liability | owed to a licensed carrier (R4) |
| `liability:merchant_payable:<id>` | liability | Shop reimbursement (R3) |
| `liability:tips_payable:<id>` | liability | tips held for a provider (R5) |
| `liability:customer_refundable` | liability | owed back to riders |
| `liability:tax_payable` | liability | **exists, unused, no tax computed** (R7) |
| `revenue:platform_fee` | revenue | commission on a Lime-sold service (R3) |
| `revenue:saas_fee` | revenue | operator software fee (R3) |
| `expense:processor_fee` | expense | Stripe's cut |
| `expense:promotion` | expense | Lime-funded discount |
| `expense:refund` | contra-revenue | refunds issued |
| `expense:adjustment` | expense | corrections |

Per-beneficiary accounts are **rows keyed by owner**, so a provider's balance is
`SUM(entries)` over their account — never a mutable column.

### Worked examples

**A $20 Ride.** Rider charged 2000¢. Provider earns 1600¢, Lime fee 400¢.
Stripe's fee (~88¢) is charged to the platform and is *not* deducted from the
provider.

*T1 — capture:*
```
debit  asset:processor_cash              2000
credit liability:provider_payable:D1     1600
credit revenue:platform_fee               400        Σ = 0
```
*T2 — processor fee (on settlement):*
```
debit  expense:processor_fee               88
credit asset:processor_cash                88        Σ = 0
```
Provider payable is 1600¢ the instant the ride completes. **No money has moved to
the provider.** Lime's revenue is 400¢ gross, 312¢ net of processor fee — and
note this is *not* `customer paid − provider earned`, which is 400¢. The
difference is exactly why the brief forbids that shortcut.

**A $3 tip, added after settlement.** Separate PaymentIntent, separate ledger
transaction, tip is never revenue:
```
debit  asset:processor_cash               300
credit liability:tips_payable:D1          300        Σ = 0
```

**A $5 Lime-funded promotion on that $20 ride.** Rider pays 1500¢, provider still
earns on $20 economics. The 5 dollars has a named source:
```
debit  asset:processor_cash              1500
debit  expense:promotion                  500
credit liability:provider_payable:D1     1600
credit revenue:platform_fee               400        Σ = 0
```

**Partial refund of $5, provider not clawed back** (a Lime service-recovery
decision — provider keeps their earning):
```
debit  expense:refund                     500
credit asset:processor_cash               500        Σ = 0
```
The original T1 is untouched. History is added to, never rewritten.

**Payout of 1600¢ + 300¢ tip to the provider:**
```
debit  liability:provider_payable:D1     1600
debit  liability:tips_payable:D1          300
credit asset:processor_cash              1900        Σ = 0
```
Payable now nets to zero. The `payout` row tracks whether Stripe actually
delivered it; if the payout **fails**, a reversing transaction restores the
payable — the obligation never silently disappears.

---

## 7. Failure analysis

The governing rule: **Stripe is asked what happened; it is never assumed.**
Handlers converge state rather than performing side effects.

| Failure | Recovery |
|---|---|
| **Duplicate request** (double-tap capture) | `payment.idempotency_key` UNIQUE. Second insert violates, we re-read and return the existing payment. Deterministic key `payment:capture:<serviceId>`. |
| **Duplicate webhook** | `UNIQUE(processor, processor_event_id)` on `webhook_event`. Insert-first; on conflict, ack 200 and stop. Stripe redelivers aggressively; this is the common case, not an edge case. |
| **Processor timeout — Stripe succeeded, we never heard** | The dangerous one. We write the `payment` row with its idempotency key **before** calling Stripe. On timeout the row exists in `authorizing`. A reconciling worker retries with the *same* Stripe idempotency key and gets the original result back. **Caveat: Stripe prunes idempotency keys after 24 hours** — beyond that the key is a new request, so the worker must instead *query* Stripe by `payment_intent_id` rather than retry blind. This is why the local row is written first. |
| **DB commits, network response lost** | Client retries with the same key, hits the UNIQUE, gets the same answer. Safe by construction. |
| **Stripe succeeds, our DB write fails** | Ledger transaction never committed → payment stays `capturing`. Reconciliation (§ phase 9) finds a Stripe charge with no completed Lime payment and **reports it**. It does not auto-repair. |
| **Out-of-order webhook** (refund before capture) | Handlers are state-convergent and never assume ordering. A refund event for an uncaptured payment fetches authoritative state from Stripe, applies what is true, and if still inconsistent parks the event as `failed` for inspection rather than forcing a transition. |
| **Failed payout** | `payout.status = failed`, a reversing ledger transaction restores `provider_payable`. Balance is restored, not lost. Retry is explicit, never automatic — a retry loop against a failing bank account is how you generate duplicate payouts. |
| **Refund after provider already paid out** | Transfer reversal **requires the connected account to still hold the balance**. If they have withdrawn, reversal fails. Recorded as a negative `adjustment` against future earnings, visible and explainable. There is no silent write-off. |
| **Crash between ledger write and outbox dispatch** | Both are in one DB transaction (outbox pattern). Either both commit or neither does. |

### Transactional outbox — recommended, minimal

The repo has **no** durable async mechanism and `vercel.json` has no crons. I do
not propose Kafka or a queue service. The proposal is one `outbox` table plus a
single Vercel cron endpoint that claims rows with `FOR UPDATE SKIP LOCKED`. The
financial write and the intent to call Stripe commit atomically; the worker
performs the side effect and records the result. This is the smallest durable
mechanism that is actually correct, and it is the reason `db.transaction` must
be introduced first.

---

## 8. Implementation plan

Each phase ends green (typecheck, lint, tests) and is independently reviewable.
**Phases 1–9 involve no real money at any point.**

| Phase | Deliverable | Gate |
|---|---|---|
| **0. Safety prerequisites** | `trips.simulated` column + backfill; `driverProcedure` middleware; first `db.transaction` usage; feature-gate env vars all defaulting **off** | — |
| **1. Audit + architecture** | This document | ← **you are here, awaiting review** |
| **2. Money + ledger** | `Money` type, chart of accounts, ledger tables, DB-level balance trigger, immutability triggers | no processor at all |
| **3. Stripe adapter + customers** | SDK, key handling, `payment_customer`, `payment_method`, SetupIntent, webhook receiver with signature verification | **test mode only** |
| **4. Ride authorize/capture** | payment state machine, authorize on request, capture on server-authoritative completion, snapshot | **test mode only** |
| **5. Earnings allocation** | `earning` rows, the UNIQUE that prevents duplication, payable balances derived from ledger | no transfers |
| **6. Connect onboarding** | `provider_payment_account`, onboarding, capability→state mapping | **test mode only** |
| **7. Transfers + payouts** | payout lifecycle, `source_transaction`, failure/restore | **test mode, gate off** |
| **8. Refunds + disputes** | refund and dispute objects, ledger adjustments, transfer reversal | test mode |
| **9. Reconciliation** | Lime vs Stripe comparison, findings report, **no auto-repair** | test mode |
| **10. Other services, one at a time** | Courier → Help → Shop | test mode |

Shop is deliberately **last**: it is the only service needing merchandise money,
receipts, spend ceilings and overage approval, none of which exist today in any
form. It is a product design problem before it is a payments problem.

### First vertical slice (end of phase 7)

TEST rider → TEST card → quote → authorize → request → TEST driver accepts →
server-authoritative completion → capture → immutable snapshot → balanced ledger
transaction → provider earning → payable → TEST transfer → payout lifecycle →
reconciliation clean. **One ride, every cent explained.**

### Rollout gates — all default OFF

| Var | Default | Meaning |
|---|---|---|
| `PAYMENTS_ENABLED` | `false` | payment objects created at all |
| `REAL_CHARGES_ENABLED` | `false` | live-mode keys permitted. **Blocked on R1, R2.** |
| `PROVIDER_PAYOUTS_ENABLED` | `false` | transfers/payouts execute. **Blocked on R1, R2, R4.** |

Progression: simulation → Stripe test mode → internal controlled testing with
real cards and tiny amounts → counsel sign-off on R1/R2 → production.
**No gate flips as a side effect of code landing.**

---

## Security findings from the audit

These predate payments and each becomes a money defect the moment payments exist.

**S1 — Simulated trips are identified only by a string prefix.**
`simulationEnabled()` (`simulate-driver.ts:26-31`) defaults **on** whenever
`NODE_ENV !== 'production'` and can be forced on in production via
`SIMULATE_DRIVERS=true`. `maybeSimulateTrip` advances trips to `complete` and is
called from **queries** (`trip.ts:88,230`) — a rider polling `trip.active` walks
their own trip to completion on wall-clock alone. There is **no `simulated`
column on any table** (verified); a trip is simulated only via
`isSimulatedDriverId(driverId)` matching `"sim-driver-"` (`simulate.ts:15-18`).
Worse, seeded drivers use `"seed-driver-"` and `isSimulatedDriverId` returns
**false** for them — seeded drivers are indistinguishable from real ones.
Once completion mints earnings, a polling loop mints money.
**Fix, phase 0: a real `trips.simulated` column, set at creation, and a hard
assertion that no payment, earning, transfer or payout may reference a simulated
trip.** The string prefix must never be the gate.

**S2 — Any authenticated user can become a driver.** `driver.register`
(`driver.ts:209-221`) upserts a `drivers` row with no vetting. Today that costs
nothing. After phase 6 it is the front door to a payout destination.
**Fix: onboarding state must gate payouts, and `provider_payment_account.state`
must be Lime-owned, never client-assertable.**

**S3 — Account linking + no unique on email.** All OAuth providers set
`allowDangerousEmailAccountLinking: true` (`config.ts:49`) while `users.email`
has **no unique constraint** (`schema.ts:41`). Accounts link by an unverified,
non-unique email. This is an account-takeover path that becomes a
payout-redirection path.
**Fix: before phase 6. Not optional.**

**S4 — Client coordinates are the one lever on price.** `trip.ts:26-30` accepts
arbitrary lat/lng, and `distanceMiles` derived from them drives `distanceCents`
(`domain.ts:173-192`) with no route-service validation. No client *amount* is
ever accepted — that part is genuinely safe — but a client that lies about
coordinates chooses its own fare.
**Fix: validate distance server-side against the routing service before capture.**

**S5 — Ride completion has no evidence.** `driver.advance{complete}` requires
only that the caller is the assigned driver — no geofence, no rider
confirmation, no PIN (the PIN gates `start`, not `complete`:
`driver.ts:842-859` vs `:860-878`). Help has **no gate at all**. Courier's
`door`/`signature` proofs are unverified client booleans.
**Fix: completion evidence requirements must be settled before payouts, per the
brief's payout-safety conditions.**

**S7 — Dev and production share one database.** `.env`, `.env.local` and Vercel
production all resolve to the same Neon instance. Simulated trips are being
written into the production database today. `trips.simulated` mitigates this for
*trips*; it does nothing for payment objects, and a test-mode PaymentIntent
landing in the same table as a real one is a far worse problem than a test trip.
**Blocking for phase 3.** Accepted as known risk until then (reviewed 2026-08-30).

**S8 — 66 historical completed trips are unverifiable.** The 0010 backfill marked
100 of 259 trips simulated with zero mismatches, but it can only recognise
synthetic *driver ids*. 66 completed trips have a genuine-looking `driverId` and
now read as real — some are certainly local development against the shared
database (S7). **Earnings must therefore be minted only for trips completed
after payments launch.** No phase may backfill earnings from history. There is
no way to reconstruct which of those 66 were real, and guessing about which
completed rides are payable is not a thing to do quietly.

**S6 — No SQL transactions exist anywhere.** A double-entry ledger is not
implementable without them. Phase 0 prerequisite.

---

## Decisions taken at review (2026-08-30)

1. **Location — payments live in the Next app**, not a Railway service. The
   ledger must commit in the same transaction as trip completion.
2. **Take rate — 25%.** Provider nets 75% of the fare; Lime's
   `revenue:platform_fee` is 25%. Tips pass through in full and are never
   revenue (R5). This unblocks phase 5. Note the worked example in §6 uses
   80/20 and should be read as illustrative of the *shape*, not the rate.
3. **Phase 0 — done.** See below.
4. **Still open:** Connect topology is *not* yet ratified — but per §4 it does
   not need to be until phase 6, and nothing in phases 0–5 encodes it.
   Tip timing (second PaymentIntent post-completion) still needs product confirmation.

## Phase 0 — implemented

| Change | Files |
|---|---|
| `trips.simulated` column, backfilled, partial index | `drizzle/0010_trip_simulated.sql`, `schema.ts` |
| Flag stamped once at creation, never re-inferred | `routers/trip.ts` |
| Flag re-asserted when a sim driver attaches | `simulate-driver.ts` |
| `isSyntheticDriverId` — money's wider net, catches seeded drivers | `lib/limecab/simulate.ts` |
| `tripIsSimulated` — the single decision, unit tested | `lib/limecab/simulate.ts` |
| `driverProcedure` — one enforcement point for "is a driver" | `api/trpc.ts`, `routers/driver.ts` (5 sites) |
| Three rollout gates, all default off, nothing reads them yet | `env.js`, `.env.example` |
| Migration applied to the shared Neon DB: 100/259 marked, 0 mismatches | `drizzle/0010_harsh_dexter_bennett.sql` |

**Deliberately not done in phase 0:** `db.transaction` was listed as a phase 0
prerequisite but has no consumer until the ledger exists. Introducing it with
nothing to wrap would be scaffolding; it lands in phase 2 where the balanced
write needs it. S3 (email uniqueness + `allowDangerousEmailAccountLinking`)
remains scheduled before phase 6, and S4/S5 (coordinate trust, completion
evidence) before payouts.

## Open questions for review

1. **Connect topology** — do you accept separate charges and transfers, given it
   costs more complexity now and puts disputes on Lime's balance, in exchange for
   not committing to who the beneficiary is? Or is Ride-only destination charging
   worth revisiting if Shop is far enough out?
2. **Take rate** — no commission model exists anywhere in the code today.
   Provider currently "earns" 100% of the fare. What is the split, and is it
   per-product? Phase 5 cannot be built without a number.
3. **Do the Railway services from the previous session extend to payments?** The
   command line said "create and deploy railway services". My recommendation is
   **no** — payments belong in the Next app beside `trips`, because the ledger
   needs the same transaction as trip completion, and splitting them across a
   network boundary would mean distributed commit for money. The spatial index
   was separable; this is not. Flagging because it contradicts the literal ask.
4. **Tip timing** — tips today are client state only. Post-completion tipping
   needs a second PaymentIntent. Confirm that is the product intent.
