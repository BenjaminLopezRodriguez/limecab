# Lime Spatial Index — architecture

Standalone place-indexing service. Railway app + Railway Postgres. The Next
app talks to it over HTTP and never touches its tables.

## 1. Why it exists

H3 addresses the whole Earth. Postgres only stores the parts of the Earth a
Lime user has actually made us look at. `GLOBAL H3 GRID ≠ GLOBAL PLACE DB`.
No crawler, no seed, no background enumeration. Rosemead is warm because
someone stood in Rosemead; Tokyo has zero rows.

## 2. Deployment shape

```
Railway project  lime-spatial
├── spatial-index   Node 22, TypeScript, node:http, deps: h3-js postgres zod
└── Postgres        its own database, owns place / place_source / cell_coverage

limecab (Vercel) ──HTTP + X-Lime-Spatial-Key──> spatial-index
```

Source lives at `services/spatial/` in this repo but is its own pnpm package
with its own `tsconfig.json`; the root tsconfig excludes it so `pnpm typecheck`
and `next build` never see it. Railway is pointed at that root directory.

## 3. Data model

Three tables. Lime owns identity; a provider is a *source*, not the ontology.

**`place`** — one row per real-world location, Lime UUID `id` as PK.
`canonical_name, short_name, normalized_name, brand_key, latitude, longitude,
entity_type, entity_subtype, provider_types jsonb, tags jsonb,
h3_r5 r7 r8 r9 r10 r11, indexed_at, last_seen_at, source_updated_at,
fields_expire_at, status`.

**`place_source`** — the identity join. `(place_id, provider, provider_place_id)`
with `UNIQUE (provider, provider_place_id)`. One Lime place may carry a Google
place id *and* a Mapbox id *and* later an OSM or operator id. This is the table
that makes "Google is one provider" true rather than aspirational.

**`cell_coverage`** — what we actually asked, not what we hope we know.
`UNIQUE (provider, query_family, h3_index, resolution)` plus
`coverage_status ∈ unknown|hydrating|fresh|stale|empty`, `last_hydrated_at`,
`expires_at`, `result_count`, `query_radius_meters`, `metadata jsonb`.

Indexes: `(provider, provider_place_id)` unique on `place_source`;
`(h3_r9, entity_type)`, `(h3_r10, entity_type)`, `(h3_r9, normalized_name)`,
`(h3_r9, brand_key)`, `(h3_r10, brand_key)` on `place`.

## 4. H3 resolutions and why

| res | edge | role |
|-----|------|------|
| r5  | ~8.5 km | metro. Stored for future rollups only. |
| r7  | ~1.2 km | operating region. Stored. |
| r8  | ~460 m  | **coverage unit.** One hydration = one r8 cell. |
| r9  | ~174 m  | **primary lookup.** Candidate retrieval + ring expansion. |
| r10 | ~65 m   | fine POI cell; brand lookups inside a mall/strip. |
| r11 | ~25 m   | stored, unused today. |

r8 is the coverage unit because a single provider nearby-request with a ~700 m
radius genuinely covers one r8 cell and nothing wider — so a hydration can
honestly mark exactly what it bought. r9 is the lookup unit because a `k=1`
disk is ~500 m across, which is what "near me" means to someone on a sidewalk.

**H3 is candidate geography only.** Cell adjacency is never treated as
distance. After retrieval every candidate gets a real haversine distance and
that is what "nearest" means.

## 5. Provider abstraction

```ts
interface PlacesProvider {
  readonly name: string;
  searchNearby(req: NearbyRequest): Promise<ProviderPlace[]>;
  searchText(req: TextRequest): Promise<ProviderPlace[]>;
  resolvePlace(providerPlaceId: string): Promise<ProviderPlace | null>;
}
```

`GooglePlacesProvider` (Places API New) and `MapboxProvider` (Search Box
category + forward) both implement it, and **both index into the same tables**.
Mapbox stays in the loop deliberately: when our own coverage is thin or Google
declines, Mapbox results still warm the index instead of evaporating. Coverage
rows are per-provider, so "Google covered this cell" and "Mapbox covered this
cell" are separate facts. Nothing Google-specific escapes the adapter — the
domain sees only `ProviderPlace`.

## 6. Taxonomy and normalization — deterministic, no LLM

Lime entity types: `retail_store grocery_store convenience_store pharmacy
restaurant cafe gas_station parking school university hospital hotel airport
transit_station government entertainment park address generic_place`.
Raw provider types are preserved verbatim in `provider_types`.

