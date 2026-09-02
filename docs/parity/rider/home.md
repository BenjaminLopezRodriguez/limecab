# Parity packet — Rider / `home`

**Status:** READY. Reference captured from production web 2026-09-02, 390×844, signed in.

## Entry / exit
- **Entry:** app launch; `leaveTask` from a draft; `minimizeRide` from live work.
- **Exit:** tap the search pill → `openDestinationSearch` (intent `expand`); tap the map card →
  `chooseOnMap` (intent `expand`); mic → `openVoiceBooking`.

## Production references
- Screenshot: `home.web.png` · Native today: none captured this cluster
- Source: `limecab-home-scene.tsx`, `service-app-shell.tsx:133,185`, `surfaces.ts:382`
- Written reference with exact values: `docs/specs/rider-ride-production-reference.md` → `home`

## Surfaces
| id | role | emphasis | interaction | presentation |
|---|---|---|---|---|
| map | background | background | passive | posture `bounded` |
| primary | primary | primary | active | `sheet` |
| secondary, interrupt | — | hidden | inert | — |

**Critical:** the recipe says `sheet`, but on mobile the shell renders home as a **page** — the
primary content sits on the same page as the map card, not as drawer chrome
(`service-app-shell.tsx:133`). Visually this is our `launcher`, the same composition as driver
off-duty. Do not render rider home as a bottom sheet.

## Map
Mode `home`, zoom 14, centred on resolved pickup. Drawn as an inset **card**:
`h-[min(34dvh,20rem)]`, wrapper `p-4 pb-2`, card `rounded-3xl`, dark ground, `Current location`
chip top-left, Mapbox attribution and info control bottom. Tapping the card adjusts pickup.

## Visible content, top to bottom
1. `Hello, (424) 242-4242` — greeting; phone number in **accent**
2. Vertical tab row — `Ride` (active, underlined) · Reserve · Courier · Help · Shop · Assist ·
   Freight · Spaces · Station — **nine**, re-observed 2026-09-01; horizontally scrollable. **Only `Ride` is in scope** — render the row, do not
   implement the other verticals.
3. Map card (above)
4. Search pill — `Where to?`, `h-14`, muted fill, magnifier leading, **mic trailing**
5. `Ride, send, or get` — tagline, `text-xs` muted
6. `Save Home and Work for faster pickup` — link, only when zero saved places
7. `I'm traveling` — toggle, `role="switch"`, left-aligned, `text-sm`
8. Bottom tab bar — Home / Services / Activity / Profile

Empty saved/recent renders **nothing** — that is the empty state. This account has none.

## Typography / spacing
Trigger `text-[17px] font-semibold tracking-tight`; tagline `text-xs`; row title
`text-[15px] font-medium tracking-tight`; link and toggle `text-sm`. Scene `gap-4`; launcher
`px-5 pt-3`; trigger `h-14 gap-3`.

## CTA / back / gestures
No `PrimaryAction` button — the search pill *is* the affordance. Back is a deliberate **no-op**
(`consume`). No sheet ladder: the page fills the screen.

## Known gaps in native
1. Native renders home as a `sheet` with a `LocationTrigger` + saved-places list. Production is a
   page with greeting, vertical tabs, map card, tagline, link and toggle — **SCENE + RECIPE**.
2. No greeting, no vertical tab row, no tagline, no traveling toggle, no tab bar — **SCENE**.
3. Map is not drawn as a card at home — **SCENE** (the `launcher` card pattern already exists in
   the driver scene; reuse it).

## Reusable components already available
`LocationTrigger` (has `start`/`end` slots for the mic), `Switch`, `ChoiceSection`/`ChoiceRow`,
`LiveSheetHeader`, `NativeMap` (with `showMode={false}` for card use), vendored production icons.
