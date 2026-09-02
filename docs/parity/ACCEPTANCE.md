# Acceptance protocol

Static review is not acceptance. A cluster passes static review and is still unverified.
This file exists because Rider Cluster A was marked accepted on a code diff, and a later
screenshot comparison found real composition defects the diff could not show.

## Status ladder

Every cluster in `WORK-QUEUE.md` carries exactly one of these.

| status | meaning |
|---|---|
| `CODEX IMPLEMENTED` | worker returned; nothing checked |
| `CLAUDE STATIC REVIEWED` | typecheck, tests, contract, allowed-file audit, diff read |
| `READY FOR IOS` | static review passed; no visual comparison has happened |
| `IOS VISUALLY VERIFIED` | a real native screenshot was compared to its production reference |
| `DONE` | visually verified and every finding either fixed or explicitly accepted |

**A visually significant state may not be marked `DONE` before a native screenshot has been
compared to its production reference.** Code equivalence is not visual parity.

## Visual acceptance checklist

Run against a native screenshot and its production reference, side by side, before classifying
anything as MINOR or MAJOR.

- [ ] shell / chrome — is anything dev-only visible?
- [ ] content hierarchy
- [ ] major sections — is any section missing entirely?
- [ ] map extent — as a proportion of the viewport, not in points
- [ ] surface extent
- [ ] navigation
- [ ] CTA — presence, ground colour, label
- [ ] state-dependent overlays
- [ ] visible copy
- [ ] selected state
- [ ] major typography hierarchy
- [ ] safe-area composition

## Control your variables first

Before comparing, confirm both artifacts represent the **same canonical state**. Two failures
have already come from not doing this:

1. A native screenshot predating the implementation under review.
2. A production screenshot taken after a test ride, so it carried an active-trip pill and a
   populated recents list that the native fixture had no reason to show.

Never compare unlike states. If production cannot be reset locally, capture the extra state as a
**separate** reference rather than folding it into the base state's packet.

## Canonical Rider Home state

Both sides must represent exactly this:

| variable | canonical value |
|---|---|
| signed-in identity | `(424) 242-4242` |
| current location | `Current location` (not a pinned place) |
| recent locations | **none** |
| active trip | **none** |
| service tabs | all nine, `Ride` active |
| traveling | off |

An active trip on Home is a real production state, but it is an **overlay on** Home, not part of
it. It gets its own packet when it is reachable.