Name normalization strips store suffixes and location tails:
`"Target - Rosemead"`, `"Target Store #1234"` → `canonical_name "Target"`,
`normalized_name "target"`, `brand_key "target"`. Brand keys come from a
static alias table (`starbucks`, `711`→`7-eleven`, `mcdonalds`→`mcdonald's`).
Category aliases: `coffee→cafe`, `gas→gas_station`, `grocery→grocery_store`.
Table lookups and regex. No model call anywhere in this service.

## 7. Query flow — `findNearby`

```
findNearby({ latitude, longitude, query?, brandKey?, entityTypes?,
             maxDistanceMeters?, limit?, freshness? })

1. origin → r9 cell, and → r8 coverage cell
2. read local index over gridDisk(r9, k=0), widening k until enough
   candidates or k = kMax (bounded by maxDistanceMeters, hard cap k=4)
3. read coverage rows for the r8 cells the disk touches, for this
   query_family (brand_key, else sorted entity_types, else "all")
4. if candidates sufficient AND coverage fresh → return local, provider_called=false
5. else hydrate the uncovered/stale r8 cells — at most 3 provider requests
   per call — then re-read local
6. haversine every candidate, drop > maxDistanceMeters, rank, limit
```

The service knows nothing about Ride, Shop, Courier, Help or Driver. Those
products ask spatial questions and get places back.

**Ranking** (in order): exact brand match → exact normalized-name match →
entity-type relevance → true geographic distance → source freshness.

## 8. Hydration — one request, many cells warmed

A provider request centred on an r8 cell returns POIs scattered across
neighbouring cells. Every returned POI is indexed into **its own** r9/r10
hierarchy computed from its own lat/lng — never blindly filed under the query
cell. So one cold lookup warms a small neighbourhood of *places*.

Coverage, though, is only recorded for the r8 cell we actually centred on,
with the radius we actually used. Neighbours stay `unknown`. We index what we
learned; we claim only what we bought.

Empty results write `coverage_status = 'empty'` with a short TTL (6 h) so a
genuinely barren cell is not re-purchased on every keystroke. Successful
hydration writes `fresh` with a 30 d TTL.

## 9. Preventing redundant provider calls

- **local-first** — provider is only reached when local coverage fails.
- **single-flight, in-process** — a `Map<key, Promise>` keyed by
  `provider|query_family|h3_index|radius`. 50 concurrent callers, 1 fetch.
- **cross-instance lock** — `pg_try_advisory_xact_lock(hashtext(key))` around
  the hydrate transaction. A second Railway replica that loses the lock waits
  briefly and re-reads local rather than issuing its own request.
- **negative caching** — the `empty` TTL above.
- **bounded expansion** — k capped at 4, ≤3 provider requests per call.
- **rate limiting** — a token bucket per provider; over budget, the call
  degrades to whatever is local and says so in telemetry.

## 10. Google Maps Platform storage

- `provider_place_id` persists indefinitely — GMP permits durable place-id
  caching.
- Name, coordinates and types carry `fields_expire_at = now + 30 d`; past that
  the row is stale and re-resolved through `resolvePlace` before it is served
  as fresh.
- **Never stored:** photos, reviews, ratings, opening hours, phone numbers,
  editorial summaries. The field mask does not even request them.
- Attribution is the caller's responsibility; responses carry the source
  provider so the UI can attribute.
- All of this lives behind the adapter. The domain model has no Google column.

## 11. Telemetry

One structured line per query, `[spatial]` prefix, JSON body:
`h3_r9, h3_r8, resolution, query_type, local_hit, coverage_state,
provider_called, provider_requests, candidates, returned, latency_ms`.
That is enough to answer "what share of place searches are served without a
Google request?" by counting `provider_called=false` over total.

## 12. Integration with the driver and rider app

- `src/server/limecab/spatial.ts` — typed client, fails soft to `null`.
- `GET /api/map/nearby` — thin Next route over `findNearby`.
- Wired into the Shop tab's store list and the driver pit-stop list.
- `place-search.ts` NL search and `/api/map/places?q=` are **left alone** this
  pass; Mapbox remains the rider sheet's search path and is additionally
  registered as a provider so its results warm the index too.

## 13. Explicitly not built

No global crawler. No pre-population. No second map system. No product
semantics in the service. No LLM. No UI.
