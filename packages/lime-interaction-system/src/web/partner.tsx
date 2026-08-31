/**
 * Derived from: src/components/partner/partner-places-*.tsx
 * Layer: web renderer
 */
import { color, radius, spacing } from "../tokens/index.ts";
import { ChoiceList, ChoiceRow } from "./primitives.tsx";
import { MapFloatingButton } from "./ui.tsx";
import { t, headline, eyebrow } from "./styles.ts";
import { typography } from "../tokens/index.ts";
import type { PartnerListing } from "../fixtures/partner.ts";

export const PARTNER_TAB_HEIGHT = 56;

export function PartnerTabBar({ active, tabs }: { active: string; tabs: readonly string[] }) {
  return (
    <nav aria-label="Partner tabs" style={{
      display: "flex", height: PARTNER_TAB_HEIGHT, borderTop: `1px solid ${color.border.light}`,
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

export function PlacesPausedHeadline() {
  return (
    <div>
      <div style={headline}>Your places are paused</div>
      <p style={{ ...t(typography.body), color: color.mutedForeground.light, marginTop: spacing.sm }}>
        Go live when you're ready to accept visitors.
      </p>
    </div>
  );
}

export function PlacesPausedHome({ listings, onGoLive }: {
  listings: PartnerListing[]; onGoLive?: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: spacing.lg }}>
      <PlacesPausedHeadline />
      <PlacesListingsScene listings={listings} />
      <button type="button" onClick={onGoLive}
        style={{
          width: "100%", height: 48, borderRadius: radius.pill, border: "none",
          background: color.lime.light, color: color.limeForeground.light,
          ...t(typography.cta), cursor: "pointer",
        }}>Go live</button>
    </div>
  );
}

export function PlacesLivePeek({ liveCount }: { liveCount: number }) {
  return (
    <div role="status" style={{ display: "flex", alignItems: "center", gap: spacing.sm,
      padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.pill,
      background: color.accent.light }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: color.lime.light }} />
      <span style={t(typography.bodyStrong)}>{liveCount} places live</span>
    </div>
  );
}

export function PlacesListingsScene({
  listings, filter = "all",
}: { listings: PartnerListing[]; filter?: "all" | "live" | "paused" | "draft" }) {
  const filtered = filter === "all" ? listings : listings.filter((l) => l.status === filter);
  return (
    <ChoiceList label="Listings">
      {filtered.map((l) => (
        <ChoiceRow key={l.id} title={l.name} detail={`${l.category} · ${l.address}`}
          trailing={l.status} />
      ))}
    </ChoiceList>
  );
}

export function PlacesMapControl({ label, children, onPress }: {
  label: string; children: React.ReactNode; onPress?: () => void;
}) {
  return <MapFloatingButton label={label} onPress={onPress}>{children}</MapFloatingButton>;
}

export function PartnerChromeHeader({ title, eyebrow: e }: { title: string; eyebrow?: string }) {
  return (
    <div style={{ padding: `${spacing.lg}px ${spacing.xl}px` }}>
      {e ? <div style={eyebrow}>{e}</div> : null}
      <div style={headline}>{title}</div>
    </div>
  );
}
