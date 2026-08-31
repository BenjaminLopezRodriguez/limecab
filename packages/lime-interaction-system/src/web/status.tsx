/**
 * Derived from: src/components/service-app/service-status.tsx
 * Layer: web renderer
 */
import type { ReactNode } from "react";
import { color, spacing } from "../tokens/index.ts";
import { LiveSheetHeader, ProviderCard } from "./primitives.tsx";
import { ProgressBar } from "./ui.tsx";
import { t, eyebrow } from "./styles.ts";
import { typography } from "../tokens/index.ts";

export function ProviderEta({ label, value, hero }: { label?: string; value: string; hero?: boolean }) {
  return (
    <p style={{ margin: 0 }}>
      {label ? <span style={{ ...eyebrow, display: "block" }}>{label}</span> : null}
      <span style={{
        display: "block", fontVariantNumeric: "tabular-nums",
        fontSize: hero ? 34 : 17, fontWeight: hero ? 600 : 500,
        letterSpacing: hero ? "-0.03em" : "-0.01em", lineHeight: hero ? 1 : 1.2,
      }}>{value}</span>
    </p>
  );
}

export function ServiceProgress({ value, completedSteps, totalSteps }: {
  value: number; completedSteps?: number; totalSteps?: number;
}) {
  return (
    <div>
      {completedSteps !== undefined && totalSteps !== undefined ? (
        <p style={{ ...t(typography.metadata), color: color.mutedForeground.light, marginBottom: spacing.sm }}>
          {completedSteps} of {totalSteps} steps complete
        </p>
      ) : null}
      <ProgressBar value={value} label="Service progress" />
    </div>
  );
}

export type Milestone = { label: string; done: boolean };

export function ServiceMilestones({ milestones, index }: { milestones: Milestone[]; index: number }) {
  return (
    <ol aria-label="Trip progress" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: spacing.sm }}>
      {milestones.map((m, i) => (
        <li key={m.label} aria-current={i === index ? "step" : undefined}
          style={{ display: "flex", alignItems: "center", gap: spacing.md,
            opacity: m.done ? 0.6 : i === index ? 1 : 0.4 }}>
          <span aria-hidden style={{
            width: 8, height: 8, borderRadius: 999,
            background: m.done ? color.lime.light : i === index ? color.foreground.light : color.border.light,
          }} />
          <span style={{ ...t(i === index ? typography.bodyStrong : typography.body) }}>{m.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function ServiceStatusPanel({
  eyebrow: eyebrowText, headline, supporting, eta, progress, milestones, milestoneIndex, provider,
}: {
  eyebrow?: string; headline: string; supporting?: string;
  eta?: { label?: string; value: string; hero?: boolean };
  progress?: { value: number; completedSteps?: number; totalSteps?: number };
  milestones?: Milestone[]; milestoneIndex?: number;
  provider?: { name: string; vehicle: string; plate: string; rating?: string };
}) {
  return (
    <div>
      <LiveSheetHeader eyebrow={eyebrowText} headline={headline} supporting={supporting} />
      {eta ? <div style={{ marginTop: spacing.lg }}><ProviderEta {...eta} /></div> : null}
      {progress ? <div style={{ marginTop: spacing.lg }}><ServiceProgress {...progress} /></div> : null}
      {milestones ? (
        <div style={{ marginTop: spacing.lg }}>
          <ServiceMilestones milestones={milestones} index={milestoneIndex ?? 0} />
        </div>
      ) : null}
      {provider ? <ProviderCard {...provider} /> : null}
    </div>
  );
}

/** Minimized live-work pill. */
export function TripPill({ status, eta, onRestore }: { status: string; eta: string; onRestore?: () => void }) {
  return (
    <button type="button" onClick={onRestore} aria-label={`${status}. ${eta}. Restore trip`}
      style={{
        display: "flex", alignItems: "center", gap: spacing.md,
        padding: `${spacing.sm}px ${spacing.lg}px`, borderRadius: 999,
        border: `1px solid ${color.border.light}`, background: color.panel.light,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)", cursor: "pointer", font: "inherit",
      }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: color.lime.light }} />
      <span style={t(typography.bodyStrong)}>{status}</span>
      <span style={{ ...t(typography.metadata), color: color.mutedForeground.light }}>{eta}</span>
    </button>
  );
}

export function VoiceBanner({ state, text }: { state: "idle" | "listening" | "processing"; text?: string }) {
  const labels = { idle: "Tap to speak", listening: "Listening…", processing: "Processing…" };
  return (
    <div role="status" aria-live="polite"
      style={{ display: "flex", alignItems: "center", gap: spacing.md, padding: spacing.md,
        borderRadius: 999, background: state === "listening" ? color.accent.light : color.muted.light }}>
      <span aria-hidden>🎤</span>
      <span style={t(typography.body)}>{text ?? labels[state]}</span>
    </div>
  );
}

export function LiveJobDock({ children }: { children: ReactNode }) {
  return <div style={{ marginTop: spacing.lg, display: "grid", gap: spacing.sm }}>{children}</div>;
}
