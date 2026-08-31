/**
 * Uber-style interrupt sheets: ride details, driver details, safety.
 * Layer: web renderer — lab projection only.
 */
import { useState, type ReactNode } from "react";
import { radius, spacing, typography } from "../tokens/index.ts";
import { rideDark } from "./ride-cards.tsx";
import { t } from "./styles.ts";

export function InterruptSheetHeader({
  title, onClose,
}: { title: string; onClose?: () => void }) {
  return (
    <div style={{ position: "relative", textAlign: "center", marginBottom: spacing.lg }}>
      {onClose ? (
        <button type="button" onClick={onClose} aria-label="Close"
          style={{
            position: "absolute", left: 0, top: 0, border: "none", background: "transparent",
            color: rideDark.fg, fontSize: 22, cursor: "pointer", lineHeight: 1,
          }}>×</button>
      ) : null}
      <div style={{ ...t(typography.subhead), color: rideDark.fg }}>{title}</div>
    </div>
  );
}

function TrailingPill({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <button type="button" onClick={onPress}
      style={{
        border: "none", borderRadius: radius.pill, padding: `${spacing.sm}px ${spacing.lg}px`,
        background: rideDark.pill, color: rideDark.fg, ...t(typography.metadata), fontWeight: 600,
        cursor: "pointer", flexShrink: 0,
      }}>{label}</button>
  );
}

function RowDivider() {
  return <div style={{ height: 1, background: rideDark.border }} />;
}

