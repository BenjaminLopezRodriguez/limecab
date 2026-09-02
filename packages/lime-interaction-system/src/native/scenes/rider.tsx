import { Pressable, ScrollView, Text, View } from "react-native";
import {
  Button,
  ChoiceList,
  ChoiceRow,
  CompletionPanel,
  LiveSheetHeader,
  LocationTrigger,
  ProgressBar,
  ProviderCard,
  QuotePanel,
  radius,
  RouteRail,
  SurfaceSkeleton,
  spacing,
  Switch,
  typeStyle,
  typography,
  useLimeColors,
} from "@lime/ui";
import type { MapSceneState } from "../../core/map.ts";
import type { PresentationEnvironment } from "../../policy/environment.ts";
import {
  PICKUP_SPOTS,
  RIDER_DESTINATION,
  RIDER_PICKUP,
  RIDER_ROUTE,
  RIDE_TIERS,
} from "../../fixtures/rider.ts";
import type { RiderStep } from "../../scenarios/rider/happy-path.ts";
import { riderCopy } from "../../scenarios/rider/happy-path.ts";
import { NativeMap } from "../NativeMapRenderer.tsx";
import { MagnifierGlyph, MicrophoneGlyph } from "./scene-icons.tsx";

/**
 * Rider scene content, native. The counterpart of `src/web/scenes/rider-scenes.tsx` — same
 * fixtures, same copy, same product grammar, drawn with `@lime/ui` primitives instead of DOM.
 *
 * It lives beside the renderer rather than inside the Expo app because a second Lime client
 * would want exactly this, and because keeping it out of `NativeSurface` is what stops the
 * surface engine growing product conditionals.
 */
export interface RiderSceneProps {
  step: RiderStep;
  /** Home reduces the persistent world into the launcher's map card. */
  map?: MapSceneState;
  env?: PresentationEnvironment;
  tier?: string;
  onSelectTier?: (id: string) => void;
  onPressDestination?: () => void;
  onPressMap?: () => void;
  onPressVoice?: () => void;
  traveling?: boolean;
  onTravelingChange?: (next: boolean) => void;
  /** The curb currently chosen, and how to revise it. */
  pickupSpot?: string;
  onSelectSpot?: (id: string) => void;
  onSearchPickup?: () => void;
}

const RIDER_VERTICALS = ["Ride", "Reserve", "Courier", "Help", "Shop", "Assist", "Freight"] as const;
const noop = () => {};

