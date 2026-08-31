import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScenarioPlayer } from "../harness/ScenarioPlayer.tsx";
import { freightHappyPath, freightExceptions, freightCopy, type FreightStep }
  from "../scenarios/freight/happy-path.ts";
import { PRIMARY, phone } from "./fixtures.ts";
import { color, radius, surface, typography } from "../tokens/index.ts";

const meta: Meta = { title: "Flows/Freight", parameters: { layout: "centered" } };
export default meta;

const Content = ({ step }: { step: FreightStep }) => {
  const c = freightCopy[step];
  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ fontSize: typography.eyebrow.size, fontWeight: typography.eyebrow.weight,
        letterSpacing: `${typography.eyebrow.letterSpacing}em`, textTransform: "uppercase",
        color: color.mutedForeground.light, marginBottom: 6 }}>{c.eyebrow}</div>
      <div style={{ fontSize: typography.headline.size, fontWeight: typography.headline.weight,
        letterSpacing: `${typography.headline.letterSpacing}em` }}>{c.headline}</div>
      {c.supporting ? (
        <div style={{ fontSize: typography.body.size, color: color.mutedForeground.light, marginTop: 4 }}>
          {c.supporting}
        </div>
      ) : null}
    </div>
  );
};

/**
 * The §32 viability test, playable.
 *
 *   assigned → pickup → loading → linehaul → POD → complete
 *   during linehaul:  minimize → ambient → restore → exact prior state
 *   during loading:   open exception → cancel → exact loading state
 *
 * Drag the sheet down during live work to minimize it by gesture.
 * Open the snapshot drawer: that JSON is everything needed to rebuild the screen —
 * which is what makes native backgrounding and process death survivable.
 */
export const HappyPath: StoryObj = {
  name: "Happy path + minimize + exception",
  render: () => (
    <ScenarioPlayer
      definition={freightHappyPath}
      env={phone()}
      primary={PRIMARY}
      interrupts={freightExceptions}
      renderContent={(step) => <Content step={step} />}
      renderActions={(step) => {
        const label = freightCopy[step].primaryAction;
        return label ? (
          <button style={{ width: "100%", height: surface.cta.default, borderRadius: radius.pill,
            border: "none", background: color.foreground.light, color: color.canvas.light,
            fontSize: typography.cta.size, fontWeight: typography.cta.weight, cursor: "pointer" }}>
            {label}
          </button>
        ) : null;
      }}
    />
  ),
};
