import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScenarioPlayer } from "../harness/ScenarioPlayer.tsx";
import { riderHappyPath, riderInterrupts, riderCopy, type RiderStep }
  from "../scenarios/rider/happy-path.ts";
import { PRIMARY, phone } from "./fixtures.ts";
import { color, radius, surface, typography } from "../tokens/index.ts";

const meta: Meta = { title: "Flows/Rider", parameters: { layout: "centered" } };
export default meta;

const RiderContent = ({ step }: { step: RiderStep }) => {
  const c = riderCopy[step];
  return (
    <div style={{ paddingTop: 8 }}>
      {c.eyebrow ? (
        <div style={{ fontSize: typography.eyebrow.size, fontWeight: typography.eyebrow.weight,
          letterSpacing: `${typography.eyebrow.letterSpacing}em`, textTransform: "uppercase",
          color: color.mutedForeground.light, marginBottom: 6 }}>{c.eyebrow}</div>
      ) : null}
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

export const HappyPath: StoryObj = {
  name: "Happy path + minimize + interrupt",
  render: () => (
    <ScenarioPlayer
      definition={riderHappyPath}
      env={phone()}
      primary={PRIMARY}
      interrupts={riderInterrupts}
      renderContent={(step) => <RiderContent step={step} />}
      renderActions={(step) => {
        const label = riderCopy[step].primaryAction;
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
