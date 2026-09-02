import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  boxShadow,
  elevation,
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
import { fixturePlaceSearch, PICKUP_SPOTS, RIDE_TIERS } from "@lime/interaction-system/fixtures";
import { MAP, PRIMARY, SECONDARY, useSurfaceRuntime } from "../src/useSurfaceRuntime";
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

type RiderAction = keyof (typeof riderSurfaces)["actions"];


/**
 * The rider context. One route for the whole product: home, quote, matching, the trip and its
 * completion are states of the same persistent world, not screens stacked on each other.
 */
export default function Rider() {
  const env = useNativeEnvironment();
  const router = useRouter();
  // `?step=` jumps directly to a canonical state — parity work should never replay a flow.
  const { step: jumpTo } = useLocalSearchParams<{ step?: string }>();
  const { machine, snapshot, frame, act, perform, snapTo } = useSurfaceRuntime(
    riderHappyPath,
    riderSurfaces,
    riderRecipe,
    jumpTo,
  );
  const [tier, setTier] = useState("lime");
  const [pickupSpot, setPickupSpot] = useState(PICKUP_SPOTS[0]!.id);
  const [traveling, setTraveling] = useState(false);
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
      ]),
    [],
  );

  /** Draft work dismisses on a drag down; live work minimizes and keeps running. */
  const dragIntent: Partial<Record<SurfaceId, DragIntent>> = {
    [PRIMARY]: snapshot.minimized ? "none" : live ? "minimize" : machine.canRegress() ? "dismiss" : "none",
  };

  const restoreStepSurface = () => perform(riderRecipe(step, snapshot.minimized));

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
      returnInterrupt: () => act((m) => m.closeInterrupt()),
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
   * The quote leaves immediately and the canvas takes over while dispatch runs — there is no
   * "Requesting…" pinned to a dead screen, and no driver exists until dispatch says so. The
   * step only moves when the choreography says the next content may arrive, and moves back if
   * dispatch fails, with the rider's selections untouched.
   */
  const requestRide = () => {
    perform("requestRide");
    void progress
      .run({
        from: "quote",
        to: "matching",
        task: dispatchRide,
        onContent: (content) => {
          if (!content) return;
          act((m) => m.jump(content as RiderStep));
          perform(content === "matching" ? "chooseRide" : "requestFailed");
        },
      })
      // Reversal already happened through `onContent`; the throw is the driver telling the
      // caller, and the caller has nothing left to do about it.
      .catch(() => {});
  };

  const actions = step === "home" ? null : snapshot.minimized ? (
    <PrimaryAction label="Resume" onPress={() => act((m) => m.restore())} />
  ) : (
    <View style={{ gap: spacing.sm }}>
      {machine.canAdvance() ? (
        <PrimaryAction
          label={primaryLabel(step, tier, copy.primaryAction)}
          onPress={step === "quote" ? requestRide : () => act((m) => m.next())}
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
              perform("placeSelected");
              act((m) => m.next());
            },
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
      <DevBar top={env.safeArea.top} onBack={onBack} />
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

function primaryLabel(step: RiderStep, tier: string, fallback?: string): string {
  if (step === "home") return "Set destination";
  if (step === "rideSelect") {
    const chosen = RIDE_TIERS.find((t) => t.id === tier);
    return chosen ? `Request ${chosen.title}` : "Request ride";
  }
  return fallback ?? "Continue";
}
