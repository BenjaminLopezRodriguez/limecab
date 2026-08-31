import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ServiceGrid, SavedPlaces, ConfigureScene, EmptyState, ErrorState } from "../web/lists.tsx";
import { SERVICE_TILES, SAVED_PLACES, RECENT_PLACES } from "../fixtures/rider.ts";
import { sheetFrame } from "../web/styles.ts";
import { spacing } from "../tokens/index.ts";

const meta: Meta = { title: "Lists & Choices", parameters: { layout: "centered" } };
export default meta;

const Frame = ({ children, width = 390 }: { children: React.ReactNode; width?: number }) => (
  <div style={sheetFrame(width)}>{children}</div>
);

export const ServiceGridStory: StoryObj = {
  name: "ServiceGrid · launcher",
  render: () => <Frame><ServiceGrid services={SERVICE_TILES} onSelect={() => {}} /></Frame>,
};

export const ServiceGridList: StoryObj = {
  name: "ServiceGrid · dense list",
  render: () => <Frame><ServiceGrid services={SERVICE_TILES} variant="list" onSelect={() => {}} /></Frame>,
};

export const ServiceGridDesktop: StoryObj = {
  name: "ServiceGrid · desktop 3-col",
  parameters: { viewport: { defaultViewport: "desktop" } },
  render: () => <Frame width={640}><ServiceGrid services={SERVICE_TILES} columns={3} onSelect={() => {}} /></Frame>,
};

export const SavedPlacesChips: StoryObj = {
  render: () => <Frame><SavedPlaces places={SAVED_PLACES} onSelect={() => {}} /></Frame>,
};

export const SavedPlacesRows: StoryObj = {
  render: () => <Frame><SavedPlaces places={[...SAVED_PLACES, ...RECENT_PLACES]} variant="rows" /></Frame>,
};

export const Configure: StoryObj = {
  render: function R() {
    const [opts, setOpts] = useState([
      { id: "fragile", label: "Fragile", kind: "toggle" as const, value: false },
      { id: "qty", label: "Packages", kind: "stepper" as const, value: 1 },
      { id: "speed", label: "Speed", kind: "segmented" as const, value: "standard",
        choices: [{ id: "standard", label: "Standard" }, { id: "express", label: "Express" }] },
    ]);
    return (
      <Frame>
        <ConfigureScene options={opts} onChange={(id, v) => setOpts((o) => o.map((x) => x.id === id ? { ...x, value: v as never } : x))} />
      </Frame>
    );
  },
};

export const Empty: StoryObj = {
  render: () => <Frame><EmptyState title="No shipments yet" body="Post a load to get started." /></Frame>,
};

export const Error: StoryObj = {
  render: () => <Frame><ErrorState title="Couldn't load quotes" body="Check your connection and try again." onRetry={() => {}} /></Frame>,
};
