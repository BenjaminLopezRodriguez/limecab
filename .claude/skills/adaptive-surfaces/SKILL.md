---
name: adaptive-surfaces
description: Rules for progression vs. interruption, suspend/restore of parent surfaces, the mobile/desktop presentation ladder, and surface continuity in on-demand service applications.
---

# Adaptive Surfaces

Rules for every surface change in an on-demand service application. The primitives live in `components/service-app/adaptive-surface.tsx`.

## 1. Classify every surface change first

Two kinds exist. Classify before writing code.

**Progression** — the user's task advances to the next question. The chain moves forward.

**Interruption** — a temporary question *about* the task, after which the user returns to exactly where they were.

Decision test, applied literally: *after this surface closes, does the user continue from the same place they left?*
Yes -> interruption. No -> progression.

| Change | Kind |
|---|---|
| quote -> matching | progression |
| service_select -> configure | progression |
| "Cancel this request?" | interruption |
| "Choose a payment method" mid-configure | interruption |
| "Add a note for the provider" | interruption |
| matching -> assigned | progression |

API, non-negotiable:

```ts
// progression
surface.transition({
  intent: "progress",
  from: "quote",
  to: "matching",
  interim: "map",
  task: () => createRequest(),
});

// interruption
surface.transition({
  intent: "interrupt",
  surface: { id: "cancel", presentation: "compact-interrupt" },
});
surface.transition({ intent: "return" });
```

**Never** express an interruption as a progression to a new `ServiceAppState`. **Never** express a progression by opening an `AdaptiveSurface.Interrupt`.

## 2. Progression may replace; interruption must suspend

**Do** let a progression transform or fully replace the current surface. The prior scene's transient state is expected to go away; committed app data does not.

**Do** make every interruption suspend the parent surface and restore it on `return`.

**Never** unmount the parent scene to show an interruption. **Never** reset the parent's draft state.

```
BAD  interrupt -> parent unmounts -> return -> parent remounts empty,
     scroll at top, half-typed address gone

GOOD interrupt -> parent recedes (dim, lower z-order, still mounted)
     -> return -> parent restored byte-for-byte
```

## 3. Suspension / restoration checklist

Capture on interrupt, restore on return. Every item:

- [ ] `presentation` of the parent panel (`peek` | `sheet` | `expanded` | `overlay` | `fullscreen`)
- [ ] scroll position of the parent's scroll container
- [ ] the focused element, restored as the focus target on return
- [ ] in-progress text input values and caret/selection
- [ ] map camera (center, zoom, mode) — see rule 8

Check: type three characters into a field, open an interruption, dismiss it. All three characters, the caret, and the scroll offset are still there.

## 4. One call site, two presentations

`AdaptiveSurface.Interrupt` renders a bottom `Drawer` on mobile and a centered `Dialog` on desktop from a single call site.

**Do** write the interruption once and let the primitive choose.

**Never** fork business logic on viewport. Only presentation adapts.

```tsx
// BAD
if (isMobile) {
  const [step, setStep] = useState(0);      // separate state machine
  return <MobileCancelDrawer step={step} />;
}
return <DesktopCancelDialog />;

// GOOD
<AdaptiveSurface.Interrupt id="cancel" presentation="compact-interrupt">
  <CancelRequest onConfirm={onConfirm} onDismiss={onDismiss} />
</AdaptiveSurface.Interrupt>
```

`useAdaptiveSurface().isMobile` may be read for layout, spacing, and presentation. It may never gate a state transition, a network call, a validation rule, or a branch of the reducer.

Check: `grep` your feature for `isMobile`. Every hit must sit inside a className, a style value, or a `presentation` choice.

## 5. Surface continuity

Once a primary surface paradigm is established for a flow, stay in it.

**Never** let a mobile bottom-drawer workflow produce a centered dialog, and never let a desktop side-panel workflow produce a bottom sheet.

```
BAD  [bottom drawer: configure] -> tap "Cancel"
     -> centered modal drops from nowhere, drawer disappears

GOOD [bottom drawer: configure]
       -> drawer recedes (dims, drops z-order, stays mounted)
       -> compact interruption rises from the bottom edge
       -> dismissed, slides back down
       -> drawer restored: same height, scroll, focus, draft text
```

Check: record the flow. The parent surface never leaves the screen; it only dims and lowers.

## 6. Every progression has a defined back

**Do** define the reverse of each progression in `backServiceAppState`, and wire it to the system back gesture, the browser back button, and the scene's `exit` affordance — all three to the same function.

