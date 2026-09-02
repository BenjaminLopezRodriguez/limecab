# Parity packet — Driver / `offline`

**Status:** VERIFIED on device 2026-09-02.

## Entry / exit
- **Entry:** `/driver` with a registered driver row; or `Go offline`.
- **Exit:** `Go online`.

## Production references
- Screenshot: `offline.web.png` · Native: `offline.native.png`
- Source: `src/components/limecab/driver-surfaces.ts` (`HOME`), `driver-app.tsx`
- Recipe: `HOME` — *"Off duty is a home, not a dimmer version of the dash. The driver is reading a
  document with a live map card in it, so `primary` is the page itself."*

## Surfaces
| id | role | emphasis | interaction | presentation |
|---|---|---|---|---|
| map | background | background | passive | (posture `idle`) |
| primary | primary | primary | active | **`launcher`** |
| offer | interrupt | hidden | inert | — |

`launcher` was added to the shared contract for this state — the surface *is* the page, with the
canvas reduced to a card inside it. Distinct from `fullscreen`, which still has a canvas behind.

## Map
Not a backdrop. Drawn as a **card inside the document**: ~250pt tall, `radius.card`, dark ground,
H3 hexagon grid, lime vehicle marker, Mapbox attribution, expand control top-right.

## Visible content
1. `You're offline` — display type
2. `Ready to go?` — 17px semibold
3. map card
4. `Opportunities` section header + chevron
5. `Earnings` eyebrow → `Earnings trends in Arcadia` row
6. **CTA** `Go online` — lime pill, full width, steering-wheel glyph
7. Top-right: shield + preferences. Bottom: 4-tab bar (Home / Trends / Earnings / Account).

## Gestures / back / transition
No sheet ladder — the page fills the screen. Back → host. Enter via `goOffline`, intent `collapse`.

## Native status
Structure matches: headline, subhead, map card, Opportunities, earnings row, lime CTA.

## Known gaps
1. Map card is the light graticule, not the dark H3 grid — **NATIVE RENDERER**.
2. Top-right shield/preferences missing — **APP COMPOSITION**.
3. Bottom tab bar missing — **`ShellIntent`**, deliberately deferred.
4. CTA has no steering-wheel glyph — **APP COMPOSITION** (icon is vendored and available).
