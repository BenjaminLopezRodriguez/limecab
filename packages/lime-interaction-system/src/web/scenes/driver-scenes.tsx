/**
 * Driver scene projections.
 * Derived from: src/components/limecab/driver-scenes.tsx
 */
import { color, radius, spacing } from "../../tokens/index.ts";
import { PrimaryAction, SecondaryAction, RouteRail, ProviderCard } from "../primitives.tsx";
import { MapFloatingButton } from "../ui.tsx";
import { RestStopMarker } from "../map.tsx";
import { headline, eyebrow, t } from "../styles.ts";
import { typography } from "../../tokens/index.ts";
import type { DriverOffer } from "../../fixtures/driver.ts";
import { DRIVER_OFFER, EARNINGS_TRIP, REST_STOPS, TREND_BARS } from "../../fixtures/driver.ts";

export const DRIVER_TAB_HEIGHT = 56;

export function DriverTabBar({ active, tabs }: { active: string; tabs: readonly string[] }) {
  return (
    <nav aria-label="Driver tabs" style={{
      display: "flex", height: DRIVER_TAB_HEIGHT, borderTop: `1px solid ${color.border.light}`,
      background: color.panel.light,
    }}>
      {tabs.map((tab) => (
        <button key={tab} type="button" aria-current={tab === active ? "page" : undefined}
          style={{
            flex: 1, border: "none", background: "transparent", cursor: "pointer", font: "inherit",
            ...t(typography.metadata), fontWeight: tab === active ? 600 : 400,
            color: tab === active ? color.foreground.light : color.mutedForeground.light,
          }}>{tab}</button>
      ))}
    </nav>
  );
}

export function DriverOfflineScene({ areaLabel = "Ontario", onGoOnline }: {
  areaLabel?: string; onGoOnline?: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: spacing.xl }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing.sm }}>
        <MapFloatingButton label="Safety toolkit">🛡️</MapFloatingButton>
        <MapFloatingButton label="Preferences">⚙️</MapFloatingButton>
      </div>
      <div>
        <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.04em", margin: 0 }}>You're offline</h1>
        <p style={{ fontSize: 21, fontWeight: 600, marginTop: 4 }}>Ready to go?</p>
      </div>
      <div style={{ padding: spacing.lg, borderRadius: radius.card, background: color.muted.light }}>
        <div style={eyebrow}>Demand near {areaLabel}</div>
        <TrendBars bars={TREND_BARS} />
      </div>
      <PrimaryAction label="Go online" onPress={onGoOnline} />
    </div>
  );
}

export function TrendBars({ bars }: { bars: { hour: string; value: number }[] }) {
  return (
    <div role="img" aria-label="Demand trend" style={{ display: "flex", alignItems: "end", gap: 6, height: 80 }}>
      {bars.map((b) => (
        <div key={b.hour} style={{ flex: 1, display: "grid", gap: 4, justifyItems: "center" }}>
          <div style={{ width: "100%", height: `${b.value * 100}%`, minHeight: 4,
            borderRadius: 4, background: color.lime.light }} />
          <span style={{ ...t(typography.metadata), color: color.mutedForeground.light }}>{b.hour}</span>
        </div>
      ))}
    </div>
  );
}

export function DriverOfferScene({ offer, onAccept, onDecline }: {
  offer: DriverOffer; onAccept?: () => void; onDecline?: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <div>
        <div style={eyebrow}>{offer.product}</div>
        <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em" }}>{offer.total}</div>
        <div style={{ ...t(typography.metadata), color: color.mutedForeground.light }}>
          {offer.distance} · {offer.duration} trip · {offer.arrival} to pickup
        </div>
      </div>
      <RouteRail stops={[
        { label: offer.pickup, detail: "Pickup" },
        { label: offer.destination, detail: "Drop-off" },
      ]} />
      <PrimaryAction label="Accept" onPress={onAccept} />
      <SecondaryAction label="Decline" onPress={onDecline} />
    </div>
  );
}

export function DriverJobScene({
  state, offer, riderName, meetingPoint, pinRequired, onAdvance, onCall, onMessage,
}: {
  state: "to_pickup" | "at_pickup" | "on_trip";
  offer: DriverOffer;
  riderName: string;
  meetingPoint?: string;
  pinRequired?: boolean;
  onAdvance?: () => void;
  onCall?: () => void;
  onMessage?: () => void;
}) {
  const actions = { to_pickup: "Arrived at pickup", at_pickup: "Start trip", on_trip: "Complete trip" };
  const headlines = { to_pickup: "Head to pickup", at_pickup: "Waiting for rider", on_trip: "On trip" };
  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <div style={headline}>{headlines[state]}</div>
      <RouteRail stops={[
        { label: offer.pickup, detail: meetingPoint ?? "Pickup" },
        { label: offer.destination, detail: "Drop-off" },
      ]} />
      <ProviderCard name={riderName} vehicle="Rider" plate="" rating={undefined} />
      {pinRequired ? (
        <div role="status" style={{ ...t(typography.metadata), padding: spacing.md,
          borderRadius: radius.card, background: color.accent.light }}>
          PIN required to start
        </div>
      ) : null}
      <div style={{ display: "flex", gap: spacing.sm }}>
        <SecondaryAction label="Call" onPress={onCall} />
        <SecondaryAction label="Message" onPress={onMessage} />
      </div>
      <PrimaryAction label={actions[state]} onPress={onAdvance} />
    </div>
  );
}

export function DriverEarningsDetailScene({ trip }: {
  trip: { headline: string; total: string; lines: { label: string; value: string }[]; route: string };
}) {
  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <div>
        <div style={eyebrow}>{trip.headline}</div>
        <div style={{ fontSize: 34, fontWeight: 600 }}>{trip.total}</div>
        <div style={{ ...t(typography.metadata), color: color.mutedForeground.light }}>{trip.route}</div>
      </div>
      {trip.lines.map((l) => (
        <div key={l.label} style={{ display: "flex", justifyContent: "space-between", ...t(typography.body) }}>
          <span style={{ color: color.mutedForeground.light }}>{l.label}</span>
          <span>{l.value}</span>
        </div>
      ))}
    </div>
  );
}

export function DriverRestStopsScene() {
  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <div style={headline}>Rest stops nearby</div>
      <div style={{ display: "flex", gap: spacing.lg }}>
        {REST_STOPS.map((s: (typeof REST_STOPS)[number]) => (
          <div key={s.id} style={{ textAlign: "center" }}>
            <RestStopMarker label={s.label} category={s.category} />
            <div style={{ ...t(typography.metadata), marginTop: spacing.sm }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const driverSceneDefaults = {
  offer: DRIVER_OFFER,
  earnings: EARNINGS_TRIP,
};
