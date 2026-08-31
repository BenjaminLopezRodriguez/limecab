import type { Meta, StoryObj } from "@storybook/react-vite";
import { ServiceStatusPanel, TripPill, VoiceBanner } from "../web/status.tsx";
import { SurfaceSkeleton } from "../web/primitives.tsx";
import { DRIVER, TRIP_MILESTONES } from "../fixtures/rider.ts";
import { sheetFrame } from "../web/styles.ts";

const meta: Meta = { title: "Status", parameters: { layout: "centered" } };
export default meta;

const Frame = ({ children }: { children: React.ReactNode }) => <div style={sheetFrame()}>{children}</div>;

export const Matching: StoryObj = {
  render: () => (
    <Frame>
      <ServiceStatusPanel eyebrow="Finding a driver" headline="Matching your ride"
        supporting="Ontario, CA → Downtown LA" progress={{ value: 35 }} />
    </Frame>
  ),
};

export const DriverAssigned: StoryObj = {
  render: () => (
    <Frame>
      <ServiceStatusPanel eyebrow="Driver assigned" headline="Arriving in 4 min"
        eta={{ label: "ETA", value: "4 min", hero: true }}
        milestones={TRIP_MILESTONES} milestoneIndex={2} provider={DRIVER} />
    </Frame>
  ),
};

export const InRide: StoryObj = {
  render: () => (
    <Frame>
      <ServiceStatusPanel eyebrow="On trip" headline="En route to destination"
        eta={{ label: "ETA", value: "12 min", hero: true }}
        progress={{ value: 55, completedSteps: 3, totalSteps: 5 }}
        provider={DRIVER} />
    </Frame>
  ),
};

export const TripPillStory: StoryObj = {
  name: "TripPill · minimized",
  render: () => <TripPill status="Driver arriving" eta="4 min" />,
};

export const Voice: StoryObj = {
  render: () => (
    <Frame>
      <div style={{ display: "grid", gap: 12 }}>
        <VoiceBanner state="idle" />
        <VoiceBanner state="listening" />
        <VoiceBanner state="processing" />
      </div>
    </Frame>
  ),
};

export const Loading: StoryObj = {
  render: () => <Frame><SurfaceSkeleton rows={4} label="Loading ride options" /></Frame>,
};

export const FontScale150: StoryObj = {
  name: "Status · fontScale 1.5",
  parameters: { globals: { fontScale: 1.5 } },
  render: () => (
    <Frame>
      <ServiceStatusPanel eyebrow="Driver assigned" headline="Arriving in 4 min"
        eta={{ label: "ETA", value: "4 min", hero: true }} provider={DRIVER} />
    </Frame>
  ),
};
