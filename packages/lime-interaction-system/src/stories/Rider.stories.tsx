import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  RiderHomeScene, RiderRideSelectScene, RiderQuoteScene,
  RiderConfirmPickupScene, RiderStatusScene, RiderCompleteScene,
} from "../web/scenes/rider-scenes.tsx";
import {
  SAVED_PLACES, RECENT_PLACES, SERVICE_TILES, RIDE_TIERS, PAYMENT,
  QUOTE_LINES, RIDER_PICKUP, RIDER_DESTINATION, RIDER_ROUTE, PICKUP_SPOTS,
} from "../fixtures/rider.ts";
import { SceneRenderer } from "../web/SceneRenderer.tsx";
import { envFromGlobals } from "../storybook/decorators.tsx";
import { PRIMARY, layout, scenes } from "./fixtures.ts";
import { ONTARIO, PHOENIX } from "./fixtures.ts";
import { color, radius, spacing } from "../tokens/index.ts";
import { MapRouteBar } from "../web/primitives.tsx";

const meta: Meta = { title: "Rider", parameters: { layout: "centered" } };
export default meta;

export const Home: StoryObj = {
  render: () => (
    <RiderHomeScene saved={SAVED_PLACES} recents={RECENT_PLACES} services={SERVICE_TILES}
      onSearch={() => {}} onSelectPlace={() => {}} />
  ),
};

export const HomeTraveling: StoryObj = {
  name: "Home · traveling",
  render: () => (
    <RiderHomeScene traveling destination="LAX" saved={SAVED_PLACES} recents={[]} onSearch={() => {}} />
  ),
};

export const RideSelect: StoryObj = {
  name: "Ride Select · scene",
  render: function R() {
    const [id, setId] = useState("comfort");
    return (
      <RiderRideSelectScene tiers={RIDE_TIERS} selectedId={id} payment={PAYMENT}
        onSelect={setId} onConfirm={() => {}} onOpenPayment={() => {}} />
    );
  },
};

export const RideSelectDesktop: StoryObj = {
  name: "Ride Select · desktop",
  parameters: { viewport: { defaultViewport: "desktop" } },
  render: function R() {
    const [id, setId] = useState("go");
    return (
      <div style={{ width: 480, padding: spacing.xl, background: color.panel.light,
        borderRadius: radius.sheet, border: `1px solid ${color.border.light}` }}>
        <RiderRideSelectScene tiers={RIDE_TIERS} selectedId={id} payment={PAYMENT} onSelect={setId} />
      </div>
    );
  },
};

export const Quote: StoryObj = {
  render: () => (
    <RiderQuoteScene pickup={RIDER_PICKUP} destination={RIDER_DESTINATION} route={RIDER_ROUTE}
      lines={QUOTE_LINES} total="$22.90" payment={PAYMENT} onConfirm={() => {}} />
  ),
};

export const ConfirmPickup: StoryObj = {
  render: function R() {
    const [spot, setSpot] = useState("curb");
    return (
      <RiderConfirmPickupScene address={RIDER_PICKUP} spots={PICKUP_SPOTS}
        selectedId={spot} onSelectSpot={setSpot} onConfirm={() => {}} />
    );
  },
};

export const Matching: StoryObj = {
  render: () => <RiderStatusScene status="matching" cancellable />,
};

export const DriverAssigned: StoryObj = {
  render: () => <RiderStatusScene status="assigned" />,
};

export const InRide: StoryObj = {
  render: () => <RiderStatusScene status="in_ride" />,
};

export const Completion: StoryObj = {
  render: () => <RiderCompleteScene onDone={() => {}} />,
};

/** Full spatial scene — map + sheet + route bar + ride select content. */
export const RideSelectSpatial: StoryObj = {
  name: "Ride Select · spatial composition",
  render: function R(_args, { globals }) {
    const [id, setId] = useState("comfort");
    const env = envFromGlobals(globals);
    return (
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", top: env.safeArea.top + 8, left: spacing.lg, right: spacing.lg, zIndex: 2 }}>
          <MapRouteBar origin={RIDER_PICKUP} destination={RIDER_DESTINATION} onBack={() => {}} />
        </div>
        <SceneRenderer
          frame={{
            scene: {
              id: scenes.riderRoute,
              surfaces: layout("sheet"),
              map: { mode: "route_preview", points: [ONTARIO, PHOENIX],
                route: { originId: "o", destinationId: "d" } },
              metadata: { product: "rider", state: "ride_select" },
            },
          }}
          env={env}
          showOcclusion={Boolean(globals.showOcclusion)}
          content={{
            [PRIMARY]: (
              <RiderRideSelectScene tiers={RIDE_TIERS} selectedId={id} payment={PAYMENT}
                onSelect={setId} onConfirm={() => {}} />
            ),
          }}
        />
      </div>
    );
  },
};
