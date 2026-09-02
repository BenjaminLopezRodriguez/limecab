# Queued — Rider A+B combined visual refinement

**Do not dispatch until the Rider B worker returns.** This is one combined pass, per the
operating model: a failed acceptance generates another Codex cycle, not a Claude takeover.

## PROVENANCE OF THESE FINDINGS
Native artifact: `docs/parity/reference/native/rider/home.png` — iPhone 17 Pro, iOS 26.5,
captured 2026-09-01 from commit `967e650`, i.e. **after** Cluster A landed.
Production reference: `docs/parity/reference/web/rider/home.png` — 390×844, clean home.
Both represent the canonical Rider Home state defined in `../ACCEPTANCE.md`.

---

## BLOCKER

**1. The keyboard opens on Rider Home.**
Native artifact: `docs/parity/reference/native/rider/home-keyboard-defect.png`. On entering
Rider, the software keyboard is up and covers everything below the map card. Production Home has
no text entry at all.

Root cause, already traced — do not re-investigate:
`NativeSceneRenderer.tsx` assigns `hidden` a depth of `0` but **never filters it out**, so a
hidden surface is still mounted. The search surface's `autoFocus` (`native/scenes/search.tsx:139`)
therefore fires while the surface is hidden.

**Claude's architectural decision (this is the fix to implement):** `hidden` must not mount.
`suspended` must continue to mount — that distinction is the whole reason both exist, and the
driver offer depends on `suspended` holding an untouched peek behind it. The renderer currently
collapses the two. This is not a contract change; it is the renderer honouring a distinction the
contract already makes.

Implement: skip rendering surfaces whose emphasis is `hidden`, and add a test asserting that a
hidden surface does not mount while a suspended one does.

---

## MAJOR

**2. Service tab strip is short.** Native shows six (`Ride Reserve Courier Help Shop Assist`).
Production shows nine — `Freight`, `Spaces`, `Station` follow, with the strip horizontally
scrollable and visibly cut off at the right edge to signal more. Add the three, and make sure the
strip scrolls and clips rather than fitting.
Labels only; the scope rule against porting those experiences still stands.

**3. Map card is too tall, so the page is not dense enough.** Production's card is ~30% of the
viewport; native's is ~39%. The knock-on is that native's bottom nav sits jammed against
`I'm traveling` with no breathing room, while production has clear space below it. Bring the card
down to production's proportion and let the page below breathe.
Match the **proportion**, not a point value — the reference is 390×844 and the device is not.

**4. `Back` / `System` dev chrome is visible in the normal route.**
Ownership: **APP COMPOSITION**, not a shell architecture problem. `apps/lime-native/src/DevBar.tsx`
is explicitly scaffolding ("clearly marked as scaffolding rather than product chrome"), it is just
not gated. Gate it so it is absent by default and every parity screenshot is clean. A dev flag or
an explicit prop on the parity/gallery routes is fine — your call, keep it bounded.

---

## MINOR

**5. `I'm traveling` composition.** Native puts the switch immediately after the label. Production
reads as a full-width row with the control at the trailing edge.

**6. Search pill is slightly taller and rounder** than production's.

**7.** The three label mismatches already listed at the bottom of `rider-cluster-b.md`.

---

## NOT DEFECTS — do not "fix" these

Four items were raised from a production screenshot that had been polluted by a test ride, and one
from a native screenshot that predated Cluster A. They are resolved here so no one spends a cycle
on them:

- **Greeting missing** — it is present and correct, accent phone and all. That reading came from a
  pre-Cluster-A native screenshot.
- **`Pinned location` instead of `Current location`** — `Current location` is *correct* for canonical
  Home. `Pinned location` only appeared because a test ride had set one.
- **`RECENT` section missing** — canonical Home has no recents. The production capture had them
  because of the same test ride.
- **`On the way · White Kia · 6PLT884` pill missing** — that is an active-trip overlay on Home, not
  part of Home. It gets its own packet when a dispatch is reachable.
- **Map shows a black point, not a lime vehicle** — the light graticule and its markers are the
  known standing renderer gap, tracked in every map-bearing packet. Out of scope for this pass.

---

## VALIDATION
Same commands and baselines as `rider-cluster-b.md`. The renderer change in finding 1 must not
reduce the test count — add to it.

## STOP CONDITIONS
- If skipping `hidden` surfaces breaks any existing scenario, **stop and report** — that would mean
  something depends on hidden-but-mounted, which is worth knowing before it is papered over.
