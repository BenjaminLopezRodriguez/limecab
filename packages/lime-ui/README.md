# @lime/ui

Portable, Lime-branded UI SDK. **React Native–first, web-renderable.**

It ships the visual tokens, atoms and presentation primitives that make an interface feel
like Lime, and nothing else. No maps, no routing, no auth, no server state, no domain types.
Every component takes labels, values and callbacks.

**The foundation is monochrome.** Warm neutrals, thin borders, modest elevation, typography
doing the hierarchy work. Lime is layered on top as the brand accent and spent deliberately —
on the dominant action, on selection, on live state, on where you are on a map. Strip every
accent out and what remains is still a coherent interface; put it back and the things that
matter are legible at a glance. That is the test the kit is designed to pass.

## Install

```sh
npx expo install @lime/ui
```

`react` and `react-native` are peers; an Expo app already has both.

Web-only consumers (a design lab, a marketing page) can skip `react-native` — the package
resolves a DOM adapter automatically.

## Use

```tsx
import { View } from "react-native";
import {
  Button,
  Input,
  ChoiceList,
  ChoiceRow,
  LocationTrigger,
  ProviderCard,
  QuotePanel,
  CompletionPanel,
  PrimaryAction,
  spacing,
} from "@lime/ui";

export default function Booking() {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("standard");

  return (
    <View style={{ padding: spacing.xl, gap: spacing.lg }}>
      <LocationTrigger value="King's Cross" onPress={openSearch} />

      <Input search placeholder="Search" value={query} onChangeText={setQuery} />

      <ChoiceList label="Service">
        <ChoiceRow
          glyph="◆"
          title="Standard"
          detail="4 min away"
          trailing="£14.20"
          selected={tier === "standard"}
          onSelect={() => setTier("standard")}
        />
        <ChoiceRow glyph="◈" title="Large" detail="7 min away" trailing="£19.80" onSelect={() => setTier("large")} />
      </ChoiceList>

      <QuotePanel lines={[{ label: "Fare", value: "£14.20" }]} total="£14.20" note="Price is fixed." />

      <PrimaryAction label="Confirm" onPress={book} />
    </View>
  );
}
```

That snippet has no dependency on any particular app, navigator or data layer. It is the
whole intended usage story.

## What's in it

**Tokens** — `limeTheme`, `createTheme`, `limeBrand`, `typography`, `spacing`, `spacingHalf`,
`gutter`, `radius`, `elevation`, `surface`, `scrim`. Also available on their own:
`import { limeTheme } from "@lime/ui/tokens"`.

Typography `letterSpacing` is authored in em; `typeStyle(typography.body)` converts it to the
absolute px React Native expects and returns a ready style object.

**Atoms** — `Button`, `Input`, `ProgressBar`, `Separator`, `IconGlyph`, `MapFloatingButton`.

**Primitives** — `ChoiceList` / `ChoiceRow` / `ChoiceGlyph`, `LocationTrigger`, `MapRouteBar`,
`RouteRail`, `LiveSheetHeader`, `ProviderCard`, `QuotePanel`, `CompletionPanel`,
`PrimaryAction`, `SecondaryAction`, `ConfirmActionSurface`, `SurfaceSkeleton`.

## Colour and theming

Components ask for semantic **roles**, never for a palette entry — `colors.accent`, never
`colors.lime`. That is what lets a theme be a neutral foundation plus a brand:

```
neutral foundation  +  brand accent  =  theme
```

| Role | |
|---|---|
| `background` | the furthest-back plane |
| `surface` / `surfaceElevated` | the planes content lives on |
| `foreground` | primary text, and the neutral dominant fill |
| `muted` / `mutedForeground` | quiet fills; secondary text |
| `border` / `input` | hairlines; the edge of an editable field |
| `accent` / `accentForeground` | the brand signal, and what sits on it |
| `destructive` / `destructiveForeground` | |

Every value is hex. React Native's colour parser accepts hex, `rgb()`/`rgba()` and `hsl()` and
returns `null` for everything else — an `oklch()` token typechecks, renders correctly in a
browser, and then silently drops the style prop on a device. The OKLCH originals are kept in
comments beside each value.

**Reading the theme.** No setup required: components follow the OS light/dark scheme against
the default Lime theme.

```tsx
import { useLimeColors } from "@lime/ui";

const c = useLimeColors();
<View style={{ backgroundColor: c.surface, borderColor: c.border }} />;
```

**Overriding it.** Wrap a tree only to force a scheme or swap the brand:

```tsx
import { LimeThemeProvider, createTheme } from "@lime/ui";

const ocean = createTheme({
  light: { accent: "#0B8FD4", accentForeground: "#FFFFFF" },
  dark: { accent: "#3FB6F0", accentForeground: "#00131F" },
});

<LimeThemeProvider theme={ocean} scheme="dark">
  <App />
</LimeThemeProvider>;
```

Dark is not an inversion — it has its own three-step elevation ladder, because on a dark ground
depth can only be read from value.

## How platforms are handled

Components are written against a small platform contract — `View`, `Text`, `Pressable`,
`TextInput`, plus `useColorScheme()` and `tabularNums` — and import it from `platform/adapter`:

| File | Picked by |
|---|---|
| `platform/native.tsx` | Metro, via `adapter.native.tsx` |
| `platform/web.tsx` | every other bundler, via `adapter.tsx` |

Nothing in `atoms/`, `primitives/`, `tokens/` or `style/` may import `react-native`, `react-dom`
or a DOM tag. `pnpm contract` asserts it, along with the two adapters exposing the same names.

Props are ARIA-flavoured (`role`, `aria-label`, `aria-checked`) because React Native ≥ 0.71
accepts those directly and maps them onto its accessibility layer — one spelling, both
platforms.

Styles are plain objects with RN-safe keys: no class names, no selectors, no `display: grid`,
and hover is never the only route to an action — both adapters give a pressed state. Shadows
are a single CSS `boxShadow` string, which React Native has understood since 0.76, so the
legacy `shadowOffset`/`elevation` split is gone.

**Icons are yours.** `IconGlyph` and `ChoiceGlyph` take any node, and render a string child as
text. The kit deliberately ships no icon library: `react-native-svg` is a native dependency and
would have to be installed in every consuming app.

## What it deliberately doesn't own

Sheets, scenes, surface managers, back-navigation resolvers, map semantics, workflow state,
fixtures, and anything whose props would have to name a Trip, a Quote or a Driver. Those
belong to the application composing this kit. If a component here starts needing to know what
kind of job is in flight, it has stopped being portable.

## Checks

```sh
pnpm typecheck   # includes the native adapter against real react-native types
pnpm contract    # no DOM, no forbidden imports, adapters in sync
```
