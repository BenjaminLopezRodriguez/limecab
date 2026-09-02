import { Text, View } from "react-native";
import {
  ChoiceRow,
  CompletionPanel,
  LiveSheetHeader,
  ProgressBar,
  ProviderCard,
  QuotePanel,
  RouteRail,
  radius,
  spacing,
  typeStyle,
  typography,
  useLimeColors,
} from "@lime/ui";
import type { MapSceneState } from "../../core/map.ts";
import type { PresentationEnvironment } from "../../policy/environment.ts";
import { NativeMap } from "../NativeMapRenderer.tsx";
import { Icon } from "../Icon.tsx";
import { DRIVER_JOB, DRIVER_OFFER, EARNINGS_TRIP } from "../../fixtures/driver.ts";
import type { DriverStep } from "../../scenarios/driver/happy-path.ts";
import { driverCopy } from "../../scenarios/driver/happy-path.ts";

/** Off-duty home: the duty question, the world as a card, then what is worth reading. */
function DriverHome({ map, env }: { map?: MapSceneState; env?: PresentationEnvironment }) {
  const c = useLimeColors();
  return (
    <View style={{ gap: spacing.lg, paddingTop: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typeStyle(typography.headlineXl), color: c.foreground }}>You're offline</Text>
          <Text style={{ ...typeStyle(typography.bodyStrong), color: c.foreground, marginTop: 2 }}>
            Ready to go?
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <RoundControl name="Shield01" label="Safety toolkit" />
          <RoundControl name="SlidersHorizontal" label="Driving preferences" />
        </View>
      </View>

      {/* The world, reduced to a card. Same scene the full-bleed canvas would draw. */}
      {map && env ? (
        <View
          style={{
            height: 250,
            borderRadius: radius.card,
            borderCurve: "continuous",
            overflow: "hidden",
            backgroundColor: c.muted,
          }}
        >
          <NativeMap scene={map} env={{ ...env, viewport: { width: env.viewport.width - spacing.xl * 2, height: 250 } }} insets={{ top: 0, right: 0, bottom: 0, left: 0 }} showMode={false} />
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Text style={{ ...typeStyle(typography.headline), color: c.foreground }}>Opportunities</Text>
        <ChoiceRow
          glyph={<Icon name="Analytics01" size={20} />}
          title="Earnings trends in Arcadia"
          detail="Earnings"
          trailing={<Icon name="ArrowRight01" size={18} />}
        />
      </View>
    </View>
  );
}

/** The hunting strip: centred, two lines, no action. */
function DutyStatus({ headline, supporting }: { headline: string; supporting: string }) {
  const c = useLimeColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingTop: spacing.xs }}>
      <RoundControl name="SlidersHorizontal" label="Driving preferences" size={22} />
      <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
        <Text style={{ ...typeStyle(typography.bodyStrong), color: c.foreground }}>{headline}</Text>
        <Text style={{ ...typeStyle(typography.body), color: c.mutedForeground }}>{supporting}</Text>
      </View>
      <RoundControl name="Menu01" label="Recommended for you" size={22} />
    </View>
  );
}

/** A bare round tap target holding one glyph, as the driver chrome uses throughout. */
function RoundControl({
  name,
  label,
  size = 20,
}: {
  name: Parameters<typeof Icon>[0]["name"];
  label: string;
  size?: number;
}) {
  return (
    <View
      accessible
      aria-label={label}
      role="button"
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
    >
      <Icon name={name} size={size} />
    </View>
  );
}

/**
 * Driver scene content, native. Same fixtures the web driver scenes use.
 *
 * The offer is the interesting one: it renders as ordinary content, and the fact that it
 * *interrupts* is carried entirely by its `SurfaceState` — emphasis `interrupt`, presentation
 * `compact-interrupt`. Nothing here knows it is being interrupted with.
 */
export interface DriverSceneProps {
  step: DriverStep;
  /** Off duty draws the world as a card inside the page; the scene needs it to do that. */
  map?: MapSceneState;
  env?: PresentationEnvironment;
  onGoOnline?: () => void;
}

export function DriverScene({ data }: { data: DriverSceneProps }) {
  const { step, map, env } = data;
  const copy = driverCopy[step];

  switch (step) {
    /**
     * Off duty is a document, not a dimmed dash. Production opens with the duty question in
     * display type, then the world as an inset *card* rather than a backdrop, then the things
     * worth reading before a shift. The CTA is the only lime on the page.
     */
    case "offline":
      return <DriverHome map={map} env={env} />;

    /**
     * Online is a status strip and nothing else. Production puts no primary action here — the
     * map is the app, and the peek only says whether the moment is worth working. Adding a
     * full-width CTA turns a glanceable strip into a form.
     */
    case "online":
      return <DutyStatus headline="It's dinner time" supporting="Check the map for busy areas" />;

    case "offer":
      return (
        <View style={{ gap: spacing.sm }}>
          <LiveSheetHeader eyebrow={copy.eyebrow} headline={copy.headline} supporting={copy.supporting} />
          <RouteRail
            stops={[
              { label: DRIVER_OFFER.pickup, detail: `${DRIVER_OFFER.arrival} away` },
              { label: DRIVER_OFFER.destination, detail: DRIVER_OFFER.duration },
            ]}
          />
        </View>
      );

    case "enRoute":
    case "arrived":
      return (
        <View style={{ gap: spacing.md }}>
          <LiveSheetHeader eyebrow={copy.eyebrow} headline={copy.headline} supporting={copy.supporting} />
          {step === "enRoute" ? <ProgressBar value={44} label="Distance to pickup" /> : null}
          <ProviderCard
            name={DRIVER_JOB.riderName}
            detail={DRIVER_JOB.meetingPoint}
            badge={step === "arrived" ? "PIN" : undefined}
            live={step === "enRoute"}
          />
        </View>
      );

    case "inTrip":
      return (
        <View style={{ gap: spacing.md }}>
          <LiveSheetHeader eyebrow={copy.eyebrow} headline={copy.headline} supporting={copy.supporting} />
          <ProgressBar value={71} label="Trip progress" />
          <RouteRail
            stops={[
              { label: DRIVER_OFFER.pickup, detail: "Picked up" },
              { label: DRIVER_OFFER.destination, detail: `${DRIVER_OFFER.duration} remaining` },
            ]}
          />
        </View>
      );

    case "complete":
      return <CompletionPanel headline="Trip complete" total={EARNINGS_TRIP.total} lines={EARNINGS_TRIP.lines} />;

    case "earnings":
      return (
        <View style={{ gap: spacing.md }}>
          <LiveSheetHeader eyebrow={copy.eyebrow} headline={copy.headline} supporting={copy.supporting} />
          <QuotePanel lines={EARNINGS_TRIP.lines} total={EARNINGS_TRIP.total} totalLabel="Paid out" note={EARNINGS_TRIP.route} />
        </View>
      );
  }
}
