import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ProfileHero, ProfileSection, ProfileLinkRow, SettingSwitch, VehicleCard, TripChatThread, SupportForm,
} from "../web/profile.tsx";
import { PROFILE, VEHICLES, CHAT_MESSAGES, SUPPORT_TOPICS } from "../fixtures/profile.ts";
import { sheetFrame } from "../web/styles.ts";
import { spacing } from "../tokens/index.ts";

const meta: Meta = { title: "Profile", parameters: { layout: "centered" } };
export default meta;

const Frame = ({ children }: { children: React.ReactNode }) => <div style={sheetFrame()}>{children}</div>;

export const ProfileStory: StoryObj = {
  name: "Profile",
  render: () => (
    <Frame>
      <ProfileHero name={PROFILE.name} facts={PROFILE.facts} />
      <div style={{ marginTop: spacing.xl }}>
        <ProfileSection title="Account">
          <ProfileLinkRow label="Payment" detail="Visa ·••• 4242" />
          <ProfileLinkRow label="Saved places" detail="3 places" />
        </ProfileSection>
      </div>
    </Frame>
  ),
};

export const Settings: StoryObj = {
  render: () => (
    <Frame>
      <SettingSwitch label="Push notifications" checked />
      <SettingSwitch label="Share ETA" checked={false} />
    </Frame>
  ),
};

export const Vehicle: StoryObj = {
  render: () => {
    const v = VEHICLES[0]!;
    return <Frame><VehicleCard make={v.make} model={v.model} year={v.year} plate={v.plate} color={v.color} /></Frame>;
  },
};

export const TripChat: StoryObj = {
  render: () => <Frame><TripChatThread messages={CHAT_MESSAGES} /></Frame>,
};

export const Support: StoryObj = {
  render: () => <Frame><SupportForm topics={SUPPORT_TOPICS} /></Frame>,
};
