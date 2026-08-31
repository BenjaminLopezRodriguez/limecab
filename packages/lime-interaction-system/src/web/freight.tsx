/**
 * Derived from: src/components/freight/freight-parts.tsx, freight-portal-*.tsx
 * Layer: web renderer
 */
import type { ReactNode } from "react";
import { color, radius, spacing } from "../tokens/index.ts";
import { QuotePanel, RouteRail, PrimaryAction, SecondaryAction } from "./primitives.tsx";
import { ChoiceRow, ChoiceList } from "./primitives.tsx";
import { LimeInput } from "./ui.tsx";
import { t, headline, eyebrow } from "./styles.ts";
import { typography } from "../tokens/index.ts";
import type { FreightLoadCard } from "../fixtures/freight.ts";

export function FreightChip({ selected, children, onPress }: {
  selected?: boolean; children: ReactNode; onPress?: () => void;
}) {
  return (
    <button type="button" onClick={onPress} aria-pressed={selected}
      style={{
        borderRadius: radius.pill, padding: `${spacing.sm}px ${spacing.md}px`,
        border: "none", cursor: "pointer", font: "inherit", ...t(typography.metadata), fontWeight: 600,
        background: selected ? color.foreground.light : color.muted.light,
        color: selected ? color.canvas.light : color.foreground.light,
      }}>{children}</button>
  );
}

export function EquipmentRow({ options, selected, onSelect }: {
  options: string[]; selected: string; onSelect?: (v: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Equipment type" style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
      {options.map((o) => (
        <FreightChip key={o} selected={selected === o} onPress={() => onSelect?.(o)}>{o}</FreightChip>
      ))}
    </div>
  );
}

export function LoadResultCard({ load, onSelect }: { load: FreightLoadCard; onSelect?: () => void }) {
  return (
    <button type="button" onClick={onSelect}
      aria-label={`${load.origin} to ${load.destination}, ${load.rateLabel}`}
      style={{
        display: "grid", gap: spacing.sm, width: "100%", textAlign: "left",
        padding: spacing.lg, borderRadius: radius.card, border: `1px solid ${color.border.light}`,
        background: color.panel.light, cursor: "pointer", font: "inherit",
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md }}>
        <span style={t(typography.bodyStrong)}>{load.origin} → {load.destination}</span>
        <span style={{ ...t(typography.bodyStrong), fontVariantNumeric: "tabular-nums" }}>{load.rateLabel}</span>
      </div>
      <div style={{ ...t(typography.metadata), color: color.mutedForeground.light }}>
        {load.distanceLabel} · {load.equipmentLabel} · {load.statusLabel}
      </div>
    </button>
  );
}

export function ShipmentList({ items, onSelect }: {
  items: FreightLoadCard[]; onSelect?: (id: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: spacing.sm }}>
      {items.map((l) => (
        <LoadResultCard key={l.id} load={l} onSelect={() => onSelect?.(l.id)} />
      ))}
    </div>
  );
}

export function FreightQuoteScene({
  lines, total, note, stops, onConfirm,
}: {
  lines: { label: string; value: string }[]; total: string; note?: string;
  stops: { label: string; detail?: string }[]; onConfirm?: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <div style={headline}>Confirm shipment</div>
      <RouteRail stops={stops} />
      <QuotePanel lines={lines} total={total} note={note} />
      <PrimaryAction label="Publish shipment" onPress={onConfirm} />
    </div>
  );
}

export function FreightStatusScene({
  eyebrow: e, headline: h, supporting, progress,
}: { eyebrow?: string; headline: string; supporting?: string; progress?: number }) {
  return (
    <div>
      {e ? <div style={eyebrow}>{e}</div> : null}
      <div style={headline}>{h}</div>
      {supporting ? <div style={{ ...t(typography.body), color: color.mutedForeground.light, marginTop: 4 }}>{supporting}</div> : null}
      {progress !== undefined ? (
        <div style={{ marginTop: spacing.lg, height: 4, borderRadius: radius.pill, background: color.muted.light }}>
          <div style={{ height: "100%", width: `${progress}%`, background: color.lime.light, borderRadius: radius.pill }} />
        </div>
      ) : null}
    </div>
  );
}

/* ── Freight Desk (sibling grammar, not SurfaceManager) ── */

