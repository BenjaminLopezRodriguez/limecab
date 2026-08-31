/**
 * Derived from: src/components/limecab/{profile,profile-settings,support-form,trip-chat-thread,vehicle-manager}.tsx
 * Layer: web renderer
 */
import type { ReactNode } from "react";
import { color, radius, spacing } from "../tokens/index.ts";
import { ChoiceList, ChoiceRow } from "./primitives.tsx";
import { LimeInput, Button } from "./ui.tsx";
import { t, headline } from "./styles.ts";
import { typography } from "../tokens/index.ts";

export function ProfileHero({ name, facts }: { name: string; facts: string[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: spacing.lg }}>
      <span aria-hidden style={{ width: 64, height: 64, borderRadius: radius.pill,
        background: color.muted.light, display: "grid", placeItems: "center",
        ...t(typography.headline) }}>{name.charAt(0)}</span>
      <div>
        <div style={headline}>{name}</div>
        {facts.map((f) => (
          <div key={f} style={{ ...t(typography.metadata), color: color.mutedForeground.light }}>{f}</div>
        ))}
      </div>
    </div>
  );
}

export function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: "grid", gap: spacing.sm }}>
      <h3 style={{ ...t(typography.metadata), color: color.mutedForeground.light,
        textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{title}</h3>
      {children}
    </section>
  );
}

export function ProfileLinkRow({ label, detail, onPress }: {
  label: string; detail?: string; onPress?: () => void;
}) {
  return (
    <ChoiceList>
      <ChoiceRow title={label} detail={detail} trailing="→" onSelect={onPress} />
    </ChoiceList>
  );
}

export function SettingSwitch({ label, checked, onChange }: {
  label: string; checked: boolean; onChange?: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: `${spacing.md}px 0` }}>
      <span style={t(typography.body)}>{label}</span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label}
        onClick={() => onChange?.(!checked)}
        style={{
          width: 52, height: 32, borderRadius: radius.pill, border: "none", padding: 2,
          background: checked ? color.foreground.light : color.muted.light, cursor: "pointer",
        }}>
        <span style={{ display: "block", width: 28, height: 28, borderRadius: radius.pill,
          background: color.panel.light, transform: checked ? "translateX(20px)" : "none" }} />
      </button>
    </div>
  );
}

export function VehicleCard({ make, model, year, plate, color: carColor }: {
  make: string; model: string; year: number; plate: string; color: string;
}) {
  return (
    <div style={{ padding: spacing.lg, borderRadius: radius.card, border: `1px solid ${color.border.light}`,
      background: color.panel.light }}>
      <div style={t(typography.bodyStrong)}>{year} {make} {model}</div>
      <div style={{ ...t(typography.metadata), color: color.mutedForeground.light }}>
        {plate} · {carColor}
      </div>
    </div>
  );
}

export function TripChatThread({
  messages, onSend,
}: {
  messages: { id: string; from: "rider" | "driver"; text: string; time: string }[];
  onSend?: (text: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: spacing.md, height: 320 }}>
      <div role="log" aria-label="Trip chat" style={{ flex: 1, overflow: "auto", display: "grid",
        gap: spacing.sm, alignContent: "end" }}>
        {messages.map((m) => (
          <div key={m.id} style={{
            justifySelf: m.from === "rider" ? "end" : "start", maxWidth: "80%",
            padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.card,
            background: m.from === "rider" ? color.foreground.light : color.muted.light,
            color: m.from === "rider" ? color.canvas.light : color.foreground.light,
            ...t(typography.body),
          }}>
            {m.text}
            <div style={{ ...t(typography.metadata), opacity: 0.7, marginTop: 2 }}>{m.time}</div>
          </div>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); onSend?.(""); }}
        style={{ display: "flex", gap: spacing.sm }}>
        <LimeInput placeholder="Message" aria-label="Message" />
        <Button size="icon" aria-label="Send">↑</Button>
      </form>
    </div>
  );
}

export function SupportForm({ topics, onSubmit }: { topics: string[]; onSubmit?: () => void }) {
  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <div style={headline}>Get help</div>
      <ChoiceList label="Topic">
        {topics.map((tpc) => (
          <ChoiceRow key={tpc} title={tpc} trailing="→" />
        ))}
      </ChoiceList>
      <LimeInput placeholder="Describe the issue" aria-label="Issue description" />
      <Button onClick={onSubmit}>Submit</Button>
    </div>
  );
}

export function TipPanel({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const tips = [0, 2, 3, 5];
  return (
    <div role="radiogroup" aria-label="Tip amount" style={{ display: "flex", gap: spacing.sm }}>
      {tips.map((tip) => (
        <button key={tip} type="button" role="radio" aria-checked={value === tip}
          onClick={() => onChange?.(tip)}
          style={{
            flex: 1, padding: spacing.md, borderRadius: radius.card,
            border: `1px solid ${value === tip ? color.foreground.light : color.border.light}`,
            background: value === tip ? color.accent.light : color.panel.light,
            cursor: "pointer", font: "inherit", ...t(typography.bodyStrong),
          }}>{tip === 0 ? "No tip" : `$${tip}`}</button>
      ))}
    </div>
  );
}
