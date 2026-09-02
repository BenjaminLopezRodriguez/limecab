import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
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
import { LegacyWebSurface, riderFallbackPath } from "@lime/web-bridge";
import { MAP, PRIMARY, SECONDARY, useSurfaceRuntime } from "../src/useSurfaceRuntime";
import { DevBar } from "../src/DevBar";

const riderSurfaces = createSurfaceManager({
  surfaces: rideSurfaces.surfaces,
  actions: {
    ...rideSurfaces.actions,
    showLauncher: { intent: "collapse", surfaces: launcher },
  },
});

type RiderAction = keyof (typeof riderSurfaces)["actions"];

/**
 * Standalone rider product. Native through quote; unimplemented Cluster C+ states delegate to
 * production web via LegacyWebSurface at the app composition layer (spec §27).
 */
export default function RiderApp() {
  const env = useNativeEnvironment();
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
  const progress = useSurfaceProgress({ reducedMotion: env.reducedMotion });

  const step = snapshot.step as RiderStep;
  const fallbackPath = riderFallbackPath(step);
  const copy = riderCopy[step];
  const live = machine.isLive();
  const searching = frame.scene.surfaces[SECONDARY]?.emphasis !== "hidden";

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
        [MAP, { component: (() => null) as never, chrome: "canvas" as const }],
        [PRIMARY, RiderScene as never],
        [SECONDARY, SearchScene as never],
      ]),
    [],
  );

  const dragIntent: Partial<Record<SurfaceId, DragIntent>> = {
    [PRIMARY]: snapshot.minimized ? "none" : live ? "minimize" : machine.canRegress() ? "dismiss" : "none",
  };

  const restoreStepSurface = () => perform(riderRecipe(step, snapshot.minimized));

  const onBack = useInteractionBack({
    resolver: (ctx) =>
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
      dismissTransient: restoreStepSurface,
      returnInterrupt: () => act((m) => m.closeInterrupt()),
      regressScene: () => act((m) => m.previous()),
      minimizeLiveWork: () => act((m) => m.minimize()),
      delegateToHost: () => act((m) => m.jump("home")),
    },
  });

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
        <PrimaryAction label="Done" onPress={() => act((m) => m.jump("home"))} />
      )}
      {live ? <SecondaryAction label="Minimize" onPress={() => act((m) => m.minimize())} /> : null}
    </View>
  );

  if (fallbackPath) {
    return (
      <LegacyWebSurface
        path={fallbackPath}
        product="rider"
        onEvent={(event) => {
          if (event.type === "close") act((m) => m.jump("home"));
        }}
      />
    );
  }

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

const dispatchRide = () => new Promise<void>((resolve) => setTimeout(resolve, 900));

function riderRecipe(step: RiderStep, minimized: boolean): RiderAction {
  if (minimized) return "minimizeRide";
  switch (step) {
    case "home":
      return "showLauncher";
    case "confirmPickup":
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
