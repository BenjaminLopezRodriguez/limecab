# Parity packet — Rider / `destination selected`

**Status:** READY.

This is the *transition out* of `location_search`, not a separate screen. Selecting a result
performs `placeSelected` (intent `progress`):

| id | emphasis | interaction | presentation |
|---|---|---|---|
| map | background | passive | posture `route` |
| primary | primary | active | `sheet` |
| secondary | hidden | inert | — |

Observable behaviour: the search surface dismisses, the keyboard falls, the map draws the route
and reframes to `route_preview`, and the ride options rise over it. The workflow step advances
from `home` to `rideSelect` **only at this point** — opening search does not advance it.

Native already implements this correctly (verified on device 2026-09-02); it is documented here
so the search work does not regress it. See `search.md` for the surface it leaves.
