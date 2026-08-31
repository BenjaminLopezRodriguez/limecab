import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ExperienceFrame } from "../core/frame.ts";
import { SceneRenderer } from "../web/SceneRenderer.tsx";
import { color, radius, typography, surface } from "../tokens/index.ts";
import { LANE, ONTARIO, PHOENIX, PRIMARY, TRUCK, layout, phone, scenes } from "./fixtures.ts";

const meta: Meta = { title: "Scenes", parameters: { layout: "centered" } };
export default meta;

const money = (minor: number) => `$${(minor / 100).toLocaleString("en-US")}`;

const Body = ({ eyebrow, headline, sub }: { eyebrow?: string; headline: string; sub?: string }) => (
  <div style={{ paddingTop: 8 }}>
    {eyebrow ? (
      <div style={{ fontSize: typography.eyebrow.size, fontWeight: typography.eyebrow.weight,
        letterSpacing: `${typography.eyebrow.letterSpacing}em`, textTransform: "uppercase",
        color: color.mutedForeground.light, marginBottom: 6 }}>{eyebrow}</div>
    ) : null}
    <div style={{ fontSize: typography.headline.size, fontWeight: typography.headline.weight,
      letterSpacing: `${typography.headline.letterSpacing}em` }}>{headline}</div>
    {sub ? <div style={{ fontSize: typography.body.size, color: color.mutedForeground.light,
      marginTop: 4 }}>{sub}</div> : null}
  </div>
);

const Cta = ({ children }: { children: React.ReactNode }) => (
  <button style={{ width: "100%", height: surface.cta.default, borderRadius: radius.pill,
    border: "none", background: color.foreground.light, color: color.canvas.light,
    fontSize: typography.cta.size, fontWeight: typography.cta.weight, cursor: "pointer" }}>
    {children}
  </button>
);

function Stage({ frame, showOcclusion }: { frame: ExperienceFrame; showOcclusion?: boolean }) {
  const env = phone();
  return (
    <div style={{ borderRadius: 24, overflow: "hidden", border: `1px solid ${color.border.light}` }}>
      <SceneRenderer
        frame={frame}
        env={env}
        showOcclusion={showOcclusion}
        content={{ [PRIMARY]: frameContent(frame) }}
        actions={{ [PRIMARY]: frameCta(frame) }}
      />
    </div>
  );
}

function frameContent(frame: ExperienceFrame) {
  switch (frame.scene.metadata?.state) {
    case "home": return <Body headline="Where to?" sub="Ontario, CA" />;
    case "route": return <Body eyebrow="Route" headline="Ontario → Phoenix"
      sub={`${LANE.distanceMi} mi · ${LANE.equipment} · ${money(LANE.rateMinor)} (demo)`} />;
    case "linehaul": return <Body eyebrow="In transit" headline="Linehaul"
      sub={`${LANE.weightLb.toLocaleString()} lb · ETA 6h 12m`} />;
    default: return null;
  }
}
function frameCta(frame: ExperienceFrame) {
  const s = frame.scene.metadata?.state;
  if (s === "route") return <Cta>Publish shipment</Cta>;
  if (s === "linehaul") return <Cta>Arrived at delivery</Cta>;
  return null;
}

/** peek 0.22 — ambient world, surface barely occludes. */
export const RiderHome: StoryObj = {
  render: () => (
    <Stage showOcclusion frame={{
      scene: { id: scenes.riderHome, surfaces: layout("peek"),
        map: { mode: "home", points: [ONTARIO] }, metadata: { product: "rider", state: "home" } },
    }} />
  ),
};

/** sheet 0.40 — the camera pads; the map does not shrink. */
export const RiderRoutePreview: StoryObj = {
  render: () => (
    <Stage showOcclusion frame={{
      scene: { id: scenes.riderRoute, surfaces: layout("sheet"),
        map: { mode: "route_preview", points: [ONTARIO, PHOENIX], route: { originId: "o", destinationId: "d" } },
        metadata: { product: "rider", state: "route" } },
      transition: { from: scenes.riderHome, to: scenes.riderRoute, intent: "progress" },
    }} />
  ),
};

/** follow intent centres the subject and ignores the bounds. */
export const FreightLinehaul: StoryObj = {
  render: () => (
    <Stage showOcclusion frame={{
      scene: { id: scenes.freightLinehaul, surfaces: layout("sheet"),
        map: { mode: "active_route", points: [ONTARIO, PHOENIX, TRUCK],
          route: { originId: "o", destinationId: "d" }, camera: { intent: "follow" } },
        metadata: { product: "freight", state: "linehaul" } },
      transition: { from: null, to: scenes.freightLinehaul, intent: "progress",
        announcement: { text: "Linehaul. En route to Phoenix.", urgency: "polite", eventId: "fl-1" } },
    }} />
  ),
};

/**
 * The §32 architecture test, interactive.
 * Drag the sheet down: live work MINIMIZES, it does not vanish. Restore returns the
 * exact prior state — because the scene is the truth, not the animation.
 */
export const MinimizeRestore: StoryObj = {
  name: "Freight · minimize ⇄ restore",
  render: function Render() {
    const [minimized, setMinimized] = useState(false);
    const frame: ExperienceFrame = {
      scene: {
        id: scenes.freightLinehaul,
        surfaces: layout(minimized ? "peek" : "sheet"),
        map: { mode: "active_route", points: [ONTARIO, PHOENIX, TRUCK],
          route: { originId: "o", destinationId: "d" },
          camera: { intent: minimized ? "fit" : "follow" } },
        metadata: { product: "freight", state: "linehaul" },
      },
      transition: {
        from: scenes.freightLinehaul, to: scenes.freightLinehaul,
        intent: minimized ? "collapse" : "return",
      },
    };
    const env = phone();
    return (
      <div style={{ display: "grid", gap: 12, justifyItems: "center" }}>
        <div style={{ borderRadius: 24, overflow: "hidden", border: `1px solid ${color.border.light}` }}>
          <SceneRenderer
            frame={frame} env={env} showOcclusion
            content={{ [PRIMARY]: frameContent(frame) }}
            actions={{ [PRIMARY]: minimized ? null : frameCta(frame) }}
            dragIntent={{ [PRIMARY]: minimized ? "none" : "minimize" }}
            onDragIntent={() => setMinimized(true)}
          />
        </div>
        <button onClick={() => setMinimized((m) => !m)}
          style={{ height: 36, padding: "0 16px", borderRadius: radius.pill,
            border: `1px solid ${color.border.light}`, background: color.panel.light, cursor: "pointer" }}>
          {minimized ? "Restore" : "Minimize"} · drag the sheet down too
        </button>
      </div>
    );
  },
};
