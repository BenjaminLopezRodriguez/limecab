import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  PartnerTabBar, PlacesPausedHome, PlacesLivePeek, PlacesListingsScene, PartnerChromeHeader,
} from "../web/partner.tsx";
import { PARTNER_LISTINGS, PARTNER_TABS } from "../fixtures/partner.ts";
import { sheetFrame } from "../web/styles.ts";

const meta: Meta = { title: "Partner", parameters: { layout: "centered" } };
export default meta;

const Frame = ({ children }: { children: React.ReactNode }) => <div style={sheetFrame()}>{children}</div>;

export const Chrome: StoryObj = {
  render: () => <PartnerChromeHeader title="Places" eyebrow="Partner" />,
};

export const Tabs: StoryObj = {
  render: () => <div style={{ width: 390 }}><PartnerTabBar active="Places" tabs={PARTNER_TABS} /></div>,
};

export const PausedHome: StoryObj = {
  render: () => <Frame><PlacesPausedHome listings={PARTNER_LISTINGS} onGoLive={() => {}} /></Frame>,
};

export const LivePeek: StoryObj = {
  render: () => <PlacesLivePeek liveCount={2} />,
};

export const ListingsAll: StoryObj = {
  render: () => <Frame><PlacesListingsScene listings={PARTNER_LISTINGS} /></Frame>,
};

export const ListingsLive: StoryObj = {
  render: () => <Frame><PlacesListingsScene listings={PARTNER_LISTINGS} filter="live" /></Frame>,
};