export function DeskShell({ title, tabs, activeTab, children }: {
  title: string; tabs: string[]; activeTab: string; children: ReactNode;
}) {
  return (
    <div style={{ width: 1280, minHeight: 600, background: color.canvas.light, fontFamily: "system-ui",
      border: `1px solid ${color.border.light}`, borderRadius: radius.sheet, overflow: "hidden" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: `${spacing.lg}px ${spacing.xl}px`, borderBottom: `1px solid ${color.border.light}`,
        background: color.panel.light }}>
        <div style={t(typography.headline)}>{title}</div>
        <nav aria-label="Desk navigation" style={{ display: "flex", gap: spacing.sm }}>
          {tabs.map((tab) => (
            <button key={tab} type="button" aria-current={tab === activeTab ? "page" : undefined}
              style={{
                padding: `${spacing.sm}px ${spacing.lg}px`, borderRadius: radius.pill, border: "none",
                background: tab === activeTab ? color.foreground.light : color.muted.light,
                color: tab === activeTab ? color.canvas.light : color.foreground.light,
                cursor: "pointer", font: "inherit", ...t(typography.metadata), fontWeight: 600,
              }}>{tab}</button>
          ))}
        </nav>
      </header>
      <main style={{ padding: spacing.xl }}>{children}</main>
    </div>
  );
}

export function DeskSearchPanel({ onSearch }: { onSearch?: () => void }) {
  return (
    <div style={{ display: "grid", gap: spacing.lg, maxWidth: 640 }}>
      <div style={headline}>Find loads</div>
      <LimeInput placeholder="Origin" aria-label="Origin" />
      <LimeInput placeholder="Destination" aria-label="Destination" />
      <EquipmentRow options={["Dry van", "Reefer", "Flatbed"]} selected="Dry van" />
      <PrimaryAction label="Search" onPress={onSearch} />
    </div>
  );
}

export function DeskLoadDetail({ load }: {
  load: { id: string; origin: string; destination: string; rate: string; rpm: string;
    equipment: string; weight: string; pickup: string; delivery: string; miles: number };
}) {
  return (
    <div style={{ display: "grid", gap: spacing.lg, maxWidth: 720 }}>
      <div>
        <div style={eyebrow}>Load {load.id}</div>
        <div style={headline}>{load.origin} → {load.destination}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.md }}>
        {[
          ["Rate", load.rate], ["RPM", load.rpm], ["Equipment", load.equipment],
          ["Weight", load.weight], ["Pickup", load.pickup], ["Delivery", load.delivery],
        ].map(([k, v]) => (
          <div key={k}>
            <div style={{ ...t(typography.metadata), color: color.mutedForeground.light }}>{k}</div>
            <div style={t(typography.bodyStrong)}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: spacing.sm }}>
        <PrimaryAction label="Book load" />
        <SecondaryAction label="Save lane" />
      </div>
    </div>
  );
}

export function DeskFleetTable({ vehicles }: {
  vehicles: { id: string; unit: string; plate: string; status: string }[];
}) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", ...t(typography.body) }}>
      <thead>
        <tr style={{ textAlign: "left", borderBottom: `1px solid ${color.border.light}` }}>
          {["Unit", "Plate", "Status"].map((h) => (
            <th key={h} style={{ padding: spacing.md, ...t(typography.metadata),
              color: color.mutedForeground.light }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {vehicles.map((v) => (
          <tr key={v.id} style={{ borderBottom: `1px solid ${color.border.light}` }}>
            <td style={{ padding: spacing.md }}>{v.unit}</td>
            <td style={{ padding: spacing.md }}>{v.plate}</td>
            <td style={{ padding: spacing.md }}>{v.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DeskLanesList({ lanes }: {
  lanes: { id: string; origin: string; destination: string; loads: number }[];
}) {
  return (
    <ChoiceList label="Saved lanes">
      {lanes.map((l) => (
        <ChoiceRow key={l.id} title={`${l.origin} → ${l.destination}`}
          detail={`${l.loads} loads this month`} trailing="→" />
      ))}
    </ChoiceList>
  );
}

export function DeskMyLoads({ loads }: { loads: FreightLoadCard[] }) {
  return <ShipmentList items={loads} />;
}
