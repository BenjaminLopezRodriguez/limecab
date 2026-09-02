/**
 * Rider scene projections — composed from lab primitives, not production containers.
 * Derived from: src/components/limecab/limecab-*-scene.tsx
 */
import { useState } from "react";
import { color, radius, spacing } from "../../tokens/index.ts";
import {
  ChoiceList, ChoiceRow, LocationTrigger, MapRouteBar, QuotePanel,
  CompletionPanel, PrimaryAction, SecondaryAction, RouteRail,
} from "../primitives.tsx";
import { ServiceGrid, SavedPlaces } from "../lists.tsx";
import { ServiceStatusPanel, VoiceBanner } from "../status.tsx";
import { PickupPointPicker } from "../location.tsx";
import { TipPanel } from "../profile.tsx";
import { headline, t, bodyMuted } from "../styles.ts";
import { typography } from "../../tokens/index.ts";
import type { RideTier, SavedPlace, ServiceTile } from "../../fixtures/rider.ts";
import {
  RIDER_PICKUP, RIDER_DESTINATION, RIDER_ROUTE, QUOTE_LINES, DRIVER,
  TRIP_MILESTONES, COMPLETION, PAYMENT, PICKUP_SPOTS,
} from "../../fixtures/rider.ts";

export function RiderHomeScene({
  destination, saved, recents, traveling, services, onSearch, onSelectPlace, onSelectService,
}: {
  destination?: string;
  saved: SavedPlace[];
  recents: SavedPlace[];
  traveling?: boolean;
  services?: ServiceTile[];
  onSearch?: () => void;
  onSelectPlace?: (id: string) => void;
  onSelectService?: (id: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      {traveling ? <h2 style={headline}>In Los Angeles</h2> : null}
      <LocationTrigger value={destination} placeholder="Where to?" onPress={onSearch} />
      <p style={{ ...bodyMuted, margin: 0, fontSize: typography.metadata.size }}>Ride, send, or get</p>
      <SavedPlaces places={saved} onSelect={onSelectPlace} />
      {recents.length ? (
        <SavedPlaces places={recents} variant="rows" onSelect={onSelectPlace} />
      ) : null}
      {services ? <ServiceGrid services={services} onSelect={onSelectService} /> : null}
      <VoiceBanner state="idle" />
    </div>
  );
}

export function RiderRideSelectScene({
  tiers, selectedId, payment, onSelect, onConfirm, onOpenPayment,
}: {
  tiers: RideTier[];
  selectedId?: string;
  payment: { label: string; detail: string };
  onSelect?: (id: string) => void;
  onConfirm?: () => void;
  onOpenPayment?: () => void;
}) {
  const selected = tiers.find((t) => t.id === selectedId);
  const ready = Boolean(selected);
  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <h2 style={headline}>Choose a ride</h2>
      <ChoiceList label="Ride options" role="list">
        {tiers.map((row) => (
          <ChoiceRow key={row.id} role="button" glyph={rowGlyph[row.glyph]} title={row.title}
            titleAffix={`${row.seats} seats`} badge={row.badge} detail={row.detail}
            trailing={formatFare(row.fareCents)} selected={selectedId === row.id}
            onSelect={() => onSelect?.(row.id)} />
        ))}
      </ChoiceList>
      {ready ? (
        <>
          <button type="button" onClick={onOpenPayment} aria-label={`Payment: ${payment.detail}. Change`}
            style={{ display: "flex", alignItems: "center", gap: spacing.md, border: "none",
              background: "transparent", cursor: "pointer", font: "inherit", textAlign: "left" }}>
            <span aria-hidden>💳</span>
            <span style={{ flex: 1 }}>
              <span style={t(typography.bodyStrong)}>{payment.label}</span>
              <span style={{ ...t(typography.metadata), display: "block", color: color.mutedForeground.light }}>
                {payment.detail}
              </span>
            </span>
            <span style={t(typography.metadata)}>Change</span>
          </button>
          <PrimaryAction label={`Confirm ${selected.title} · ${formatFare(selected.fareCents)}`} onPress={onConfirm} />
        </>
      ) : null}
    </div>
  );
}

const rowGlyph: Record<RideTier["glyph"], string> = {
  car: "⌁",
  clock: "◷",
  people: "♙",
  sparkle: "✧",
};

