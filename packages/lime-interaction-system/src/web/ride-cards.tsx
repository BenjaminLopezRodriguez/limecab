/**
 * Uber-style in-ride card stack and dark ride theme.
 * Reference: Uber in-ride screenshots (card stack over map, Aug 2026).
 * Layer: web renderer — lab projection only.
 */
import type { CSSProperties, ReactNode } from "react";
import { radius, spacing, typography } from "../tokens/index.ts";
import { t } from "./styles.ts";

/** Dark ride palette — closer to Uber in-ride screenshots than light tokens. */
export const rideDark = {
  canvas: "oklch(0.14 0.01 80)",
  sheet: "oklch(0.16 0.01 80)",
  card: "oklch(0.22 0.012 80)",
  cardRaised: "oklch(0.26 0.014 80)",
  banner: "oklch(0.28 0.06 250)",
  fg: "oklch(0.97 0.008 95)",
  muted: "oklch(0.72 0.016 90)",
  border: "oklch(1 0 0 / 12%)",
  destructive: "oklch(0.704 0.191 22.216)",
  pill: "oklch(0.32 0.012 80)",
} as const;

export function rideCard(style?: CSSProperties): CSSProperties {
  return {
    background: rideDark.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    border: `1px solid ${rideDark.border}`,
    ...style,
  };
}

function IconButton({ label, children, onPress }: { label: string; children: ReactNode; onPress?: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onPress}
      style={{
        width: 40, height: 40, borderRadius: radius.pill, border: "none",
        background: rideDark.pill, color: rideDark.fg, display: "grid", placeItems: "center",
        cursor: "pointer", flexShrink: 0,
      }}>{children}</button>
  );
}

function PillButton({ label, onPress, variant = "default" }: {
  label: string; onPress?: () => void; variant?: "default" | "primary" | "banner";
}) {
  const bg = variant === "primary" ? rideDark.fg : variant === "banner" ? "oklch(0.38 0.05 250)" : rideDark.pill;
  const fg = variant === "primary" ? rideDark.canvas : rideDark.fg;
  return (
    <button type="button" onClick={onPress}
      style={{
        border: "none", borderRadius: radius.pill, padding: `${spacing.sm}px ${spacing.lg}px`,
        background: bg, color: fg, ...t(typography.metadata), fontWeight: 600, cursor: "pointer",
        whiteSpace: "nowrap",
      }}>{label}</button>
  );
}

export function InRideHeadline({ children }: { children: ReactNode }) {
  return (
    <div style={{ textAlign: "center", padding: `${spacing.sm}px 0 ${spacing.md}px`,
      ...t(typography.subhead), color: rideDark.fg }}>{children}</div>
  );
}

export function ShareLocationCard({ contact, onShare }: { contact: string; onShare?: () => void }) {
  return (
    <div style={rideCard({ background: rideDark.banner, display: "flex", alignItems: "center", gap: spacing.md })}>
      <span aria-hidden style={{ fontSize: 22 }}>📡</span>
      <span style={{ flex: 1, ...t(typography.bodyStrong), color: rideDark.fg }}>
        Share location with {contact}
      </span>
      <PillButton label="Share" variant="banner" onPress={onShare} />
    </div>
  );
}

export function TripSummaryCard({
  productLabel, destinationLabel, onMore,
}: { productLabel: string; destinationLabel: string; onMore?: () => void }) {
  return (
    <div style={rideCard({ display: "flex", alignItems: "center", gap: spacing.md })}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...t(typography.metadata), color: rideDark.muted }}>{productLabel}</div>
        <div style={{ ...t(typography.bodyStrong), color: rideDark.fg, marginTop: 2 }}>{destinationLabel}</div>
      </div>
      <IconButton label="Ride options" onPress={onMore}>⋯</IconButton>
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: "lime" | "warm" }) {
  const bg = tone === "lime" ? "oklch(0.32 0.08 145)" : "oklch(0.35 0.08 55)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: `4px ${spacing.sm}px`, borderRadius: radius.pill,
      background: bg, ...t(typography.metadata), fontWeight: 600, color: rideDark.fg,
    }}>{children}</span>
  );
}

export function DriverTipCard({
  driver, tipValue, tips, tipNote, onTip, onMore,
}: {
  driver: { name: string; rating: string; initial: string };
  tipValue?: number;
  tips: readonly number[];
  tipNote: string;
  onTip?: (amount: number) => void;
  onMore?: () => void;
}) {
  return (
    <div style={rideCard({ display: "grid", gap: spacing.lg })}>
      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: spacing.md }}>
        <div style={{ display: "flex", gap: spacing.md, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <div aria-hidden style={{
              width: 56, height: 56, borderRadius: radius.pill, background: rideDark.cardRaised,
              display: "grid", placeItems: "center", ...t(typography.subhead), color: rideDark.fg,
            }}>{driver.initial}</div>
            <span style={{
              position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)",
              ...t(typography.metadata), fontWeight: 600, color: rideDark.fg,
              background: rideDark.card, padding: "2px 6px", borderRadius: radius.pill,
              whiteSpace: "nowrap",
            }}>★ {driver.rating}</span>
          </div>
          <div style={{ ...t(typography.subhead), color: rideDark.fg }}>Tip {driver.name}?</div>
        </div>
        <IconButton label="More tip options" onPress={onMore}>⋯</IconButton>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
        <Badge tone="lime">👆 Choose tip</Badge>
        <Badge tone="warm">🏆 Top-rated driver</Badge>
      </div>
      <TipPanelDark tips={tips} value={tipValue ?? 0} onChange={onTip} />
      <p style={{ ...t(typography.metadata), color: rideDark.muted, margin: 0 }}>{tipNote}</p>
    </div>
  );
}

