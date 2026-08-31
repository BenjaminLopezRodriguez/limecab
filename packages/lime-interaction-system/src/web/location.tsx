/**
 * Derived from: src/components/service-app/{location-search,location-pin-scene,saved-places}.tsx
 * Layer: web renderer
 */
import type { ReactNode } from "react";
import { color, radius, spacing } from "../tokens/index.ts";
import { LocationTrigger, MapRouteBar, PrimaryAction, RouteRail } from "./primitives.tsx";
import { LimeInput } from "./ui.tsx";
import { ChoiceList, ChoiceRow } from "./primitives.tsx";
import { t, headline } from "./styles.ts";
import { typography } from "../tokens/index.ts";

export type SearchResult = { id: string; title: string; subtitle?: string; glyph?: string };

export function LocationSearch({
  query, placeholder = "Search", results, loading, error, onQueryChange, onSelect,
}: {
  query?: string; placeholder?: string; results: SearchResult[];
  loading?: boolean; error?: string;
  onQueryChange?: (q: string) => void; onSelect?: (id: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: spacing.md }}>
      <LimeInput search value={query} placeholder={placeholder} error={error}
        onChange={onQueryChange} aria-label="Search location" />
      {loading ? (
        <div role="status" aria-label="Loading results" style={{ ...t(typography.metadata),
          color: color.mutedForeground.light }}>Searching…</div>
      ) : results.length === 0 && query ? (
        <div role="status" style={{ ...t(typography.body), color: color.mutedForeground.light }}>
          No results for "{query}"
        </div>
      ) : (
        <ChoiceList label="Search results">
          {results.map((r) => (
            <ChoiceRow key={r.id} glyph={r.glyph ?? "📍"} title={r.title} detail={r.subtitle}
              onSelect={() => onSelect?.(r.id)} />
          ))}
        </ChoiceList>
      )}
    </div>
  );
}

export function LocationSearchScene({
  title = "Where to?", route, query, results, onQueryChange, onSelect, onDismiss, onChooseOnMap,
}: {
  title?: string;
  route?: { origin: string; destination: string };
  query?: string; results: SearchResult[];
  onQueryChange?: (q: string) => void; onSelect?: (id: string) => void;
  onDismiss?: () => void; onChooseOnMap?: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
        {onDismiss ? (
          <button type="button" onClick={onDismiss} aria-label="Back"
            style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer" }}>←</button>
        ) : null}
        <div style={headline}>{title}</div>
      </div>
      {route ? <MapRouteBar origin={route.origin} destination={route.destination} /> : null}
      <LocationSearch query={query} results={results} onQueryChange={onQueryChange} onSelect={onSelect} />
      {onChooseOnMap ? (
        <button type="button" onClick={onChooseOnMap}
          style={{ ...t(typography.bodyStrong), border: "none", background: "transparent",
            color: color.foreground.light, cursor: "pointer", textAlign: "left" }}>
          Choose on map
        </button>
      ) : null}
    </div>
  );
}

export function LocationPinScene({
  title, address, confirmLabel = "Confirm", onConfirm, secondary,
}: {
  title: string; address: string; confirmLabel?: string;
  onConfirm?: () => void; secondary?: ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <div aria-hidden style={{ height: 120, borderRadius: radius.card, background: color.muted.light,
        display: "grid", placeItems: "center", fontSize: 32 }}>📍</div>
      <div>
        <div style={headline}>{title}</div>
        <div style={{ ...t(typography.body), color: color.mutedForeground.light, marginTop: 4 }}>{address}</div>
      </div>
      <PrimaryAction label={confirmLabel} onPress={onConfirm} />
      {secondary}
    </div>
  );
}

export function PickupPointPicker({
  spots, selectedId, onSelect,
}: {
  spots: { id: string; label: string; detail?: string }[];
  selectedId?: string; onSelect?: (id: string) => void;
}) {
  return (
    <ChoiceList label="Pickup point">
      {spots.map((s) => (
        <ChoiceRow key={s.id} title={s.label} detail={s.detail}
          selected={selectedId === s.id} onSelect={() => onSelect?.(s.id)} />
      ))}
    </ChoiceList>
  );
}

export function LocationPinMarker({ name, locating }: { name?: string; locating?: boolean }) {
  return (
    <div aria-hidden style={{ display: "grid", placeItems: "center", gap: 4 }}>
      <div style={{ width: 4, height: 24, background: color.foreground.light, borderRadius: 2 }} />
      <div style={{ width: 16, height: 16, borderRadius: 999, border: `3px solid ${color.panel.light}`,
        background: locating ? color.mutedForeground.light : color.lime.light,
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }} />
      {name ? <span style={{ ...t(typography.metadata), background: color.panel.light,
        padding: "2px 8px", borderRadius: radius.mapLabel }}>{name}</span> : null}
    </div>
  );
}

export { RouteRail };
