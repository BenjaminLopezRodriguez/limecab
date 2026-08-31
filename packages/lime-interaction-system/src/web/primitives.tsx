import type { CSSProperties, ReactNode } from "react";
import { color, radius, spacing, surface, typography, elevation } from "../tokens/index.ts";

/**
 * Derived from: src/components/service-app/{choice-list,location-trigger,map-route-bar,
 *               quote-panel,provider-card,completion-panel,live-sheet,surface-skeleton,
 *               confirm-action-surface}.tsx
 *
 * Preserved: the interaction behaviour — selection affordance, dominant-action placement,
 *            progressive disclosure, the read-only vs pickable row distinction.
 *
 * Removed:   next/link, @/lib/utils cn(), hugeicons, Tailwind class strings, tRPC, Trip and
 *            Quote production entities. Every value now comes from tokens/, so a token edit
 *            visibly moves the whole system — which is the point of the lab.
 *
 * Platform status: web renderer.
 */

const t = (s: typeof typography[keyof typeof typography]): CSSProperties => ({
  fontSize: s.size, fontWeight: s.weight, letterSpacing: `${s.letterSpacing}em`,
});
const row: CSSProperties = {
  display: "flex", alignItems: "center", gap: spacing.md,
  width: "100%", padding: `${spacing.md}px ${spacing.xl}px`,
  textAlign: "left", border: "none", background: "transparent", cursor: "pointer",
  font: "inherit", position: "relative", overflow: "hidden",
};

/* ── Decision ─────────────────────────────────────────────────────────────── */

/** Full-bleed to the sheet gutter — no ring, no dividers. Ride select is the reference. */
export function ChoiceList({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul role={label ? "radiogroup" : undefined} aria-label={label}
      style={{ listStyle: "none", margin: `0 -${spacing.xl}px`, padding: 0,
        display: "flex", flexDirection: "column" }}>
      {children}
    </ul>
  );
}

export function ChoiceRow({
  glyph, title, detail, trailing, selected, disabled, disabledReason, onSelect,
}: {
  glyph?: ReactNode; title: string; detail?: string; trailing?: ReactNode;
  selected?: boolean; disabled?: boolean; disabledReason?: string; onSelect?: () => void;
}) {
  return (
    <li>
      <button
        type="button" role="radio" aria-checked={Boolean(selected)}
        aria-disabled={disabled || undefined} disabled={disabled} onClick={onSelect}
        title={disabled ? disabledReason : undefined}
        style={{
          ...row,
          background: selected ? color.accent.light : "transparent",
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {/* Selection reads as a rule at the leading edge, not a checkmark. */}
        {selected ? (
          <span aria-hidden style={{ position: "absolute", insetBlock: 0, left: 0,
            width: 4, background: color.foreground.light }} />
        ) : null}
        {glyph ? <ChoiceGlyph selected={selected}>{glyph}</ChoiceGlyph> : null}
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ ...t(typography.bodyStrong), display: "block",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          {detail ? (
            <span style={{ ...t(typography.metadata), display: "block", marginTop: 2,
              color: color.mutedForeground.light }}>{detail}</span>
          ) : null}
        </span>
        {trailing ? <span style={{ ...t(typography.bodyStrong), flexShrink: 0 }}>{trailing}</span> : null}
      </button>
    </li>
  );
}

export function ChoiceGlyph({ children, selected }: { children: ReactNode; selected?: boolean }) {
  return (
    <span aria-hidden style={{
      width: 48, height: 48, flexShrink: 0, display: "grid", placeItems: "center",
      borderRadius: radius.card, fontSize: 20,
      background: selected ? color.lime.light : color.muted.light,
      color: selected ? color.limeForeground.light : color.foreground.light,
    }}>{children}</span>
  );
}

/* ── Composer ─────────────────────────────────────────────────────────────── */

/** Expresses intent. Reads as a field, behaves as a button — it opens a scene. */
export function LocationTrigger({
  placeholder = "Where to?", value, onPress,
}: { placeholder?: string; value?: string; onPress?: () => void }) {
  return (
    <button type="button" onClick={onPress} style={{
      display: "flex", alignItems: "center", gap: spacing.md, width: "100%",
      height: surface.cta.lg, padding: `0 ${spacing.xl}px`, borderRadius: radius.pill,
      border: "none", background: color.muted.light, cursor: "pointer",
      font: "inherit", textAlign: "left",
      boxShadow: `0 ${elevation.floatingControl.y}px ${elevation.floatingControl.blur}px ${elevation.floatingControl.color}`,
    }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: radius.pill,
        background: color.lime.light, flexShrink: 0 }} />
      <span style={{ ...t(typography.bodyStrong), flex: 1, minWidth: 0,
        color: value ? color.foreground.light : color.mutedForeground.light,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value ?? placeholder}
      </span>
    </button>
  );
}

/* ── Route ────────────────────────────────────────────────────────────────── */

/** Compact itinerary over the canvas — a decision already made, tappable to revise. */
export function MapRouteBar({
  origin, destination, onBack, onEdit,
}: { origin: string; destination: string; onBack?: () => void; onEdit?: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", height: 44, borderRadius: radius.pill,
      background: color.panel.light, border: `1px solid ${color.border.light}`,
      paddingLeft: onBack ? 2 : spacing.md, paddingRight: spacing.md,
      boxShadow: `0 ${elevation.floatingControl.y}px ${elevation.floatingControl.blur}px ${elevation.floatingControl.color}`,
    }}>
      {onBack ? (
        <button type="button" onClick={onBack} aria-label="Back" style={{
          width: 44, height: 44, flexShrink: 0, display: "grid", placeItems: "center",
          border: "none", background: "transparent", borderRadius: radius.pill,
          cursor: "pointer", fontSize: 18, color: color.foreground.light,
        }}>←</button>
      ) : null}
      <button type="button" onClick={onEdit} style={{
        flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: spacing.sm,
        border: "none", background: "transparent", cursor: onEdit ? "pointer" : "default",
        font: "inherit", padding: 0, textAlign: "left",
      }}>
        <Truncate style={t(typography.metadata)}>{origin}</Truncate>
        <span aria-hidden style={{ color: color.mutedForeground.light, flexShrink: 0 }}>→</span>
        <Truncate style={{ ...t(typography.metadata), fontWeight: 600 }}>{destination}</Truncate>
      </button>
    </div>
  );
}