**Do** make back *revise*: returning to `service_select` from `configure` keeps the location and preselects the previously chosen service.

**Never** make back *clear*: it must not drop committed inputs, restart the flow, or land on `home` from mid-chain.

```
BAD  configure --back--> home, all inputs lost
GOOD configure --back--> service_select (location intact, service preselected)
```

Interruptions are exempt from the reducer: back during an interruption is `{ intent: "return" }`, never a state event.

## 7. Presentation ladder

`SurfacePresentation = "peek" | "sheet" | "expanded" | "overlay" | "fullscreen" | "compact-interrupt"`.

| Rung | Mobile | Desktop counterpart | Use when |
|---|---|---|---|
| `peek` | short bottom strip over a live canvas | floating side panel, canvas dominant | canvas is the subject; surface is a handle or status line |
| `sheet` | half-height bottom sheet, canvas visible above | expanded side panel | a short list or a few controls, spatial context still matters |
| `expanded` | tall sheet, canvas reduced to a band | task panel beside a reduced canvas | comparison, configuration, confirmation |
| `overlay` | same drawer snapped to the viewport | full-height task panel | listed sheets that opt in, or an explicit overlay presentation |
| `fullscreen` | full viewport, canvas hidden | full task panel / dedicated column | keyboard-first work: search, forms, long results |
| `compact-interrupt` | small drawer at the bottom edge, parent receding behind | compact centered modal | one temporary question about the current task |

Rules:

- **Do** move one rung at a time during progression. `peek -> fullscreen` in a single step is disallowed; go `peek -> sheet -> fullscreen` or pick the right starting rung.
- **Do** raise the rung when the user needs the keyboard, and lower it when the canvas becomes the subject again.
- **Do** keep rest rungs on the ladder (peek / sheet / expanded). Overlay is a snap of the same drawer, not a new scene and not the overflow destination. Taller work is a `TaskScene`. The sheet does not measure content and spring.
- **Never** use `fullscreen` for a yes/no question. **Never** use `peek` for confirmation or purchase.
- **Never** stack two `compact-interrupt` surfaces. Resolve or return the first.

Check `useAdaptiveSurface().stack`: at most one interrupt entry at any time.

## 8. The canvas stays mounted

The map/canvas (`components/service-app/service-map.tsx`) persists across every surface change. Only its bounding box and its `MapMode` change.

**Do** change mode and geometry:

```
home            -> bounded rounded region, mode "home"
location_search -> full canvas, mode "select_location"
quote           -> reduced band, mode "route_preview"
provider_en_route -> full canvas, mode "provider_arrival"
```

**Never** unmount, remount, or key-change the map between scenes. **Never** recreate the adapter per scene — remounting drops camera state, restarts tile/geometry work, and produces a visible flash the user reads as a page load.

Check: the map element's identity is stable across a full run of the chain.

## 9. Composition over conditionals

**Do** expose slots and callbacks from shared primitives: children, render props, `onConfirm`, `onDismiss`, `presentation`.

**Never** branch a shared primitive on product identity, tenant, vertical, or route name.

```tsx
// BAD — inside components/service-app/*
if (app === "courier") return <CourierHeader />;
if (vertical === "inspection") padding = 24;

// GOOD — the consumer composes
<AdaptiveSurface.Panel presentation="expanded" header={<CourierHeader />}>
  {children}
</AdaptiveSurface.Panel>
```

Check: no file under `components/service-app/` or `lib/service-app/` contains a product, brand, or vertical name.

## Merge checklist

- [ ] Every surface change is classified as progression or interruption, and uses the matching API.
- [ ] No interruption unmounts its parent.
- [ ] The five suspension items are captured and restored.
- [ ] `isMobile` appears only in presentation code.
- [ ] The flow stays in one spatial paradigm end to end.
- [ ] Every progression has a `backServiceAppState` entry that revises rather than clears.
- [ ] Presentation moves one rung at a time.
- [ ] The map is mounted once for the session.

---

## One surface, or several

Everything above is about a single surface changing rung. When *one action moves
several surfaces at once* — the sheet leaves, the map expands and turns
interactive, a confirm strip appears — stop writing setters and read
`surface-orchestration`.

The split: SurfaceManager decides that the primary surface should become
`expanded` and that the map should become `interactive`. This skill's ladder
decides what `expanded` means at this width. Do not merge them, and never write
`if (mobile) openDrawer() else openSidePanel()` — the action stays semantic and
the surface resolves it.

Suspended and hidden surfaces must be `inert`. A dimmed sheet that still takes
clicks is the same bug as a hidden sheet that still traps focus.