export function ActionRow({
  icon, title, subtitle, trailing, onPress, link,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  link?: { label: string; onPress?: () => void };
}) {
  const inner = (
    <>
      <span aria-hidden style={{ width: 28, display: "grid", placeItems: "center", flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ ...t(typography.bodyStrong), color: rideDark.fg, display: "block" }}>{title}</span>
        {subtitle ? (
          <span style={{ ...t(typography.metadata), color: rideDark.muted, display: "block", marginTop: 2 }}>
            {subtitle}
          </span>
        ) : null}
        {link ? (
          <button type="button" onClick={link.onPress}
            style={{
              marginTop: spacing.sm, border: "none", background: "transparent", padding: 0,
              color: rideDark.muted, ...t(typography.metadata), cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}>{link.label} <span aria-hidden>›</span></button>
        ) : null}
      </span>
      {trailing}
    </>
  );
  const rowStyle = {
    display: "flex", alignItems: "center", gap: spacing.md,
    width: "100%", padding: `${spacing.lg}px 0`, border: "none", background: "transparent",
    textAlign: "left" as const, font: "inherit", color: rideDark.fg,
  };
  return onPress ? (
    <button type="button" onClick={onPress} style={{ ...rowStyle, cursor: "pointer" }}>{inner}</button>
  ) : (
    <div style={rowStyle}>{inner}</div>
  );
}

export function RideDetailsInterrupt({
  destination, arrivalLabel, fare, payment, loyalty,
  onEditDestination, onAddStop, onSwitchPayment, onSplitFare, onRate, onShare,
  onCancel, onClose,
}: {
  destination: string;
  arrivalLabel: string;
  fare: string;
  payment: { wallet: string; brand: string; last4: string };
  loyalty?: { program: string; benefit: string };
  onEditDestination?: () => void;
  onAddStop?: () => void;
  onSwitchPayment?: () => void;
  onSplitFare?: () => void;
  onRate?: () => void;
  onShare?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
}) {
  return (
    <div style={{ color: rideDark.fg }}>
      <InterruptSheetHeader title="Ride details" onClose={onClose} />
      <ActionRow icon="📍" title={destination} subtitle={arrivalLabel}
        trailing={
          <span style={{ display: "flex", gap: spacing.sm }}>
            <TrailingPill label="✎" onPress={onEditDestination} />
            <TrailingPill label="+" onPress={onAddStop} />
          </span>
        } />
      <RowDivider />
      <ActionRow icon="👤" title={fare}
        subtitle={`${payment.wallet} · ${payment.brand} ·•••${payment.last4}`}
        trailing={<TrailingPill label="Switch" onPress={onSwitchPayment} />}
        link={loyalty ? { label: "See all benefits", onPress: () => {} } : undefined}
      />
      {loyalty ? (
        <div style={{ ...t(typography.metadata), color: rideDark.muted, paddingLeft: 40, marginTop: -8,
          marginBottom: spacing.sm }}>🟡 {loyalty.benefit}</div>
      ) : null}
      <RowDivider />
      <ActionRow icon="⑂" title="Riding with someone?" trailing={<TrailingPill label="Split fare" onPress={onSplitFare} />} />
      <RowDivider />
      <ActionRow icon="🚗" title="How's the vehicle?" subtitle="Feedback is anonymous."
        trailing={<TrailingPill label="Rate" onPress={onRate} />} />
      <RowDivider />
      <ActionRow icon="📡" title="Share trip status" trailing={<TrailingPill label="Share" onPress={onShare} />} />
      <div style={{ display: "grid", gap: spacing.sm, marginTop: spacing.xl }}>
        <button type="button" onClick={onCancel}
          style={{
            width: "100%", height: 52, borderRadius: radius.pill, border: "none",
            background: rideDark.card, color: rideDark.destructive,
            ...t(typography.bodyStrong), cursor: "pointer",
          }}>Cancel ride</button>
        <button type="button" onClick={onClose}
          style={{
            width: "100%", height: 52, borderRadius: radius.pill, border: "none",
            background: rideDark.fg, color: rideDark.canvas,
            ...t(typography.bodyStrong), cursor: "pointer",
          }}>Close</button>
      </div>
    </div>
  );
}

export function DriverDetailsInterrupt({
  driver, plate, vehicle, tips, tipValue, tipNote,
  onMessage, onCall, onTip, onProfile, onClose,
}: {
  driver: { name: string; rating: string; initial: string };
  plate: string;
  vehicle: string;
  tips: readonly number[];
  tipValue?: number;
  tipNote: string;
  onMessage?: () => void;
  onCall?: () => void;
  onTip?: (n: number) => void;
  onProfile?: () => void;
  onClose?: () => void;
}) {
  return (
    <div style={{ color: rideDark.fg }}>
      <InterruptSheetHeader title="Driver details" onClose={onClose} />
      <div style={{ display: "flex", gap: spacing.lg, alignItems: "start", marginBottom: spacing.lg }}>
        <div>
          <div aria-hidden style={{
            width: 72, height: 72, borderRadius: radius.pill, background: rideDark.cardRaised,
            display: "grid", placeItems: "center", fontSize: 28,
          }}>{driver.initial}</div>
          <div style={{ textAlign: "center", ...t(typography.metadata), marginTop: 4 }}>★ {driver.rating}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "0.04em" }}>{plate}</div>
          <div style={{ ...t(typography.body), color: rideDark.muted, marginTop: 4 }}>
            {driver.name} · {vehicle}
          </div>
        </div>
        <div aria-hidden style={{
          width: 100, height: 56, borderRadius: radius.control, background: rideDark.cardRaised,
          display: "grid", placeItems: "center", fontSize: 28,
        }}>🚗</div>
      </div>
      <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.xl }}>
        <button type="button" onClick={onMessage}
          style={{
            flex: 1, height: 52, borderRadius: radius.pill, border: "none",
            background: rideDark.cardRaised, color: rideDark.fg,
            ...t(typography.bodyStrong), cursor: "pointer",
          }}>💬 Message</button>
        <button type="button" onClick={onCall} aria-label="Call driver"
          style={{
            width: 52, height: 52, borderRadius: radius.pill, border: "none",
            background: rideDark.cardRaised, color: rideDark.fg, fontSize: 20, cursor: "pointer",
          }}>📞</button>
      </div>
      <div style={{ ...t(typography.subhead), marginBottom: spacing.sm }}>Tip {driver.name}?</div>
      <div role="radiogroup" aria-label="Tip amount" style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.sm }}>
        {tips.map((tip) => (
          <button key={tip} type="button" role="radio" aria-checked={tipValue === tip}
            onClick={() => onTip?.(tip)}
            style={{
              flex: 1, height: 48, borderRadius: radius.control, border: `1px solid ${rideDark.border}`,
              background: tipValue === tip ? rideDark.cardRaised : rideDark.card,
              color: rideDark.fg, cursor: "pointer", ...t(typography.bodyStrong),
            }}>${tip}</button>
        ))}
      </div>
      <p style={{ ...t(typography.metadata), color: rideDark.muted, marginBottom: spacing.lg }}>{tipNote}</p>
      <button type="button" onClick={onProfile}
        style={{
          display: "flex", alignItems: "center", gap: spacing.md, width: "100%",
          padding: `${spacing.lg}px 0`, border: "none", borderTop: `1px solid ${rideDark.border}`,
          background: "transparent", color: rideDark.fg, cursor: "pointer", textAlign: "left",
        }}>
        <span aria-hidden>👤</span>
        <span style={{ flex: 1 }}>
          <span style={{ ...t(typography.bodyStrong), display: "block" }}>Driver profile</span>
          <span style={{ ...t(typography.metadata), color: rideDark.muted }}>Get to know {driver.name}</span>
        </span>
        <span aria-hidden>›</span>
      </button>
      <div style={{
        marginTop: spacing.md, padding: spacing.md, borderRadius: radius.card,
        background: rideDark.card, ...t(typography.metadata), color: rideDark.muted,
      }}>
        🏆 Top-rated driver — Thanks to Lime Plus, you got a top-rated driver on this ride.
      </div>
      <button type="button" onClick={onClose}
        style={{
          width: "100%", height: 52, borderRadius: radius.pill, border: "none", marginTop: spacing.xl,
          background: rideDark.fg, color: rideDark.canvas,
          ...t(typography.bodyStrong), cursor: "pointer",
        }}>Close</button>
    </div>
  );
}

