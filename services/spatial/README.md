# lime-spatial-index

A place index that only knows the parts of the Earth a Lime user has made us
look at. H3 addresses the whole planet; Postgres stores a heat map of Lime's
actual footprint, not a POI dump — Rosemead is warm because someone stood in
Rosemead, and Tokyo has zero rows.

## How it works

- **Active cells.** A lookup resolves to an r9 cell (candidate retrieval, ring
  expansion capped at k=4) inside an r8 cell (the coverage unit — one ~700 m
  provider request honestly covers one r8 cell and nothing wider).
- **Local first.** Candidates come from Postgres. A provider is reached only
  when coverage for *this question* in *this cell* is missing or expired, at
  most 3 requests per call.
- **Lazy hydration.** One provider request warms a neighbourhood: every POI it
  returns is filed under its own r9/r10 cells, computed from its own lat/lng.
  Coverage, though, is claimed only for the cell we centred on — we index what
  we learned, we claim only what we bought. `fresh` lives 30 d, `empty` 6 h.
- **H3 is candidate geography only.** Adjacency is never distance; every result
  carries a haversine distance and that is what "nearest" means.
- **Providers are sources, not the ontology.** Google and Mapbox write into the
  same tables under Lime's own ids; `place_source` holds their ids. Coverage
  rows are per-provider, so their claims never borrow each other's.
- **No crawler, no pre-population, no LLM, no product semantics.** The service
  does not know what Ride, Shop or Driver mean.

`src/contract.ts` is the frozen wire contract. `ARCHITECTURE.md` is the long form.

## Run

```
pnpm install
cp .env.example .env        # fill in DATABASE_URL and SPATIAL_API_KEY
pnpm start                  # migrations apply at boot
pnpm test                   # DB-backed tests skip without DATABASE_URL
pnpm typecheck
```

## Env

| var | why |
|-----|-----|
| `DATABASE_URL` | Postgres. Required; migrations run at boot. |
| `SPATIAL_API_KEY` | Every route but `/health` needs it in `X-Lime-Spatial-Key`. |
| `GOOGLE_PLACES_API_KEY` | Optional. Missing → the Google adapter returns nothing. |
| `MAPBOX_TOKEN` | Optional. Missing → the Mapbox adapter returns nothing. |
| `PORT` | Default 8080. |
| `SPATIAL_PROVIDER_RPS` | Optional token-bucket budget per provider, default 5/s. |

## HTTP

```
GET  /health                   -> { ok: true }
POST /v1/nearby                -> FindNearbyResult
GET  /v1/places/:id            -> { place } | 404
GET  /v1/coverage?lat=&lng=    -> { cells }
```

## Telemetry

One `[spatial]` JSON line per query. Counting `provider_called=false` over the
total answers the only question that matters here: what share of place searches
we served without paying a provider.

## Provider credentials

Both providers currently fail server-to-server with the keys carried over from
the main app. The service degrades correctly — it logs, caches the empty
result, and returns `[]` — so this shows up as an index that never warms
rather than as an outage. Both fixes are console-side and neither is a code
change.

### Google — `403 API_KEY_HTTP_REFERRER_BLOCKED`

The key in `GOOGLE_PLACES_API_KEY` is restricted to HTTP referrers, i.e. it is
a browser key. A server has no referer, so every call is refused:

```
"reason": "API_KEY_HTTP_REFERRER_BLOCKED",
"metadata": { "httpReferrer": "<empty>" }
```

Fix: in Google Cloud Console → Credentials, create a **second** key for server
use with either no application restriction or an IP restriction, and grant it
the Places API (New). Do not loosen the existing browser key — it is correctly
locked down for the client.

Verify before redeploying:

```sh
curl -s -X POST 'https://places.googleapis.com/v1/places:searchNearby' \
  -H "X-Goog-Api-Key: $GOOGLE_PLACES_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'X-Goog-FieldMask: places.id,places.displayName,places.location,places.types' \
  -d '{"includedTypes":["department_store"],"maxResultCount":5,
       "locationRestriction":{"circle":{"center":{"latitude":34.0806,
       "longitude":-118.0728},"radius":700}}}'
```

Expect a `places` array. A 403 means the restriction is still in place.

### Mapbox — `403 Forbidden` on Search Box

`MAPBOX_TOKEN` lacks the Search Box scope. The main app already knows this —
`src/app/api/map/category/route.ts` has a dedicated 403 branch saying so — but
there it degrades to fixtures, which is why it has gone unnoticed.

Fix: in the Mapbox account page, enable the Search Box API on the token (or
issue a new token with it) and update `MAPBOX_TOKEN` in both Railway and
Vercel.

Verify:

```sh
curl -s "https://api.mapbox.com/search/searchbox/v1/category/coffee\
?access_token=$MAPBOX_TOKEN&proximity=-118.0728,34.0806&limit=3&country=US"
```

Expect a `features` array, not `{"message":"Forbidden"}`.

### After fixing either one

Update the variable and redeploy, then clear the negative coverage the failed
attempts cached — otherwise the 6h `empty` TTL keeps suppressing lookups in
cells you already tried:

```sh
railway variables --service spatial-index --set "GOOGLE_PLACES_API_KEY=..."
railway up ./services/spatial --path-as-root --service spatial-index --detach
# then, against the service database:
DELETE FROM cell_coverage WHERE coverage_status = 'empty';
```
