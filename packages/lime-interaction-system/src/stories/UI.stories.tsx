import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, LimeInput, ProgressBar, Separator, DialogFrame, DrawerFrame, MapFloatingButton } from "../web/ui.tsx";
import { sheetFrame } from "../web/styles.ts";
import { spacing } from "../tokens/index.ts";

const meta: Meta = { title: "UI", parameters: { layout: "centered" } };
export default meta;

const Frame = ({ children, width }: { children: React.ReactNode; width?: number }) => (
  <div style={sheetFrame(width)}>{children}</div>
);

export const ButtonVariants: StoryObj = {
  name: "Button · Lime variants",
  render: () => (
    <Frame>
      <div style={{ display: "grid", gap: spacing.sm }}>
        <Button>Request Lime</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Cancel load</Button>
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
        <Button size="sm">Compact</Button>
        <MapFloatingButton label="Recenter">◎</MapFloatingButton>
      </div>
    </Frame>
  ),
};

export const InputStates: StoryObj = {
  render: () => (
    <Frame>
      <div style={{ display: "grid", gap: spacing.lg }}>
        <LimeInput placeholder="Where to?" />
        <LimeInput search placeholder="Search" value="Ontario" />
        <LimeInput placeholder="Required" error="Enter a valid address" />
        <LimeInput placeholder="Disabled" disabled />
      </div>
    </Frame>
  ),
};

export const Progress: StoryObj = {
  render: () => <Frame><ProgressBar value={62} /></Frame>,
};

export const SeparatorStory: StoryObj = {
  name: "Separator",
  render: () => <Frame><p>Above</p><Separator /><p>Below</p></Frame>,
};

export const Dialog: StoryObj = {
  render: () => (
    <DialogFrame title="Cancel ride?" description="Your driver is already on the way.">
      <div style={{ display: "grid", gap: spacing.sm }}>
        <Button variant="destructive">Cancel ride</Button>
        <Button variant="outline">Keep ride</Button>
      </div>
    </DialogFrame>
  ),
};

export const Drawer: StoryObj = {
  render: () => (
    <DrawerFrame title="Sheet · peek" snapLabel="40% viewport">
      <p>Ordinary bottom sheet chrome.</p>
    </DrawerFrame>
  ),
};

export const InterruptDrawer: StoryObj = {
  name: "Drawer · compact interrupt",
  render: () => (
    <DrawerFrame title="Confirm cancellation">
      <p style={{ margin: 0 }}>Compact interrupt over suspended work.</p>
    </DrawerFrame>
  ),
};
