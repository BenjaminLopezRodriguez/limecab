import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  DriverOfflineScene, DriverOfferScene, DriverJobScene,
  DriverEarningsDetailScene, DriverRestStopsScene, DriverTabBar,
} from "../web/scenes/driver-scenes.tsx";
import { DRIVER_OFFER, EARNINGS_TRIP } from "../fixtures/driver.ts";
import { sheetFrame } from "../web/styles.ts";

const meta: Meta = { title: "Driver", parameters: { layout: "centered" } };
export default meta;

const Frame = ({ children }: { children: React.ReactNode }) => <div style={sheetFrame()}>{children}</div>;

const TABS = ["Home", "Earnings", "Account"] as const;

export const Tabs: StoryObj = {
  render: () => <div style={{ width: 390 }}><DriverTabBar active="Home" tabs={TABS} /></div>,
};

export const Offline: StoryObj = {
  render: () => <Frame><DriverOfflineScene onGoOnline={() => {}} /></Frame>,
};

export const Offer: StoryObj = {
  render: () => <Frame><DriverOfferScene offer={DRIVER_OFFER} onAccept={() => {}} onDecline={() => {}} /></Frame>,
};

export const EnRoute: StoryObj = {
  name: "Job · en route to pickup",
  render: () => (
    <Frame>
      <DriverJobScene state="to_pickup" offer={DRIVER_OFFER} riderName="Alex Chen"
        meetingPoint="Curbside" pinRequired onAdvance={() => {}} />
    </Frame>
  ),
};

export const AtPickup: StoryObj = {
  name: "Job · at pickup",
  render: () => (
    <Frame>
      <DriverJobScene state="at_pickup" offer={DRIVER_OFFER} riderName="Alex Chen" pinRequired />
    </Frame>
  ),
};

export const OnTrip: StoryObj = {
  name: "Job · on trip",
  render: () => (
    <Frame>
      <DriverJobScene state="on_trip" offer={DRIVER_OFFER} riderName="Alex Chen" />
    </Frame>
  ),
};

export const EarningsDetail: StoryObj = {
  render: () => <Frame><DriverEarningsDetailScene trip={EARNINGS_TRIP} /></Frame>,
};

export const RestStops: StoryObj = {
  render: () => <Frame><DriverRestStopsScene /></Frame>,
};

export const OfflineDesktop: StoryObj = {
  name: "Offline · desktop",
  parameters: { viewport: { defaultViewport: "desktop" } },
  render: () => (
    <div style={{ ...sheetFrame(480), padding: 32 }}>
      <DriverOfflineScene />
    </div>
  ),
};
