import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  FreightQuoteScene, FreightStatusScene, ShipmentList, EquipmentRow,
  DeskShell, DeskSearchPanel, DeskLoadDetail, DeskFleetTable, DeskLanesList, DeskMyLoads,
} from "../web/freight.tsx";
import {
  FREIGHT_QUOTE_LINES, SHIPMENT, FREIGHT_LOADS, CARRIER_LOAD, FLEET_VEHICLES, SAVED_LANES, EQUIPMENT,
} from "../fixtures/freight.ts";
import { sheetFrame } from "../web/styles.ts";

const meta: Meta = { title: "Freight", parameters: { layout: "centered" } };
export default meta;

const Frame = ({ children }: { children: React.ReactNode }) => <div style={sheetFrame()}>{children}</div>;

export const ShipperQuote: StoryObj = {
  name: "Shipper · Quote",
  render: () => (
    <Frame>
      <FreightQuoteScene
        lines={FREIGHT_QUOTE_LINES} total="$1,840.00" note="Demo data"
        stops={[
          { label: SHIPMENT.origin, detail: "Pickup" },
          { label: SHIPMENT.destination, detail: "Delivery" },
        ]}
        onConfirm={() => {}}
      />
    </Frame>
  ),
};

export const ShipperStatus: StoryObj = {
  name: "Shipper · In transit",
  render: () => (
    <Frame>
      <FreightStatusScene eyebrow="Linehaul" headline="En route to Phoenix"
        supporting={`${SHIPMENT.weight} · ETA 6h 12m`} progress={45} />
    </Frame>
  ),
};

export const Shipments: StoryObj = {
  render: () => <Frame><ShipmentList items={FREIGHT_LOADS} /></Frame>,
};

export const Equipment: StoryObj = {
  render: () => <Frame><EquipmentRow options={[...EQUIPMENT]} selected="Dry van" /></Frame>,
};

export const DeskShellStory: StoryObj = {
  name: "Desk · Shell",
  parameters: { layout: "fullscreen" },
  render: () => (
    <DeskShell title="Lime Freight Desk" tabs={["Search", "My loads", "Fleet", "Lanes"]} activeTab="Search">
      <DeskSearchPanel />
    </DeskShell>
  ),
};

export const DeskLoadDetailStory: StoryObj = {
  name: "Desk · Load detail",
  parameters: { layout: "fullscreen" },
  render: () => (
    <DeskShell title="Lime Freight Desk" tabs={["Search", "My loads", "Fleet", "Lanes"]} activeTab="My loads">
      <DeskLoadDetail load={CARRIER_LOAD} />
    </DeskShell>
  ),
};

export const DeskFleet: StoryObj = {
  name: "Desk · Fleet",
  parameters: { layout: "fullscreen" },
  render: () => (
    <DeskShell title="Lime Freight Desk" tabs={["Search", "My loads", "Fleet", "Lanes"]} activeTab="Fleet">
      <DeskFleetTable vehicles={FLEET_VEHICLES} />
    </DeskShell>
  ),
};

export const DeskLanes: StoryObj = {
  name: "Desk · Lanes",
  parameters: { layout: "fullscreen" },
  render: () => (
    <DeskShell title="Lime Freight Desk" tabs={["Search", "My loads", "Fleet", "Lanes"]} activeTab="Lanes">
      <DeskLanesList lanes={SAVED_LANES} />
    </DeskShell>
  ),
};

export const DeskMyLoadsStory: StoryObj = {
  name: "Desk · My loads",
  parameters: { layout: "fullscreen" },
  render: () => (
    <DeskShell title="Lime Freight Desk" tabs={["Search", "My loads", "Fleet", "Lanes"]} activeTab="My loads">
      <DeskMyLoads loads={FREIGHT_LOADS} />
    </DeskShell>
  ),
};
