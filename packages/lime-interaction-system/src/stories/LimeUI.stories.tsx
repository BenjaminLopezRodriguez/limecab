import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Button,
  ChoiceGlyph,
  ChoiceList,
  ChoiceRow,
  CompletionPanel,
  ConfirmActionSurface,
  Input,
  LimeThemeProvider,
  LiveSheetHeader,
  LocationTrigger,
  MapFloatingButton,
  MapRouteBar,
  PrimaryAction,
  ProgressBar,
  ProviderCard,
  QuotePanel,
  RouteRail,
  SecondaryAction,
  Separator,
  SurfaceSkeleton,
  limeTheme,
  spacing,
  radius,
  typography,
  type ColorScheme,
} from "@lime/ui";

/**
 * The whole kit on one surface, so the balance between the neutral foundation and the brand
 * accent can be judged at a glance rather than component by component. Toggle the scheme to
 * check that dark is its own ladder and not an inversion.
 */
const meta: Meta = { title: "Lime UI/Gallery" };
export default meta;

function Section({ title, colors: c, children }: { title: string; colors: typeof limeTheme.light; children: React.ReactNode }) {
  return (
    <section style={{ display: "grid", gap: spacing.sm }}>
      <h3
        style={{
          margin: 0,
          fontSize: typography.eyebrow.size,
          fontWeight: typography.eyebrow.weight,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: c.mutedForeground,
        }}
      >
        {title}
      </h3>
      <div
        style={{
          display: "grid",
          gap: spacing.md,
          padding: `${spacing.lg}px ${spacing.xl}px`,
          background: c.surface,
          border: `1px solid ${c.border}`,
          borderRadius: radius.sheet,
        }}
      >
        {children}
      </div>
    </section>
  );
}

function Gallery({ scheme, theme = limeTheme }: { scheme: ColorScheme; theme?: typeof limeTheme }) {
  const c = theme[scheme];
  return (
    <LimeThemeProvider theme={theme} scheme={scheme}>
      <div
        style={{
          background: c.background,
          padding: spacing.xxl,
          display: "grid",
          gap: spacing.xxl,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          alignItems: "start",
          fontFamily: "system-ui, -apple-system, sans-serif",
          minHeight: "100vh",
        }}
      >
        <Section title="Actions" colors={c}>
          <PrimaryAction label="Request Lime" />
          <SecondaryAction label="Add a stop" />
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            <Button label="Default" />
            <Button label="Secondary" variant="secondary" />
            <Button label="Outline" variant="outline" />
            <Button label="Ghost" variant="ghost" />
            <Button label="Cancel" variant="destructive" />
          </div>
        </Section>

        <Section title="Choice" colors={c}>
          <ChoiceList label="Ride class">
            <ChoiceRow glyph="◆" title="LimeGo" detail="3 min away" trailing="$18.40" selected />
            <ChoiceRow glyph="◈" title="Comfort" detail="5 min away" trailing="$24.10" />
            <ChoiceRow glyph="◉" title="XL" detail="Six seats · 8 min" trailing="$31.75" />
            <ChoiceRow glyph="◇" title="Pickup" detail="Unavailable here" disabled disabledReason="Not in this area" />
          </ChoiceList>
        </Section>

        <Section title="Fields" colors={c}>
          <LocationTrigger value="King's Cross" />
          <Input placeholder="Where to?" />
          <Input search placeholder="Search" value="Ontario" />
          <Input placeholder="Required" error="Enter a valid address" />
        </Section>

        <Section title="Route" colors={c}>
          <MapRouteBar origin="Ontario, CA" destination="Phoenix, AZ" onBack={() => {}} onEdit={() => {}} />
          <RouteRail
            stops={[
              { label: "Ontario, CA", detail: "Dock 14 · 08:00" },
              { label: "Blythe, CA", detail: "Fuel stop" },
              { label: "Phoenix, AZ", detail: "Dock 3 · 16:30" },
            ]}
          />
          <div style={{ display: "flex", gap: spacing.sm }}>
            <MapFloatingButton label="Recenter" active>
              ◎
            </MapFloatingButton>
            <MapFloatingButton label="Layers">▤</MapFloatingButton>
            <MapFloatingButton label="Safety">▲</MapFloatingButton>
          </div>
        </Section>

        <Section title="Live" colors={c}>
          <LiveSheetHeader eyebrow="Driver assigned" headline="Arriving in 4 min" supporting="Silver Prius · 2 stops" />
          <ProgressBar value={62} />
          <ProviderCard name="Rosa Alvarez" detail="Silver Toyota Prius" meta="4.9★" badge="8KJT402" live />
          <Separator />
          <div style={{ display: "flex", gap: spacing.md, alignItems: "center" }}>
            <ChoiceGlyph selected>◆</ChoiceGlyph>
            <ChoiceGlyph>◈</ChoiceGlyph>
          </div>
        </Section>

        <Section title="Money" colors={c}>
          <QuotePanel
            lines={[
              { label: "Linehaul", value: "$1,684.00" },
              { label: "Fuel surcharge", value: "$142.00" },
              { label: "Detention (est.)", value: "$14.00" },
            ]}
            total="$1,840.00"
            note="Demo data · not a real rate"
          />
          <Separator />
          <CompletionPanel
            headline="Trip complete"
            total="$18.40"
            lines={[
              { label: "Fare", value: "$16.20" },
              { label: "Tip", value: "$2.20" },
            ]}
          />
        </Section>

        <Section title="Transitions" colors={c}>
          <ConfirmActionSurface
            headline="Cancel this ride?"
            body="Rosa is 4 minutes away. A fee may apply."
            confirmLabel="Cancel ride"
            destructive
          />
          <Separator />
          <SurfaceSkeleton rows={4} />
        </Section>
      </div>
    </LimeThemeProvider>
  );
}

export const Light: StoryObj = { render: () => <Gallery scheme="light" /> };
export const Dark: StoryObj = { render: () => <Gallery scheme="dark" /> };

/** The coherence check: does the interface still hold up with every accent removed? */
const accentStripped = {
  light: { ...limeTheme.light, accent: limeTheme.light.foreground, accentForeground: limeTheme.light.background },
  dark: { ...limeTheme.dark, accent: limeTheme.dark.foreground, accentForeground: limeTheme.dark.background },
};

export const AccentRemoved: StoryObj = {
  name: "Light · accent removed",
  render: () => <Gallery scheme="light" theme={accentStripped} />,
};
