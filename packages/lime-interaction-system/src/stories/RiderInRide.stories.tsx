import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  InRideSpatialScene, InRideCardStackScene,
  RideDetailsScene, DriverDetailsScene, SafetyScene, RiderActivityScene,
} from "../web/scenes/rider-in-ride.tsx";
import { envFromGlobals } from "../storybook/decorators.tsx";
import { rideDark } from "../web/ride-cards.tsx";

const meta: Meta = {
  title: "Rider/In ride",
  parameters: {
    layout: "centered",
    backgrounds: { default: "ride-dark", values: [{ name: "ride-dark", value: rideDark.canvas }] },
  },
};
export default meta;

/** Full spatial scene — map + card stack + working interrupts. Tap ⋮ on trip card, ⋮ on tip card, or Safety. */
export const Spatial: StoryObj = {
  name: "In ride · spatial (tap Safety / ⋮)",
  render: function R(_args, { globals }) {
    return <InRideSpatialScene env={envFromGlobals(globals)} />;
  },
};

export const CardStack: StoryObj = {
  name: "In ride · card stack",
  render: function R() {
    return <InRideCardStackScene />;
  },
};

export const RideDetails: StoryObj = {
  name: "Interrupt · ride details",
  render: () => <RideDetailsScene />,
};

export const DriverDetails: StoryObj = {
  name: "Interrupt · driver details",
  render: () => <DriverDetailsScene />,
};

export const Safety: StoryObj = {
  name: "Interrupt · safety",
  render: () => <SafetyScene />,
};

export const Activity: StoryObj = {
  name: "Activity · ongoing + past",
  parameters: { layout: "fullscreen" },
  render: () => <RiderActivityScene />,
};

export const FontScale150: StoryObj = {
  name: "In ride · fontScale 1.5",
  parameters: { globals: { fontScale: 1.5 } },
  render: function R(_args, { globals }) {
    return <InRideSpatialScene env={envFromGlobals(globals)} />;
  },
};