function SafetyToolButton({
  glyph, label, emphasis, large, onPress,
}: { glyph: string; label: string; emphasis?: "emergency"; large?: boolean; onPress?: () => void }) {
  return (
    <button type="button" onClick={onPress}
      style={{
        display: "grid", gap: spacing.sm, justifyItems: "start", textAlign: "left",
        padding: large ? spacing.lg : spacing.md, minHeight: large ? 88 : 72,
        borderRadius: radius.card, border: "none", background: rideDark.card,
        color: emphasis === "emergency" ? rideDark.destructive : rideDark.fg,
        cursor: "pointer", font: "inherit", ...t(typography.metadata), fontWeight: 600,
      }}>
      <span aria-hidden style={{ fontSize: large ? 28 : 22 }}>{glyph}</span>
      {label}
    </button>
  );
}

export function SafetyInterrupt({
  tools, protection, onTool, onPreferences, onClose,
}: {
  tools: { id: string; label: string; glyph: string; emphasis?: "emergency" }[];
  protection: { id: string; badge: string; title: string; body: string }[];
  onTool?: (id: string) => void;
  onPreferences?: () => void;
  onClose?: () => void;
}) {
  const [slide, setSlide] = useState(0);
  const item = protection[slide] ?? protection[0];
  return (
    <div style={{ color: rideDark.fg }}>
      <InterruptSheetHeader title="Safety" onClose={onClose} />
      <div style={{ ...t(typography.subhead), marginBottom: spacing.md }}>Safety tools</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.sm, marginBottom: spacing.sm }}>
        {tools.slice(0, 2).map((tool) => (
          <SafetyToolButton key={tool.id} large {...tool} onPress={() => onTool?.(tool.id)} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: spacing.sm, marginBottom: spacing.lg }}>
        {tools.slice(2).map((tool) => (
          <SafetyToolButton key={tool.id} {...tool} onPress={() => onTool?.(tool.id)} />
        ))}
      </div>
      <button type="button" onClick={onPreferences}
        style={{
          display: "flex", alignItems: "center", gap: spacing.md, width: "100%",
          padding: spacing.lg, borderRadius: radius.card, border: "none",
          background: "oklch(0.28 0.06 250)", color: rideDark.fg, cursor: "pointer", textAlign: "left",
          marginBottom: spacing.xl,
        }}>
        <span aria-hidden style={{ fontSize: 24 }}>🛡️</span>
        <span style={{ flex: 1 }}>
          <span style={{ ...t(typography.bodyStrong), display: "block" }}>Set up safety preferences</span>
          <span style={{ ...t(typography.metadata), color: rideDark.muted }}>
            Choose and schedule your favorite safety tools.
          </span>
        </span>
        <span aria-hidden>›</span>
      </button>
      <div style={{ ...t(typography.subhead), marginBottom: spacing.md }}>How you&apos;re protected</div>
      {item ? (
        <div style={{
          padding: spacing.lg, borderRadius: radius.card, background: rideDark.card,
          border: `1px solid ${rideDark.border}`, display: "flex", gap: spacing.md,
        }}>
          <div style={{ flex: 1 }}>
            <span style={{
              ...t(typography.metadata), fontWeight: 600, color: "oklch(0.75 0.12 250)",
              background: "oklch(0.28 0.06 250)", padding: "2px 8px", borderRadius: radius.pill,
            }}>{item.badge}</span>
            <div style={{ ...t(typography.bodyStrong), marginTop: spacing.sm }}>{item.title}</div>
            <div style={{ ...t(typography.metadata), color: rideDark.muted, marginTop: 4 }}>{item.body}</div>
          </div>
          <div aria-hidden style={{
            width: 72, height: 72, borderRadius: radius.control, background: rideDark.cardRaised,
            display: "grid", placeItems: "center", fontSize: 28,
          }}>🗺️</div>
        </div>
      ) : null}
      <div role="tablist" aria-label="Protection slides" style={{ display: "flex", justifyContent: "center",
        gap: 6, marginTop: spacing.md }}>
        {protection.map((p, i) => (
          <button key={p.id} type="button" role="tab" aria-selected={i === slide}
            onClick={() => setSlide(i)}
            style={{
              width: 8, height: 8, borderRadius: radius.pill, border: "none", padding: 0,
              background: i === slide ? rideDark.fg : rideDark.border, cursor: "pointer",
            }} aria-label={`Slide ${i + 1}`} />
        ))}
      </div>
    </div>
  );
}
