import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Button,
  boxShadow,
  elevation,
  FieldList,
  MapRouteBar,
  PrimaryAction,
  radius,
  SecondaryAction,
  spacing,
  typeStyle,
  typography,
  useLimeColors,
} from "@lime/ui";
import { createSurfaceManager, type SurfaceId } from "@lime/interaction-system/core";
import { resolveBack } from "@lime/interaction-system/harness";
import {
  createRegistry,
  Icon,
  NativeSceneRenderer,
  SearchScene,
  NativeShell,
  RiderScene,
  useInteractionBack,
  useNativeEnvironment,
  useSurfaceProgress,
  type DragIntent,
} from "@lime/interaction-system/native";
import { riderCopy, riderHappyPath, type RiderStep } from "@lime/interaction-system/scenarios";
import { launcher, rideSurfaces } from "@lime/interaction-system/recipes";
import {
  fixturePlaceSearch,
  PAYMENT,
  PICKUP_SPOTS,
  RIDE_ADD_ONS,
  RIDE_TIERS,
} from "@lime/interaction-system/fixtures";
import { INTERRUPT, MAP, PRIMARY, SECONDARY, useSurfaceRuntime } from "../src/useSurfaceRuntime";
import { DevBar } from "../src/DevBar";

const riderSurfaces = createSurfaceManager({
  surfaces: rideSurfaces.surfaces,
  actions: {
    ...rideSurfaces.actions,
    // Rider home is physically the same page posture as driver off-duty. This app-local name
    // composes the existing launcher recipe without expanding the shared Ride action contract.
    showLauncher: { intent: "collapse", surfaces: launcher },
  },
});

/** Dev scaffolding is opt-in so parity screenshots stay clean. */
const showDevControls =
  process.env.NODE_ENV !== "production" && process.env.EXPO_PUBLIC_DEV_CONTROLS === "true";

type RiderAction = keyof (typeof riderSurfaces)["actions"];


/**
 * The rider context. One route for the whole product: home, quote, matching, the trip and its
 * completion are states of the same persistent world, not screens stacked on each other.
 */