/** Origin → stops → destination, vertical. Shared by rider and driver. */
export function RouteRail({ stops }: { stops: { label: string; detail?: string }[] }) {
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: spacing.md }}>
      {stops.map((s, i) => {
        const last = i === stops.length - 1;
        return (
          <li key={`${s.label}-${i}`} style={{ display: "flex", gap: spacing.md }}>
            <span aria-hidden style={{ display: "grid", justifyItems: "center", paddingTop: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: last ? 2 : radius.pill,
                background: last ? color.foreground.light : color.lime.light }} />
              {!last ? <span style={{ width: 2, flex: 1, minHeight: 18,
                background: color.border.light, marginTop: 4 }} /> : null}
            </span>
            <span style={{ minWidth: 0 }}>
              <Truncate style={t(typography.body)}>{s.label}</Truncate>
              {s.detail ? <span style={{ ...t(typography.metadata), display: "block",
                color: color.mutedForeground.light }}>{s.detail}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Status / live job ────────────────────────────────────────────────────── */

export function LiveSheetHeader({ eyebrow, headline, supporting }: {
  eyebrow?: string; headline: string; supporting?: string;
}) {
  return (
    <div style={{ paddingTop: spacing.sm }}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <div style={t(typography.headline)}>{headline}</div>
      {supporting ? <div style={{ ...t(typography.body), marginTop: 4,
        color: color.mutedForeground.light }}>{supporting}</div> : null}
    </div>
  );
}

/** Who is doing the work. Rider-only today — deliberately not generalized. */
export function ProviderCard({ name, vehicle, plate, rating }: {
  name: string; vehicle: string; plate: string; rating?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: spacing.md,
      padding: `${spacing.md}px 0` }}>
      <span aria-hidden style={{ width: 48, height: 48, borderRadius: radius.pill,
        background: color.muted.light, display: "grid", placeItems: "center",
        ...t(typography.bodyStrong) }}>{name.charAt(0)}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <Truncate style={t(typography.bodyStrong)}>{name}</Truncate>
        <span style={{ ...t(typography.metadata), display: "block",
          color: color.mutedForeground.light }}>{vehicle}{rating ? ` · ${rating}★` : ""}</span>
      </span>
      <span style={{ ...t(typography.metadata), fontWeight: 600, letterSpacing: "0.06em",
        padding: `4px ${spacing.sm}px`, borderRadius: radius.mapLabel,
        background: color.muted.light, flexShrink: 0 }}>{plate}</span>
    </div>
  );
}

/* ── Quote / completion ───────────────────────────────────────────────────── */

export function QuotePanel({ lines, total, note }: {
  lines: { label: string; value: string }[]; total: string; note?: string;
}) {
  return (
    <div style={{ display: "grid", gap: spacing.sm, paddingTop: spacing.sm }}>
      {lines.map((l) => (
        <div key={l.label} style={{ display: "flex", justifyContent: "space-between",
          ...t(typography.body) }}>
          <span style={{ color: color.mutedForeground.light }}>{l.label}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{l.value}</span>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: spacing.xs,
        paddingTop: spacing.md, borderTop: `1px solid ${color.border.light}`,
        ...t(typography.subhead) }}>
        <span>Total</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{total}</span>
      </div>
      {note ? <div style={{ ...t(typography.metadata),
        color: color.mutedForeground.light }}>{note}</div> : null}
    </div>
  );
}

/** Terminal acknowledgement before returning to ambient. */
export function CompletionPanel({ headline, total, lines }: {
  headline: string; total: string; lines?: { label: string; value: string }[];
}) {
  return (
    <div style={{ display: "grid", gap: spacing.md, paddingTop: spacing.md }}>
      <div>
        <Eyebrow>{headline}</Eyebrow>
        <div style={{ ...t(typography.headlineXl), fontVariantNumeric: "tabular-nums" }}>{total}</div>
      </div>
      {lines?.length ? (
        <div style={{ display: "grid", gap: spacing.xs }}>
          {lines.map((l) => (
            <div key={l.label} style={{ display: "flex", justifyContent: "space-between",
              ...t(typography.metadata), color: color.mutedForeground.light }}>
              <span>{l.label}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{l.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ── Actions ──────────────────────────────────────────────────────────────── */

/** The dominant action. One per surface — enforced by tests/invariants.test.ts. */
export function PrimaryAction({ label, loading, disabled, destructive, onPress }: {
  label: string; loading?: boolean; disabled?: boolean; destructive?: boolean; onPress?: () => void;
}) {
  return (
    <button type="button" onClick={onPress} disabled={disabled || loading}
      aria-busy={loading || undefined}
      style={{
        width: "100%", height: surface.cta.default, borderRadius: radius.pill, border: "none",
        background: destructive ? color.destructive.light : color.foreground.light,
        color: color.canvas.light, ...t(typography.cta), cursor: "pointer",
        opacity: disabled ? 0.4 : 1,
      }}>
      {loading ? "…" : label}
    </button>
  );
}

export function SecondaryAction({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <button type="button" onClick={onPress} style={{
      width: "100%", height: surface.cta.default, borderRadius: radius.pill,
      border: `1px solid ${color.border.light}`, background: "transparent",
      color: color.foreground.light, ...t(typography.cta), cursor: "pointer",
    }}>{label}</button>
  );
}

/** Consequential transition. Confirm is dominant; cancel must stay reachable. */
export function ConfirmActionSurface({ headline, body, confirmLabel, onConfirm, onCancel, destructive }: {
  headline: string; body?: string; confirmLabel: string;
  onConfirm?: () => void; onCancel?: () => void; destructive?: boolean;
}) {
  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <div>
        <div style={t(typography.headline)}>{headline}</div>
        {body ? <div style={{ ...t(typography.body), marginTop: 4,
          color: color.mutedForeground.light }}>{body}</div> : null}
      </div>
      <div style={{ display: "grid", gap: spacing.sm }}>
        <PrimaryAction label={confirmLabel} destructive={destructive} onPress={onConfirm} />
        <SecondaryAction label="Never mind" onPress={onCancel} />
      </div>
    </div>
  );
}

/* ── Loading ──────────────────────────────────────────────────────────────── */

/** Holds the shape of what is coming, so arrival is not a layout jump. */
export function SurfaceSkeleton({ rows = 3, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} style={{ display: "grid", gap: spacing.md,
      paddingTop: spacing.md }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{
          height: i === 0 ? 24 : 16, width: i === 0 ? "60%" : i === rows - 1 ? "40%" : "85%",
          borderRadius: radius.mapLabel, background: color.muted.light,
          animation: "sk 1400ms ease-in-out infinite alternate", animationDelay: `${i * 150}ms`,
        }} />
      ))}
      <style>{`@keyframes sk { to { opacity: .45 } }
        @media (prefers-reduced-motion: reduce) { [role=status] > div { animation: none } }`}</style>
    </div>
  );
}

/* ── shared bits ──────────────────────────────────────────────────────────── */

function Eyebrow({ children }: { children: ReactNode }) {
  return <div style={{ ...t(typography.eyebrow), textTransform: "uppercase",
    color: color.mutedForeground.light, marginBottom: 6 }}>{children}</div>;
}

function Truncate({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ ...style, display: "block", minWidth: 0, overflow: "hidden",
    textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</span>;
}
