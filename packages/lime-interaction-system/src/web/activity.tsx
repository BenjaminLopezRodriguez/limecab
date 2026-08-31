/**
 * Activity tab — ongoing trip card + past list (Uber screenshot 5931).
 */
import { radius, spacing, typography } from "../tokens/index.ts";
import { rideDark } from "./ride-cards.tsx";
import { t } from "./styles.ts";

export function OngoingTripCard({
  dropoff, product, destination, progress, driverInitial, onPress,
}: {
  dropoff: string;
  product: string;
  destination: string;
  progress: number;
  driverInitial: string;
  onPress?: () => void;
}) {
  return (
    <button type="button" onClick={onPress}
      style={{
        display: "grid", gap: spacing.md, width: "100%", textAlign: "left",
        padding: spacing.lg, borderRadius: radius.card, border: `1px solid ${rideDark.border}`,
        background: rideDark.card, color: rideDark.fg, cursor: "pointer", font: "inherit",
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <div style={{ ...t(typography.bodyStrong) }}>{dropoff}</div>
          <div style={{ ...t(typography.metadata), color: rideDark.muted, marginTop: 2 }}>{product}</div>
          <div style={{ ...t(typography.body), marginTop: spacing.sm }}>{destination}</div>
        </div>
        <div aria-hidden style={{
          width: 40, height: 40, borderRadius: radius.pill, background: rideDark.cardRaised,
          display: "grid", placeItems: "center", ...t(typography.bodyStrong),
        }}>{driverInitial}</div>
      </div>
      <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
        aria-label="Trip progress"
        style={{ position: "relative", height: 4, borderRadius: radius.pill, background: rideDark.border }}>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: `${progress}%`,
          background: rideDark.fg, borderRadius: radius.pill,
        }} />
        <div style={{
          position: "absolute", left: `${progress}%`, top: "50%", transform: "translate(-50%, -50%)",
          width: 12, height: 12, borderRadius: radius.pill, background: rideDark.fg,
          border: `2px solid ${rideDark.card}`,
        }} />
      </div>
    </button>
  );
}

export function PastTripRow({
  address, when, amount, status, onPress,
}: { address: string; when: string; amount: string; status: string; onPress?: () => void }) {
  return (
    <button type="button" onClick={onPress}
      style={{
        display: "flex", gap: spacing.md, width: "100%", textAlign: "left",
        padding: spacing.lg, borderRadius: radius.card, border: `1px solid ${rideDark.border}`,
        background: rideDark.card, color: rideDark.fg, cursor: "pointer", font: "inherit",
      }}>
      <div aria-hidden style={{
        width: 56, height: 56, borderRadius: radius.control, background: rideDark.cardRaised,
        flexShrink: 0,
      }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ ...t(typography.bodyStrong), display: "block" }}>{address}</span>
        <span style={{ ...t(typography.metadata), color: rideDark.muted, display: "block", marginTop: 2 }}>
          {when} · {status}
        </span>
      </span>
      <span style={{ ...t(typography.bodyStrong), fontVariantNumeric: "tabular-nums" }}>{amount}</span>
    </button>
  );
}

export function ActivityScene({
  ongoing, past,
}: {
  ongoing: { dropoff: string; product: string; destination: string; progress: number; driverInitial: string };
  past: { id: string; address: string; when: string; amount: string; status: string }[];
}) {
  return (
    <div style={{
      width: 390, minHeight: 700, background: rideDark.canvas, color: rideDark.fg,
      padding: spacing.xl, fontFamily: "system-ui",
    }}>
      <h1 style={{ ...t(typography.headline), margin: `0 0 ${spacing.xl}px` }}>Activity</h1>
      <section>
        <h2 style={{ ...t(typography.subhead), marginBottom: spacing.md }}>Ongoing</h2>
        <OngoingTripCard {...ongoing} driverInitial={ongoing.driverInitial} />
      </section>
      <section style={{ marginTop: spacing.xl }}>
        <h2 style={{ ...t(typography.subhead), marginBottom: spacing.md }}>Past</h2>
        <div style={{ display: "grid", gap: spacing.sm }}>
          {past.map((row) => (
            <PastTripRow key={row.id} address={row.address} when={row.when}
              amount={row.amount} status={row.status} />
          ))}
        </div>
      </section>
    </div>
  );
}