export default function Rider() {
  const env = useNativeEnvironment();
  const c = useLimeColors();
  const router = useRouter();
  // `?step=` jumps directly to a canonical state — parity work should never replay a flow.
  const { step: jumpTo } = useLocalSearchParams<{ step?: string }>();
  const { machine, snapshot, frame, act, perform, snapTo } = useSurfaceRuntime(
    riderHappyPath,
    riderSurfaces,
    riderRecipe,
    jumpTo,
  );
  const [tier, setTier] = useState<string>();
  const [pickupSpot, setPickupSpot] = useState(PICKUP_SPOTS[0]!.id);
  const [traveling, setTraveling] = useState(false);
  const [pendingUpsell, setPendingUpsell] = useState(false);
  // Ephemeral: the phase of an async transition. Nothing durable lives here.
  const progress = useSurfaceProgress({ reducedMotion: env.reducedMotion });

  const step = snapshot.step as RiderStep;
  const copy = riderCopy[step];
  const live = machine.isLive();

  const searching = frame.scene.surfaces[SECONDARY]?.emphasis !== "hidden";

  /**
   * The chosen curb *is* the origin while pickup is being confirmed, so the canvas shows what
   * the sheet names. This projects app state into `MapSceneState` rather than letting a scene
   * keep map state of its own.
   */
  const composed = useMemo(() => {
    if (step !== "confirmPickup" || !frame.scene.map) return frame;
    const spot = PICKUP_SPOTS.find((s) => s.id === pickupSpot);
    if (!spot) return frame;
    const points = (frame.scene.map.points ?? []).map((point) =>
      point.role === "origin"
        ? { ...point, latitude: spot.latitude, longitude: spot.longitude, label: spot.label }
        : point,
    );
    return { ...frame, scene: { ...frame.scene, map: { ...frame.scene.map, points } } };
  }, [frame, step, pickupSpot]);

  const registry = useMemo(
    () =>
      createRegistry([
        // The world is a surface, not a backdrop: the registry says so, and the renderer
        // composes it like any other.
        [MAP, { component: (() => null) as never, chrome: "canvas" as const }],
        [PRIMARY, RiderScene as never],
        // Search is a peer surface, not a swap of the sheet's contents — which is why it can
        // be dismissed back to exactly the task it left.
        [SECONDARY, SearchScene as never],
        [INTERRUPT, RiderUpsell as never],
      ]),
    [],
  );

  /** Draft work dismisses on a drag down; live work minimizes and keeps running. */
  const dragIntent: Partial<Record<SurfaceId, DragIntent>> = {
    [PRIMARY]: snapshot.minimized ? "none" : live ? "minimize" : machine.canRegress() ? "dismiss" : "none",
  };

  const restoreStepSurface = () => perform(riderRecipe(step, snapshot.minimized));
  const dismissUpsell = () => {
    perform("resume");
    act((m) => m.closeInterrupt());
  };

  // The curb surface commits first; the interrupt opens only after that surface exists to be
  // suspended. This also keeps the runtime's canonical step recipe from overwriting the
  // interrupt layout during the rideSelect -> confirmPickup state change.
  useEffect(() => {
    if (!pendingUpsell || step !== "confirmPickup") return;
    setPendingUpsell(false);
    act((m) => m.openInterrupt("rideExtras"));
    perform("offerExtras");
  }, [act, pendingUpsell, perform, step]);

  const onBack = useInteractionBack({
    resolver: (ctx) =>
      // An open search surface is transient chrome over the task, and Back closes it first.
      searching
        ? { type: "dismiss-transient" as const }
        : resolveBack("rider", step === "home" ? "home" : live ? "live" : "draft", ctx),
    context: {
      frame,
      hasInterrupt: snapshot.interrupt !== null,
      surfaceHistoryDepth: snapshot.interrupt ? 1 : 0,
      workflowCanRegress: machine.canRegress(),
      liveWorkActive: live,
    },
    handlers: {
      // Dismissing the search surface is not a step backwards: the rider is still on the same
      // step, they simply stopped asking the question.
      dismissTransient: restoreStepSurface,
      returnInterrupt: dismissUpsell,
      regressScene: () => act((m) => m.previous()),
      minimizeLiveWork: () => act((m) => m.minimize()),
      // Only this hands control to the navigator. Rider Home resolves to `consume`, so
      // pressing back there does nothing at all — deliberately, as production does.
      delegateToHost: () => router.back(),
    },
  });

  /**
   * The perceived-performance path (spec §14).
   *
   * The pickup sheet leaves immediately and the canvas takes over while dispatch runs — there is no
   * "Requesting…" pinned to a dead screen, and no driver exists until dispatch says so. The
   * step only moves when the choreography says the next content may arrive, and moves back if
   * dispatch fails, with the rider's selections untouched.
   */
  const requestRide = () => {
    perform("requestRide");
    void progress
      .run({
        from: "confirmPickup",
        to: "matching",
        task: dispatchRide,
        onContent: (content) => {
          if (!content) return;
          act((m) => m.jump(content as RiderStep));
          perform(content === "matching" ? "chooseRide" : "confirmPickup");
        },
      })
      // Reversal already happened through `onContent`; the throw is the driver telling the
      // caller, and the caller has nothing left to do about it.
      .catch(() => {});
  };

  const chosenTier = RIDE_TIERS.find((candidate) => candidate.id === tier);
  const actions = step === "home" ? null : snapshot.minimized ? (
    <PrimaryAction label="Resume" onPress={() => act((m) => m.restore())} />
  ) : step === "rideSelect" ? (
    chosenTier ? (
      <View style={{ gap: spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Payment: ${PAYMENT.label} ${PAYMENT.detail}. Change`}
          style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.md }}
        >
          <Icon name="CreditCard" size={17} />
          <Text style={{ ...typeStyle(typography.body), flex: 1, color: c.foreground }}>
            {PAYMENT.label} {PAYMENT.detail}
          </Text>
          <Text aria-hidden style={{ ...typeStyle(typography.body), color: c.mutedForeground }}>›</Text>
        </Pressable>
        <Button
          label={`Confirm ${chosenTier.title} · ${formatFare(chosenTier.fareCents)}`}
          variant="default"
          onPress={() => {
            setPendingUpsell(true);
            act((m) => m.next());
          }}
          style={{ width: "100%" }}
        />
      </View>
    ) : null
  ) : step === "confirmPickup" ? (
    <Button label="Confirm pickup" variant="default" onPress={requestRide} style={{ width: "100%" }} />
  ) : (
    <View style={{ gap: spacing.sm }}>
      {machine.canAdvance() ? (
        <PrimaryAction
          label={primaryLabel(step, tier, copy.primaryAction)}
          onPress={() => act((m) => m.next())}
        />
      ) : (
        <PrimaryAction label="Done" onPress={() => router.back()} />
      )}
      {live ? <SecondaryAction label="Minimize" onPress={() => act((m) => m.minimize())} /> : null}
    </View>
  );

  return (
    <NativeShell
      intent={frame.shell}
      bottom={step === "home" && !searching ? <RiderTabs safeBottom={env.safeArea.bottom} /> : undefined}
    >
      {step === "rideSelect" || step === "confirmPickup" ? (
        <RiderRouteBar
          step={step}
          top={env.safeArea.top}
          onBack={onBack}
          onEdit={() => perform("openSearch")}
        />
      ) : null}
      <NativeSceneRenderer
        frame={composed}
        env={env}
        registry={registry}
        data={{
          [PRIMARY]: {
            step,
            map: frame.scene.map,
            env,
            tier,
            onSelectTier: setTier,
            // Opening search changes the composition, not the step: the rider has not
            // progressed anywhere yet, exactly as production models it.
            onPressDestination: () => perform("openSearch"),
            onPressMap: () => perform("chooseOnMap"),
            onPressVoice: () => perform("openSearch"),
            traveling,
            onTravelingChange: setTraveling,
            pickupSpot,
            onSelectSpot: setPickupSpot,
            onSearchPickup: () => perform("openSearch"),
          },
          [SECONDARY]: {
            adapter: fixturePlaceSearch,
            onBack,
            onChooseOnMap: () => perform("chooseOnMap"),
            onVoice: () => perform("openSearch"),
            onSelect: () => {
              if (step === "confirmPickup") {
                perform("confirmPickup");
                return;
              }
              perform("placeSelected");
              act((m) => m.next());
            },
          },
          [INTERRUPT]: {
            interrupt: snapshot.interrupt,
            onDismiss: dismissUpsell,
          },
        }}
        actions={{ [PRIMARY]: actions }}
        dragIntent={dragIntent}
        progress={{ [PRIMARY]: progress.state }}
        onSnapTo={(_, destination) => snapTo(destination, live ? "minimize" : "dismiss")}
        onPick={(_, point) => {
          if (step !== "confirmPickup") return;
          const nearest = PICKUP_SPOTS.reduce((closest, spot) =>
            Math.hypot(spot.latitude - point.latitude, spot.longitude - point.longitude) <
            Math.hypot(closest.latitude - point.latitude, closest.longitude - point.longitude)
              ? spot
              : closest,
          );
          setPickupSpot(nearest.id);
        }}
      />
      {showDevControls && step !== "rideSelect" && step !== "confirmPickup" ? (
        <DevBar top={env.safeArea.top} onBack={onBack} />
      ) : null}
    </NativeShell>
  );
}

/** Stands in for dispatch. Latency is the point: the choreography has to cover it. */
const dispatchRide = () => new Promise<void>((resolve) => setTimeout(resolve, 900));

/** The CTA names what the user actually chose, not what the scenario copy assumed. */
/** Which recipe rests the surfaces where this step needs them. */
function riderRecipe(step: RiderStep, minimized: boolean): RiderAction {
  if (minimized) return "minimizeRide";
  switch (step) {
    case "home":
      return "showLauncher";
    case "confirmPickup":
      // The canvas becomes the subject and the sheet names the curb.
      return "confirmPickup";
    case "complete":
      return "expandRide";
    default:
      return "chooseRide";
  }
}

function RiderTabs({ safeBottom }: { safeBottom: number }) {
  const c = useLimeColors();
  const tabs = [
    { label: "Home", icon: "Home01" as const },
    { label: "Services", icon: "Menu01" as const },
    { label: "Activity", icon: "Wallet01" as const },
    { label: "Profile", icon: "UserCircle" as const },
  ];

  return (
    <View style={{ paddingBottom: safeBottom + spacing.sm }}>
      <View
        style={{
          height: 64,
          marginHorizontal: spacing.xl,
          flexDirection: "row",
          alignItems: "center",
          borderRadius: radius.pill,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.border,
          backgroundColor: c.surfaceElevated,
          ...boxShadow(elevation.floatingControl),
        }}
      >
        {tabs.map((tab) => {
          const active = tab.label === "Home";
          return (
            <Pressable
              key={tab.label}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              style={{ flex: 1, height: 56, alignItems: "center", justifyContent: "center", gap: 2 }}
            >
              <Icon name={tab.icon} size={20} color={active ? c.foreground : c.mutedForeground} />
              <Text style={{ ...typeStyle(typography.eyebrow), color: active ? c.foreground : c.mutedForeground }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function primaryLabel(step: RiderStep, tier: string | undefined, fallback?: string): string {
  if (step === "home") return "Set destination";
  if (step === "rideSelect") {
    const chosen = RIDE_TIERS.find((t) => t.id === tier);
    return chosen ? `Confirm ${chosen.title} · ${formatFare(chosen.fareCents)}` : "Choose a ride";
  }
  return fallback ?? "Continue";
}

function RiderUpsell({ data }: { data: { interrupt?: string | null; onDismiss?: () => void } }) {
  const c = useLimeColors();
  if (data.interrupt !== "rideExtras") return null;

  return (
    <View style={{ gap: spacing.lg }}>
      <View>
        <Text style={{ ...typeStyle(typography.subhead), color: c.foreground }}>
          Add something for the ride?
        </Text>
        <Text style={{ ...typeStyle(typography.body), marginTop: spacing.xs, color: c.mutedForeground }}>
          Coffee, tea, or sparkling water. One stop on the way. Skip to keep the ride as-is.
        </Text>
      </View>
      <FieldList>
        {RIDE_ADD_ONS.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}, add for ${formatFare(item.priceCents)}`}
            style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.md }}
          >
            <Text style={{ ...typeStyle(typography.body), flex: 1, color: c.foreground }}>{item.label}</Text>
            <Text style={{ ...typeStyle(typography.bodyStrong), color: c.foreground }}>
              +{formatFare(item.priceCents)}
            </Text>
          </Pressable>
        ))}
      </FieldList>
      <Button label="No thanks" variant="secondary" onPress={data.onDismiss} style={{ width: "100%" }} />
    </View>
  );
}

function RiderRouteBar({
  step,
  top,
  onBack,
  onEdit,
}: {
  step: RiderStep;
  top: number;
  onBack: () => void;
  onEdit: () => void;
}) {
  return (
    <View
      style={{
        position: "absolute",
        top: top + spacing.sm,
        left: spacing.md,
        right: spacing.md,
        zIndex: 15,
      }}
    >
      <MapRouteBar
        origin="Current location"
        destination={step === "rideSelect" ? "Pinned location" : undefined}
        onBack={onBack}
        onEdit={step === "rideSelect" ? onEdit : undefined}
      />
    </View>
  );
}

const formatFare = (cents: number) => `$${(cents / 100).toFixed(2)}`;
