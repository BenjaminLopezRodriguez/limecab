import type { Meta, StoryObj } from "@storybook/react-vite";
import { MapPin, CarMarker, PickupPointMarker, RestStopMarker, SpatialEtaMarker, MapMarkerGallery } from "../web/map.tsx";
import { MapRouteBar } from "../web/primitives.tsx";
import { spacing } from "../tokens/index.ts";

const meta: Meta = { title: "Map", parameters: { layout: "centered" } };
export default meta;

export const Gallery: StoryObj = {
  name: "Markers · gallery",
  render: () => <MapMarkerGallery />,
};

export const RouteBar: StoryObj = {
  render: () => (
    <div style={{ width: 390 }}>
      <MapRouteBar origin="Ontario, CA" destination="Phoenix, AZ" onBack={() => {}} onEdit={() => {}} />
    </div>
  ),
};

export const CarHeading: StoryObj = {
  render: () => (
    <div style={{ display: "flex", gap: spacing.xl }}>
      <CarMarker heading={0} />
      <CarMarker heading={90} size="sm" />
      <CarMarker heading={180} />
    </div>
  ),
};

export const Pins: StoryObj = {
  render: () => (
    <div style={{ display: "flex", gap: spacing.xl }}>
      <MapPin label="Pickup" kind="accent" selected />
      <MapPin label="Drop-off" />
      <MapPin label="Closed" kind="negative" />
    </div>
  ),
};

export const EtaStates: StoryObj = {
  render: () => (
    <div style={{ display: "flex", gap: spacing.md }}>
      <SpatialEtaMarker status="waiting" eta="—" />
      <SpatialEtaMarker status="moving" eta="4 min" selected />
      <SpatialEtaMarker status="arrived" eta="Here" />
    </div>
  ),
};

export const PickupMarker: StoryObj = {
  render: () => <PickupPointMarker label="Curbside" detail="Maple & 4th" selected />,
};

export const RestStop: StoryObj = {
  render: () => <RestStopMarker label="Coffee" category="coffee" selected />,
};