const formatFare = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function RiderQuoteScene({
  pickup, destination, route, lines, total, payment, onConfirm,
}: {
  pickup: string; destination: string;
  route: { miles: number; minutes: number };
  lines: { label: string; value: string }[];
  total: string;
  payment: { label: string; detail: string };
  onConfirm?: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <h2 style={headline}>Your ride</h2>
      <RouteRail stops={[
        { label: pickup, detail: "Pickup" },
        { label: destination, detail: `${route.miles} mi · ${route.minutes} min` },
      ]} />
      <QuotePanel lines={lines} total={total} note="Price may change if route or traffic changes." />
      <div style={{ ...t(typography.metadata), color: color.mutedForeground.light }}>
        {payment.label} · {payment.detail}
      </div>
      <PrimaryAction label="Confirm pickup" onPress={onConfirm} />
    </div>
  );
}

export function RiderConfirmPickupScene({
  address, spots, selectedId, onSelectSpot, onConfirm, onSearch,
}: {
  address: string;
  spots: { id: string; label: string; detail?: string }[];
  selectedId?: string;
  onSelectSpot?: (id: string) => void;
  onConfirm?: () => void;
  onSearch?: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <h2 style={headline}>Confirm pickup</h2>
      <MapRouteBar origin={address} destination="Adjust on map" onEdit={onSearch} />
      <PickupPointPicker spots={spots} selectedId={selectedId} onSelect={onSelectSpot} />
      <PrimaryAction label="Confirm pickup" onPress={onConfirm} disabled={!selectedId} />
    </div>
  );
}

export function RiderStatusScene({
  status = "matching", cancellable, onCancel,
}: {
  status?: "matching" | "assigned" | "arriving" | "in_ride";
  cancellable?: boolean;
  onCancel?: () => void;
}) {
  const copy = {
    matching: { eyebrow: "Finding a driver", headline: "Matching your ride", eta: "—" },
    assigned: { eyebrow: "Driver assigned", headline: "Arriving in 4 min", eta: "4 min" },
    arriving: { eyebrow: "Driver arriving", headline: "Meet at the curb", eta: "1 min" },
    in_ride: { eyebrow: "On trip", headline: "En route to destination", eta: "12 min" },
  }[status];
  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <ServiceStatusPanel
        eyebrow={copy.eyebrow} headline={copy.headline}
        supporting={`${RIDER_PICKUP} → ${RIDER_DESTINATION}`}
        eta={{ label: "ETA", value: copy.eta, hero: status !== "matching" }}
        milestones={TRIP_MILESTONES}
        milestoneIndex={status === "matching" ? 0 : status === "assigned" ? 2 : status === "arriving" ? 2 : 3}
        provider={status !== "matching" ? DRIVER : undefined}
      />
      {cancellable ? <SecondaryAction label="Cancel ride" onPress={onCancel} /> : null}
    </div>
  );
}

export function RiderCompleteScene({
  rating, tip, onRate, onTip, onDone,
}: {
  rating?: number; tip?: number;
  onRate?: (n: number) => void;
  onTip?: (n: number) => void;
  onDone?: () => void;
}) {
  const [stars, setStars] = useState(rating ?? 0);
  const [tipVal, setTipVal] = useState(tip ?? 0);
  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <CompletionPanel headline={COMPLETION.headline} total={COMPLETION.total} lines={COMPLETION.lines} />
      <div role="radiogroup" aria-label="Rate your trip" style={{ display: "flex", gap: spacing.sm }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n}
            onClick={() => { setStars(n); onRate?.(n); }}
            style={{ border: "none", background: "transparent", fontSize: 28, cursor: "pointer",
              opacity: n <= stars ? 1 : 0.3 }}>★</button>
        ))}
      </div>
      <TipPanel value={tipVal} onChange={(v: number) => { setTipVal(v); onTip?.(v); }} />
      <PrimaryAction label="Done" onPress={onDone} />
    </div>
  );
}

/** Convenience defaults for Storybook. */
export const riderSceneDefaults = {
  home: { destination: undefined, saved: [] as SavedPlace[], recents: [] as SavedPlace[] },
  rideSelect: { tiers: [] as RideTier[], payment: PAYMENT },
  quote: { pickup: RIDER_PICKUP, destination: RIDER_DESTINATION, route: RIDER_ROUTE,
    lines: QUOTE_LINES, total: "$22.90", payment: PAYMENT },
  confirmPickup: { address: RIDER_PICKUP, spots: PICKUP_SPOTS },
};
