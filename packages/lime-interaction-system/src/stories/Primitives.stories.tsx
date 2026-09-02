import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ChoiceList, ChoiceRow, LocationTrigger, MapRouteBar, RouteRail, LiveSheetHeader,
  ProviderCard, QuotePanel, CompletionPanel, PrimaryAction, SecondaryAction,
  ConfirmActionSurface, SurfaceSkeleton,
} from "../web/primitives.tsx";
import { color, radius, spacing } from "../tokens/index.ts";

const meta: Meta = { title: "Primitives", parameters: { layout: "centered" } };
export default meta;

/** Sheet-width frame — primitives are authored full-bleed to the sheet gutter. */
const Sheet = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 390, background: color.panel.light, borderRadius: radius.sheet,
    border: `1px solid ${color.border.light}`, padding: `${spacing.lg}px ${spacing.xl}px`,
    fontFamily: "system-ui" }}>{children}</div>
);

export const Decision: StoryObj = {
  name: "ChoiceList · decision",
  render: function R() {
    const [picked, setPicked] = useState("comfort");
    return (
      <Sheet>
        <ChoiceList label="Ride class">
          <ChoiceRow glyph="🚗" title="LimeGo" detail="3 min away" trailing="$18.40"
            selected={picked === "go"} onSelect={() => setPicked("go")} />
          <ChoiceRow glyph="🚙" title="Comfort" detail="5 min away" trailing="$24.10"
            selected={picked === "comfort"} onSelect={() => setPicked("comfort")} />
          <ChoiceRow glyph="🚐" title="XL" detail="Six seats · 8 min" trailing="$31.75"
            selected={picked === "xl"} onSelect={() => setPicked("xl")} />
          <ChoiceRow glyph="🛻" title="Pickup" detail="Unavailable in this area"
            disabled disabledReason="Not available here" />
        </ChoiceList>
      </Sheet>
    );
  },
};

export const Composer: StoryObj = {
  name: "LocationTrigger · composer",
  render: () => (
    <Sheet>
      <div style={{ display: "grid", gap: spacing.sm }}>
        <LocationTrigger value="Ontario, CA" />
        <LocationTrigger placeholder="Where to?" />
      </div>
    </Sheet>
  ),
};

export const Route: StoryObj = {
  render: () => (
    <div style={{ display: "grid", gap: spacing.xl, width: 390, fontFamily: "system-ui" }}>
      <MapRouteBar origin="Ontario, CA" destination="Phoenix, AZ" onBack={() => {}} onEdit={() => {}} />
      <Sheet>
        <RouteRail stops={[
          { label: "Ontario, CA", detail: "Dock 14 · 08:00" },
          { label: "Blythe, CA", detail: "Fuel stop" },
          { label: "Phoenix, AZ", detail: "Dock 3 · 16:30" },
        ]} />
      </Sheet>
    </div>
  ),
};

export const Status: StoryObj = {
  render: () => (
    <Sheet>
      <LiveSheetHeader eyebrow="Driver assigned" headline="Arriving in 4 min"
        supporting="Silver Prius · 2 stops" />
      <ProviderCard name="Rosa Alvarez" detail="Silver Toyota Prius" badge="8KJT402" meta="4.9★" />
    </Sheet>
  ),
};

export const Quote: StoryObj = {
  render: () => (
    <Sheet>
      <QuotePanel
        lines={[
          { label: "Linehaul", value: "$1,684.00" },
          { label: "Fuel surcharge", value: "$142.00" },
          { label: "Detention (est.)", value: "$14.00" },
        ]}
        total="$1,840.00"
        note="Demo data · not a real rate"
      />
    </Sheet>
  ),
};

export const Completion: StoryObj = {
  render: () => (
    <Sheet>
      <CompletionPanel headline="Delivered" total="$1,840.00"
        lines={[
          { label: "795 mi", value: "12h 04m" },
          { label: "Settles", value: "in 3 days" },
        ]} />
    </Sheet>
  ),
};

export const Confirmation: StoryObj = {
  render: () => (
    <Sheet>
      <ConfirmActionSurface destructive headline="Cancel this load?"
        body="The shipper is notified and the lane returns to the board."
        confirmLabel="Cancel load" />
    </Sheet>
  ),
};

export const Actions: StoryObj = {
  render: () => (
    <Sheet>
      <div style={{ display: "grid", gap: spacing.sm }}>
        <PrimaryAction label="Request Lime" />
        <PrimaryAction label="Requesting" loading />
        <PrimaryAction label="Confirm pickup" disabled />
        <PrimaryAction label="Cancel load" destructive />
        <SecondaryAction label="Add a stop" />
      </div>
    </Sheet>
  ),
};

export const Loading: StoryObj = {
  name: "SurfaceSkeleton · perceived performance",
  render: () => <Sheet><SurfaceSkeleton rows={4} /></Sheet>,
};