function RiderHome({
  map,
  env,
  onPressDestination,
  onPressMap,
  onPressVoice,
  traveling,
  onTravelingChange,
}: Pick<
  RiderSceneProps,
  | "map"
  | "env"
  | "onPressDestination"
  | "onPressMap"
  | "onPressVoice"
  | "traveling"
  | "onTravelingChange"
>) {
  const c = useLimeColors();
  const mapHeight = env ? Math.min(env.viewport.height * 0.34, 320) : 250;

  return (
    <View style={{ gap: spacing.lg, paddingTop: spacing.sm, paddingBottom: 92 }}>
      <Text style={{ ...typeStyle(typography.subhead), color: c.foreground }}>
        Hello, <Text style={{ color: c.accent }}>(424) 242-4242</Text>
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xxl }}>
        {RIDER_VERTICALS.map((label) => {
          const active = label === "Ride";
          return (
            <View key={label} style={{ paddingBottom: spacing.sm }}>
              <Text
                style={{
                  ...typeStyle(typography.metadata),
                  color: active ? c.foreground : c.mutedForeground,
                  fontWeight: active ? "600" : "500",
                }}
              >
                {label}
              </Text>
              {active ? (
                <View
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 2,
                    borderRadius: radius.pill,
                    backgroundColor: c.foreground,
                  }}
                />
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {map && env ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Set current location on map"
          onPress={onPressMap}
          style={{
            height: mapHeight,
            borderRadius: radius.card,
            borderCurve: "continuous",
            overflow: "hidden",
            backgroundColor: c.foreground,
          }}
        >
          <NativeMap
            scene={map}
            env={{
              ...env,
              viewport: { width: Math.max(1, env.viewport.width - spacing.xl * 2), height: mapHeight },
            }}
            insets={{ top: 0, right: 0, bottom: 0, left: 0 }}
            showMode={false}
          />
          <View
            style={{
              position: "absolute",
              top: spacing.md,
              left: spacing.md,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              borderRadius: radius.mapLabel,
              backgroundColor: c.muted,
            }}
          >
            <Text style={{ ...typeStyle(typography.metadata), color: c.mutedForeground }}>
              Current location
            </Text>
          </View>
          <Text
            style={{
              ...typeStyle(typography.metadata),
              position: "absolute",
              left: spacing.md,
              bottom: spacing.sm,
              color: c.foreground,
            }}
          >
            ◉ mapbox
          </Text>
          <View
            aria-hidden
            style={{
              position: "absolute",
              right: spacing.md,
              bottom: spacing.sm,
              width: 24,
              height: 24,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radius.pill,
              backgroundColor: c.surface,
            }}
          >
            <Text style={{ ...typeStyle(typography.metadata), color: c.foreground }}>i</Text>
          </View>
        </Pressable>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <LocationTrigger
          placeholder="Where to?"
          onPress={onPressDestination}
          start={<MagnifierGlyph color={c.accent} />}
          end={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Book with voice"
              onPress={onPressVoice}
              style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
            >
              <MicrophoneGlyph color={c.mutedForeground} />
            </Pressable>
          }
        />
        <Text style={{ ...typeStyle(typography.metadata), color: c.mutedForeground, marginLeft: spacing.xs }}>
          Ride, send, or get
        </Text>
      </View>

      <Pressable accessibilityRole="link" onPress={noop} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={{ ...typeStyle(typography.body), color: c.mutedForeground }}>
          Save Home and Work for faster pickup
        </Text>
      </Pressable>

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Text style={{ ...typeStyle(typography.body), color: c.mutedForeground }}>I'm traveling</Text>
        <Switch checked={traveling} onChange={onTravelingChange} aria-label="I'm traveling" />
      </View>
    </View>
  );
}

export function RiderScene({ data }: { data: RiderSceneProps }) {
  const {
    step,
    map,
    env,
    tier,
    onSelectTier,
    onPressDestination,
    onPressMap,
    onPressVoice,
    traveling,
    onTravelingChange,
    pickupSpot,
    onSelectSpot,
    onSearchPickup,
  } = data;
  const copy = riderCopy[step];

  switch (step) {
    case "home":
      return (
        <RiderHome
          map={map}
          env={env}
          onPressDestination={onPressDestination}
          onPressMap={onPressMap}
          onPressVoice={onPressVoice}
          traveling={traveling}
          onTravelingChange={onTravelingChange}
        />
      );

    case "rideSelect":
      return (
        <View style={{ gap: spacing.sm }}>
          <LiveSheetHeader
            headline={copy.headline}
            supporting={`${RIDER_ROUTE.miles} mi · ${RIDER_ROUTE.minutes} min`}
          />
          <ChoiceList label="Ride class">
            {RIDE_TIERS.map((t) => (
              <ChoiceRow
                key={t.id}
                glyph={t.glyph}
                title={t.title}
                detail={t.detail}
                trailing={t.price}
                selected={tier === t.id}
                disabled={t.disabled}
                disabledReason={t.disabledReason}
                onSelect={() => onSelectTier?.(t.id)}
              />
            ))}
          </ChoiceList>
        </View>
      );

    /**
     * Spatial confirmation: the map is the subject and this only names the curb. Pricing
     * already happened on ride select, so there is no fare here — the header carries the
     * address, the rows are that address's spots, and the trailing control revises the place.
     */
    case "confirmPickup":
      return (
        <View style={{ gap: spacing.sm }}>
          <LiveSheetHeader
            headline={copy.headline}
            supporting={copy.supporting}
            trailing={
              onSearchPickup ? (
                <Button size="icon" variant="ghost" aria-label="Search pickup location" onPress={onSearchPickup}>
                  ⌕
                </Button>
              ) : undefined
            }
          />
          <ChoiceList label="Pickup spots">
            {PICKUP_SPOTS.map((spot) => (
              <ChoiceRow
                key={spot.id}
                title={spot.label}
                detail={spot.detail}
                selected={pickupSpot === spot.id}
                onSelect={() => onSelectSpot?.(spot.id)}
              />
            ))}
          </ChoiceList>
        </View>
      );

    case "quote": {
      const chosen = RIDE_TIERS.find((t) => t.id === tier) ?? RIDE_TIERS[0]!;
      return (
        <View style={{ gap: spacing.md }}>
          <LiveSheetHeader eyebrow="Confirm" headline={copy.headline} supporting={chosen.title} />
          <RouteRail
            stops={[
              { label: RIDER_PICKUP, detail: "Pickup" },
              { label: RIDER_DESTINATION, detail: "Dropoff" },
            ]}
          />
          <QuotePanel
            lines={[
              { label: chosen.title, value: chosen.price },
              { label: "Booking fee", value: "$2.50" },
            ]}
            total={chosen.price}
            note="Price is fixed for this route."
          />
        </View>
      );
    }

    case "matching":
      return (
        <View style={{ gap: spacing.sm }}>
          <LiveSheetHeader eyebrow={copy.eyebrow} headline={copy.headline} />
          <SurfaceSkeleton rows={3} label="Finding a driver" />
        </View>
      );

    case "assigned":
      return (
        <View style={{ gap: spacing.md }}>
          <LiveSheetHeader eyebrow={copy.eyebrow} headline={copy.headline} supporting={copy.supporting} />
          <ProgressBar value={62} label="Driver arriving" />
          <ProviderCard name="Rosa Alvarez" detail="Silver Toyota Prius" meta="4.9★" badge="8KJT402" live />
        </View>
      );

    case "complete":
      return (
        <CompletionPanel
          headline="Trip complete"
          total={copy.supporting ?? ""}
          lines={[
            { label: "Fare", value: "$20.40" },
            { label: "Booking fee", value: "$2.50" },
          ]}
        />
      );
  }
}
