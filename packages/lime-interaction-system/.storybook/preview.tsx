import type { Preview } from "@storybook/react-vite";
import { FONT_SCALES, VIEWPORTS } from "../src/storybook/decorators.tsx";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: { expanded: true },
    viewport: {
      viewports: Object.fromEntries(
        Object.entries(VIEWPORTS).map(([k, v]) => [k, { name: v.label, styles: { width: `${v.width}px`, height: `${v.height}px` } }]),
      ),
      defaultViewport: "mobile",
    },
    options: {
      storySort: {
        order: [
          "Foundations",
          "UI",
          "Primitives",
          "Lists & Choices",
          "Location",
          "Map",
          "Status",
          "Surfaces",
          "Rider",
          "Rider/In ride",
          "Driver",
          "Freight",
          "Partner",
          "Profile",
          "Scenes",
          "Flows",
        ],
      },
    },
  },
  globalTypes: {
    viewport: {
      name: "Viewport preset",
      description: "Canonical Lime viewport",
      defaultValue: "mobile",
      toolbar: {
        icon: "grow",
        items: Object.entries(VIEWPORTS).map(([k, v]) => ({ value: k, title: v.label })),
      },
    },
    fontScale: {
      name: "Font scale",
      description: "Semantic text scale (Dynamic Type proxy)",
      defaultValue: 1,
      toolbar: {
        icon: "paragraph",
        items: FONT_SCALES.map((s) => ({ value: s, title: `${s}×` })),
      },
    },
    keyboardVisible: {
      name: "Keyboard",
      description: "Presentation policy — keyboard visible",
      defaultValue: false,
      toolbar: { icon: "keyboard", items: [{ value: false, title: "Hidden" }, { value: true, title: "Visible" }] },
    },
    reducedMotion: {
      name: "Reduced motion",
      defaultValue: false,
      toolbar: { icon: "contrast", items: [{ value: false, title: "Off" }, { value: true, title: "On" }] },
    },
    showOcclusion: {
      name: "Occlusion viz",
      defaultValue: false,
      toolbar: { icon: "eye", items: [{ value: false, title: "Off" }, { value: true, title: "On" }] },
    },
  },
};
export default preview;
