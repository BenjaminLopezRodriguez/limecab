/**
 * Derived from: src/components/service-app/{service-grid,saved-places,configure-scene}.tsx
 * Layer: web renderer
 */
import type { ReactNode } from "react";
import { color, radius, spacing } from "../tokens/index.ts";
import { ChoiceGlyph, ChoiceList, ChoiceRow } from "./primitives.tsx";
import { t } from "./styles.ts";
import { typography } from "../tokens/index.ts";

export type ServiceItem = {
  id: string;
  title: string;
  description: string;
  glyph: string;
  status: "available" | "unavailable";
  meta?: { value?: string; note?: string };
};

export function ServiceGrid({
  services, variant = "grid", selectedId, onSelect, columns = 2,
}: {
  services: ServiceItem[];
  variant?: "grid" | "list";
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  columns?: 1 | 2 | 3;
}) {
  if (variant === "list") {
    return (
      <ChoiceList label="Services">
        {services.map((s) => {
          const available = s.status === "available";
          const selected = selectedId === s.id;
          return (
            <ChoiceRow key={s.id} glyph={s.glyph} title={s.title}
              detail={available ? s.description : "Coming soon"}
              trailing={available && s.meta?.value ? s.meta.value : undefined}
              selected={selected} disabled={!available}
              onSelect={() => onSelect?.(s.id)} />
          );
        })}
      </ChoiceList>
    );
  }
  return (
    <div role="list" aria-label="Services"
      style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: spacing.sm }}>
      {services.map((s) => {
        const available = s.status === "available";
        return (
          <button key={s.id} type="button" role="listitem"
            disabled={!available} onClick={() => onSelect?.(s.id)}
            aria-label={`${s.title}. ${available ? s.description : "Coming soon"}`}
            style={{
              display: "grid", gap: spacing.sm, padding: spacing.lg, textAlign: "left",
              borderRadius: radius.card, border: `1px solid ${color.border.light}`,
              background: color.panel.light, cursor: available ? "pointer" : "not-allowed",
              opacity: available ? 1 : 0.5, font: "inherit",
            }}>
            <ChoiceGlyph selected={selectedId === s.id}>{s.glyph}</ChoiceGlyph>
            <span style={t(typography.bodyStrong)}>{s.title}</span>
            <span style={{ ...t(typography.metadata), color: color.mutedForeground.light }}>{s.description}</span>
          </button>
        );
      })}
    </div>
  );
}

export type PlaceItem = { id: string; label: string; address: string; glyph?: string };

export function SavedPlaces({
  places, variant = "chips", onSelect,
}: { places: PlaceItem[]; variant?: "chips" | "rows"; onSelect?: (id: string) => void }) {
  if (variant === "rows") {
    return (
      <ChoiceList label="Saved places">
        {places.map((p) => (
          <ChoiceRow key={p.id} glyph={p.glyph ?? "📍"} title={p.label} detail={p.address}
            onSelect={() => onSelect?.(p.id)} />
        ))}
      </ChoiceList>
    );
  }
  return (
    <div role="list" aria-label="Saved places" style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
      {places.map((p) => (
        <button key={p.id} type="button" role="listitem" onClick={() => onSelect?.(p.id)}
          style={{
            display: "inline-flex", alignItems: "center", gap: spacing.sm,
            padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.pill,
            border: `1px solid ${color.border.light}`, background: color.muted.light,
            cursor: "pointer", font: "inherit", ...t(typography.metadata),
          }}>
          {p.glyph ? <span aria-hidden>{p.glyph}</span> : null}
          {p.label}
        </button>
      ))}
    </div>
  );
}

export type ConfigureOption = {
  id: string;
  label: string;
  kind: "toggle" | "stepper" | "segmented";
  value: boolean | number | string;
  choices?: { id: string; label: string }[];
};

export function ConfigureScene({
  options, onChange,
}: { options: ConfigureOption[]; onChange?: (id: string, value: boolean | number | string) => void }) {
  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      {options.map((opt) => (
        <div key={opt.id}>
          <div style={{ ...t(typography.bodyStrong), marginBottom: spacing.sm }}>{opt.label}</div>
          {opt.kind === "toggle" ? (
            <button type="button" role="switch" aria-checked={Boolean(opt.value)}
              onClick={() => onChange?.(opt.id, !opt.value)}
              style={{
                width: 52, height: 32, borderRadius: radius.pill, border: "none", padding: 2,
                background: opt.value ? color.foreground.light : color.muted.light, cursor: "pointer",
              }}>
              <span style={{ display: "block", width: 28, height: 28, borderRadius: radius.pill,
                background: color.panel.light, transform: opt.value ? "translateX(20px)" : "none",
                transition: "transform 180ms ease" }} />
            </button>
          ) : opt.kind === "segmented" && opt.choices ? (
            <div role="radiogroup" aria-label={opt.label} style={{ display: "flex", gap: spacing.sm }}>
              {opt.choices.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={opt.value === c.id}
                  onClick={() => onChange?.(opt.id, c.id)}
                  style={{
                    flex: 1, padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.pill,
                    border: `1px solid ${color.border.light}`,
                    background: opt.value === c.id ? color.foreground.light : color.muted.light,
                    color: opt.value === c.id ? color.canvas.light : color.foreground.light,
                    cursor: "pointer", font: "inherit", ...t(typography.metadata),
                  }}>{c.label}</button>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
              <button type="button" aria-label="Decrease" onClick={() => onChange?.(opt.id, Number(opt.value) - 1)}
                style={{ width: 40, height: 40, borderRadius: radius.pill, border: `1px solid ${color.border.light}`,
                  background: color.panel.light, cursor: "pointer", fontSize: 18 }}>−</button>
              <span style={{ ...t(typography.bodyStrong), minWidth: 24, textAlign: "center" }}>{opt.value}</span>
              <button type="button" aria-label="Increase" onClick={() => onChange?.(opt.id, Number(opt.value) + 1)}
                style={{ width: 40, height: 40, borderRadius: radius.pill, border: `1px solid ${color.border.light}`,
                  background: color.panel.light, cursor: "pointer", fontSize: 18 }}>+</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div role="status" style={{ padding: spacing.xl, borderRadius: radius.card,
      background: color.muted.light, textAlign: "center" }}>
      <div style={t(typography.subhead)}>{title}</div>
      {body ? <div style={{ ...t(typography.body), color: color.mutedForeground.light, marginTop: spacing.sm }}>{body}</div> : null}
      {action ? <div style={{ marginTop: spacing.lg }}>{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title, body, onRetry }: { title: string; body?: string; onRetry?: () => void }) {
  return (
    <div role="alert" style={{ padding: spacing.xl, borderRadius: radius.card,
      border: `1px solid ${color.destructive.light}`, background: color.panel.light }}>
      <div style={{ ...t(typography.subhead), color: color.destructive.light }}>{title}</div>
      {body ? <div style={{ ...t(typography.body), marginTop: spacing.sm }}>{body}</div> : null}
      {onRetry ? (
        <button type="button" onClick={onRetry} style={{ marginTop: spacing.md, ...t(typography.bodyStrong),
          border: "none", background: "transparent", color: color.foreground.light, cursor: "pointer",
          textDecoration: "underline" }}>Try again</button>
      ) : null}
    </div>
  );
}
