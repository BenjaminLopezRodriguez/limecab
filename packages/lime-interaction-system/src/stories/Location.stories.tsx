import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { LocationSearch, LocationSearchScene, LocationPinScene, PickupPointPicker } from "../web/location.tsx";
import { sheetFrame } from "../web/styles.ts";
import { PICKUP_SPOTS } from "../fixtures/rider.ts";

const meta: Meta = { title: "Location", parameters: { layout: "centered" } };
export default meta;

const Frame = ({ children }: { children: React.ReactNode }) => <div style={sheetFrame()}>{children}</div>;

const RESULTS = [
  { id: "1", title: "Ontario, CA", subtitle: "San Bernardino County" },
  { id: "2", title: "Ontario International Airport", subtitle: "ONT" },
  { id: "3", title: "Ontario Mills", subtitle: "1 Mills Cir" },
];

export const SearchEmpty: StoryObj = {
  render: () => <Frame><LocationSearch results={[]} placeholder="Where to?" /></Frame>,
};

export const SearchTyping: StoryObj = {
  render: () => <Frame><LocationSearch query="Ont" results={RESULTS} /></Frame>,
};

export const SearchLoading: StoryObj = {
  render: () => <Frame><LocationSearch query="Ontario" results={[]} loading /></Frame>,
};

export const SearchNoResults: StoryObj = {
  render: () => <Frame><LocationSearch query="xyznone" results={[]} /></Frame>,
};

export const SearchError: StoryObj = {
  render: () => (
    <Frame>
      <LocationSearch query="Ont" results={[]} error="Search unavailable" />
    </Frame>
  ),
};

export const SearchScene: StoryObj = {
  render: () => (
    <Frame>
      <LocationSearchScene title="Where to?" query="Ont" results={RESULTS}
        route={{ origin: "Current location", destination: "—" }}
        onDismiss={() => {}} onChooseOnMap={() => {}} />
    </Frame>
  ),
};

export const SearchSceneKeyboard: StoryObj = {
  name: "Search · keyboard visible",
  parameters: { globals: { keyboardVisible: true } },
  render: () => (
    <Frame>
      <LocationSearchScene query="Downtown" results={RESULTS.slice(0, 2)} />
    </Frame>
  ),
};

export const PinConfirm: StoryObj = {
  render: () => (
    <Frame>
      <LocationPinScene title="Confirm pickup" address="1247 Maple Ave, Ontario, CA" onConfirm={() => {}} />
    </Frame>
  ),
};

export const PickupPoints: StoryObj = {
  render: function R() {
    const [id, setId] = useState("curb");
    return <Frame><PickupPointPicker spots={PICKUP_SPOTS} selectedId={id} onSelect={setId} /></Frame>;
  },
};
