import type { Meta, StoryObj } from "@storybook/react-vite";
import { color, spacing, radius, typography, surface, elevation } from "../tokens/index.ts";
import { webMobileExtents } from "../recipes/web-mobile/surface-extents.ts";
import { webMotion } from "../recipes/web/motion.ts";

const meta: Meta = { title: "Foundations/Tokens" };
export default meta;

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 16, padding: "10px 0",
    borderBottom: `1px solid ${color.border.light}`, alignItems: "center" }}>
    <code style={{ fontSize: 12, color: color.mutedForeground.light }}>{label}</code>
    <div>{children}</div>
  </div>
);

export const Color: StoryObj = {
  render: () => (
    <div style={{ width: 640 }}>
      {Object.entries(color).map(([k, v]) => (
        <Row key={k} label={k}>
          <div style={{ display: "flex", gap: 8 }}>
            {(["light", "dark"] as const).map((t) => (
              <div key={t} style={{ flex: 1, height: 40, borderRadius: radius.chip,
                background: v[t], border: `1px solid ${color.border.light}` }} />
            ))}
          </div>
        </Row>
      ))}
    </div>
  ),
};

export const Typography: StoryObj = {
  render: () => (
    <div style={{ width: 640 }}>
      {Object.entries(typography).map(([k, t]) => (
        <Row key={k} label={`${k} · ${t.size}/${t.weight}`}>
          <span style={{ fontSize: t.size, fontWeight: t.weight, letterSpacing: `${t.letterSpacing}em` }}>
            Where to?
          </span>
        </Row>
      ))}
    </div>
  ),
};

export const Spacing: StoryObj = {
  render: () => (
    <div style={{ width: 640 }}>
      {Object.entries(spacing).map(([k, v]) => (
        <Row key={k} label={`${k} · ${v}px`}>
          <div style={{ height: 12, width: v, background: color.lime.light, borderRadius: 2 }} />
        </Row>
      ))}
    </div>
  ),
};

/** The snap ladder is renderer POLICY, not core truth — labelled as such. */
export const SnapLadder: StoryObj = {
  render: () => (
    <div style={{ width: 640 }}>
      <p style={{ fontSize: 13, color: color.mutedForeground.light, marginBottom: 16 }}>
        Viewport <b>fractions</b>, not pixels — this is what ports to native untouched.
        Lives in <code>recipes/web-mobile/</code>: policy for one renderer family, not core truth.
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        {Object.entries(webMobileExtents).map(([k, f]) => (
          <div key={k} style={{ flex: 1, height: 200, position: "relative",
            border: `1px solid ${color.border.light}`, borderRadius: radius.chip, overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: `${(1 - f) * 100}% 0 0 0`,
              background: color.accent.light, borderTop: `2px solid ${color.lime.light}` }} />
            <div style={{ position: "absolute", bottom: 8, left: 8, fontSize: 12, fontWeight: 600 }}>
              {k}<br /><span style={{ color: color.lime.light }}>{f}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
};

/** Motion is keyed by INTENT. There are no springs in Lime — this is the extracted truth. */
export const Motion: StoryObj = {
  render: () => (
    <div style={{ width: 640 }}>
      {Object.entries(webMotion).map(([intent, m]) => (
        <Row key={intent} label={`${intent} · ${m.duration}ms +${m.delay}`}>
          <div style={{ height: 8, borderRadius: 4, background: color.muted.light, overflow: "hidden" }}>
            <div style={{ height: "100%", background: color.lime.light,
              animation: `slide ${m.duration}ms cubic-bezier(${m.easing.join(",")}) ${m.delay}ms infinite alternate` }} />
          </div>
        </Row>
      ))}
      <style>{`@keyframes slide { from { width: 8% } to { width: 100% } }`}</style>
    </div>
  ),
};

export const Elevation: StoryObj = {
  render: () => (
    <div style={{ width: 640 }}>
      <p style={{ fontSize: 13, color: color.mutedForeground.light }}>
        Border is Lime&rsquo;s primary elevation cue; shadow is reserved for things floating over the map.
      </p>
      {Object.entries(elevation).map(([k, s]) => (
        <Row key={k} label={k}>
          <div style={{ height: surface.cta.default, borderRadius: radius.card, background: color.panel.light,
            boxShadow: `${s.x}px ${s.y}px ${s.blur}px ${s.color}` }} />
        </Row>
      ))}
    </div>
  ),
};
