# Parity packet — Driver / `online`

**Status:** VERIFIED on device 2026-09-02.

## Entry / exit
- **Entry:** `offline` → tap `Go online`.
- **Exit:** offer arrives (interrupt); or go off duty via the peek menu.

## Production references
- Screenshot: `online.web.png` (production web, 390×844, signed in as a registered driver)
- Native: `online.native.png`
- Source: `src/components/limecab/driver-surfaces.ts` (`IDLE`), `driver-app.tsx`
- Recipe: `IDLE` — *"the map is the app, the peek is a status line. The canvas takes gestures — a
  hunting driver looks around; only a live job hands the camera to the follow-cam."*

## Surfaces
| id | role | emphasis | interaction | presentation |
|---|---|---|---|---|
| map | background | **primary** | **active** | (posture `idle`) |
| primary | primary | primary | active | `peek` |
| offer | interrupt | hidden | inert | — |

## Map
Mode `coverage`. Camera centred on the driver. Dark ground with an H3 hexagon demand grid, cells
brighter where busier. Lime vehicle marker at centre. **Takes gestures** — this is the one duty
state where the canvas is the subject.

## Visible content
- Floating, over the canvas: home/exit (top-left), earnings pill `$0.00 ›` (top-centre, dark
  pill, lime numerals), shield (bottom-left), trends (bottom-right)
- Peek sheet: grabber → **centred** two-line status → preferences icon (left), menu icon (right)
  - line 1 `It's dinner time` — 17px semibold
  - line 2 `Check the map for busy areas` — 15px muted
- **No primary CTA.** This is the finding that mattered: the peek is a glanceable strip, not an
  action dock. Native had a full-width lime "Go offline" button here and it was wrong.

## Gestures / back / transition
Sheet drags the full ladder. Back while on duty and idle → host. Enter via `goOnline`, intent
`progress`.

## Native status
Matches. Icons are production's own (`SlidersHorizontal`, `Menu01`) drawn from the same path data.

## Known gaps
1. Map is the light graticule placeholder, not the dark H3 demand grid — **NATIVE RENDERER**.
2. Floating chrome (home / earnings pill / shield / trends) not implemented — **APP COMPOSITION**.
3. Peek leaves dead space below the status; production's is tighter — **NATIVE RENDERER (extent)**.