function TipPanelDark({ tips, value, onChange }: {
  tips: readonly number[]; value: number; onChange?: (v: number) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Tip amount" style={{ display: "flex", gap: spacing.sm }}>
      {tips.map((tip) => (
        <button key={tip} type="button" role="radio" aria-checked={value === tip}
          onClick={() => onChange?.(tip)}
          style={{
            flex: 1, minHeight: 48, borderRadius: radius.control,
            border: `1px solid ${value === tip ? rideDark.fg : rideDark.border}`,
            background: value === tip ? rideDark.cardRaised : rideDark.sheet,
            color: rideDark.fg, cursor: "pointer", font: "inherit", ...t(typography.bodyStrong),
          }}>${tip}</button>
      ))}
      <button type="button" aria-label="Custom tip"
        style={{
          width: 48, minHeight: 48, borderRadius: radius.control,
          border: `1px solid ${rideDark.border}`, background: rideDark.sheet,
          color: rideDark.fg, cursor: "pointer", fontSize: 18,
        }}>✎</button>
    </div>
  );
}

export function PromoPeekCard({
  headline, body, cta, onPress,
}: { headline: string; body: string; cta: string; onPress?: () => void }) {
  return (
    <div style={{
      borderRadius: radius.card, overflow: "hidden", border: `1px solid ${rideDark.border}`,
      background: rideDark.card,
    }}>
      <div aria-hidden style={{ height: 120, background: rideDark.cardRaised }} />
      <div style={{ padding: spacing.lg, background: "oklch(0.32 0.1 250)" }}>
        <div style={{ ...t(typography.subhead), color: rideDark.fg }}>{headline}</div>
        <div style={{ ...t(typography.body), color: rideDark.muted, marginTop: 4 }}>{body}</div>
        <button type="button" onClick={onPress}
          style={{
            marginTop: spacing.md, width: "100%", height: 44, borderRadius: radius.pill,
            border: "none", background: rideDark.sheet, color: rideDark.fg,
            ...t(typography.bodyStrong), cursor: "pointer",
          }}>{cta}</button>
      </div>
    </div>
  );
}

export function InRideCardStack(props: {
  dropoffLabel: string;
  shareContact: string;
  productLabel: string;
  destinationLabel: string;
  driver: { name: string; rating: string; initial: string };
  tips: readonly number[];
  tipValue?: number;
  tipNote: string;
  promo: { headline: string; body: string; cta: string };
  onShare?: () => void;
  onTripMore?: () => void;
  onTip?: (n: number) => void;
  onTipMore?: () => void;
  onPromo?: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: spacing.md, color: rideDark.fg }}>
      <InRideHeadline>{props.dropoffLabel}</InRideHeadline>
      <ShareLocationCard contact={props.shareContact} onShare={props.onShare} />
      <TripSummaryCard productLabel={props.productLabel} destinationLabel={props.destinationLabel}
        onMore={props.onTripMore} />
      <DriverTipCard driver={props.driver} tips={props.tips} tipValue={props.tipValue}
        tipNote={props.tipNote} onTip={props.onTip} onMore={props.onTipMore} />
      <PromoPeekCard {...props.promo} onPress={props.onPromo} />
    </div>
  );
}

export function RideSheetChrome({ children, maxHeight = 520 }: { children: ReactNode; maxHeight?: number }) {
  return (
    <div style={{
      background: rideDark.sheet,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      padding: `${spacing.sm}px ${spacing.lg}px ${spacing.xl}px`,
      maxHeight,
      overflow: "auto",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div aria-hidden style={{
        width: 36, height: 4, borderRadius: radius.pill, background: rideDark.border,
        margin: `0 auto ${spacing.md}px`,
      }} />
      {children}
    </div>
  );
}

export function MapChromeButtons({ onBack, onSafety }: { onBack?: () => void; onSafety?: () => void }) {
  return (
    <>
      <button type="button" onClick={onBack} aria-label="Minimize"
        style={{
          position: "absolute", top: 59, left: 16, zIndex: 3,
          width: 44, height: 44, borderRadius: radius.pill, border: "none",
          background: rideDark.card, color: rideDark.fg, fontSize: 20, cursor: "pointer",
          boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
        }}>⌄</button>
      <button type="button" onClick={onSafety} aria-label="Safety"
        style={{
          position: "absolute", top: 59, right: 16, zIndex: 3,
          display: "flex", alignItems: "center", gap: 6,
          height: 44, padding: `0 ${spacing.lg}px`, borderRadius: radius.pill, border: "none",
          background: rideDark.card, color: rideDark.fg, cursor: "pointer",
          boxShadow: "0 2px 12px rgba(0,0,0,0.35)", ...t(typography.metadata), fontWeight: 600,
        }}>
        <span aria-hidden>🛡️</span> Safety
      </button>
    </>
  );
}
