/**
 * Derived from: src/components/service-app/{map-marker,car-marker,pickup-point-marker,
 *   rest-stop-marker,spatial-eta-marker,map-point-marker}.tsx
 * Layer: web renderer — simplified token projections, not Mapbox HTML markers.
 */
import { color, radius } from "../tokens/index.ts";
import { t } from "./styles.ts";
import { typography } from "../tokens/index.ts";

export function MapPin({ label, kind = "default", selected }: {
  label?: string; kind?: "default" | "accent" | "negative"; selected?: boolean;
}) {
  const bg = kind === "accent" ? color.lime.light : kind === "negative" ? color.destructive.light : color.foreground.light;
  const fg = kind === "accent" ? color.limeForeground.light : color.canvas.light;
  return (
    <div role="img" aria-label={label ?? "Map marker"} style={{ display: "grid", justifyItems: "center" }}>
      {label ? (
        <div style={{ ...t(typography.metadata), fontWeight: 600, padding: "4px 10px", borderRadius: radius.pill,
          background: bg, color: fg, marginBottom: 4,
          boxShadow: selected ? `0 0 0 2px ${color.lime.light}` : "0 2px 8px rgba(0,0,0,0.28)" }}>
          {label}
        </div>
      ) : null}
      <div style={{ width: 12, height: 12, borderRadius: 999, background: bg,
        border: `2px solid ${color.panel.light}`, boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }} />
      <div style={{ width: 2, height: 8, background: bg }} />
    </div>
  );
}

export function CarMarker({ heading = 0, size = "md" }: { heading?: number; size?: "sm" | "md" }) {
  const px = size === "sm" ? 20 : 28;
  return (
    <div role="img" aria-label="Vehicle" style={{ width: px, height: px, transform: `rotate(${heading}deg)` }}>
      <svg viewBox="0 0 24 24" width={px} height={px} fill={color.foreground.light}>
        <path d="M5 11l1.5-4h11L19 11v6h-2v-2H7v2H5v-6zm2.5-2.5L7.5 13h9l.5-4.5h-9z" />
      </svg>
    </div>
  );
}

export function PickupPointMarker({ label, detail, selected, onSelect }: {
  label: string; detail?: string; selected?: boolean; onSelect?: () => void;
}) {
  const inner = (
    <div style={{ display: "grid", justifyItems: "center", gap: 2 }}>
      <div style={{ width: selected ? 14 : 10, height: selected ? 14 : 10, borderRadius: 999,
        background: selected ? color.lime.light : color.foreground.light,
        border: `2px solid ${color.panel.light}` }} />
      {label ? <span style={{ ...t(typography.metadata), fontWeight: 600,
        background: color.panel.light, padding: "2px 6px", borderRadius: radius.mapLabel }}>{label}</span> : null}
      {detail ? <span style={{ ...t(typography.metadata), color: color.mutedForeground.light }}>{detail}</span> : null}
    </div>
  );
  return onSelect ? (
    <button type="button" onClick={onSelect} aria-label={`${label}${detail ? `, ${detail}` : ""}`}
      style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0 }}>{inner}</button>
  ) : inner;
}

export function RestStopMarker({ label, category, selected, onSelect }: {
  label: string; category?: "coffee" | "shelter"; selected?: boolean; onSelect?: () => void;
}) {
  const glyph = category === "coffee" ? "☕" : "🏠";
  return (
    <button type="button" onClick={onSelect} aria-label={label} aria-pressed={selected}
      style={{
        display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: radius.card,
        border: `1px solid ${color.border.light}`, background: selected ? color.accent.light : color.panel.light,
        cursor: onSelect ? "pointer" : "default", fontSize: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}>{glyph}</button>
  );
}

export function SpatialEtaMarker({ eta, status, selected }: {
  eta?: string; status: "waiting" | "moving" | "arrived"; selected?: boolean;
}) {
  const colors = { waiting: color.mutedForeground.light, moving: color.lime.light, arrived: color.foreground.light };
  return (
    <div role="status" aria-label={eta ? `ETA ${eta}` : status}
      style={{
        padding: "4px 10px", borderRadius: radius.pill, background: color.panel.light,
        border: `2px solid ${selected ? color.lime.light : colors[status]}`,
        ...t(typography.metadata), fontWeight: 600, fontVariantNumeric: "tabular-nums",
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
      }}>
      {eta ?? status}
    </div>
  );
}

export function MapMarkerGallery() {
  const items = [
    { node: <MapPin label="Origin" kind="accent" />, name: "Origin pin" },
    { node: <MapPin label="Drop-off" />, name: "Destination pin" },
    { node: <CarMarker heading={45} />, name: "Vehicle" },
    { node: <PickupPointMarker label="Curbside" selected />, name: "Pickup point" },
    { node: <RestStopMarker label="Coffee" category="coffee" />, name: "Rest stop" },
    { node: <SpatialEtaMarker eta="4 min" status="moving" />, name: "Spatial ETA" },
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "end" }}>
      {items.map((i) => (
        <div key={i.name} style={{ textAlign: "center" }}>
          {i.node}
          <div style={{ ...t(typography.metadata), marginTop: 8, color: color.mutedForeground.light }}>{i.name}</div>
        </div>
      ))}
    </div>
  );
}
