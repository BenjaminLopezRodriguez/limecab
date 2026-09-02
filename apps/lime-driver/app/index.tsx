import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Button, PrimaryAction, SecondaryAction, spacing, typeStyle, typography, useLimeColors } from "@lime/ui";
import type { SurfaceId } from "@lime/interaction-system/core";
import { resolveBack } from "@lime/interaction-system/harness";
import {
  createRegistry,
  DriverScene,
  Icon,
  NativeSceneRenderer,
  NativeShell,
  useInteractionBack,
  useNativeEnvironment,
  type DragIntent,
} from "@lime/interaction-system/native";
import { driverCopy, driverHappyPath, type DriverStep } from "@lime/interaction-system/scenarios";
import { driverRideSurfaces, type DriverRideAction } from "@lime/interaction-system/recipes";
import { LegacyWebSurface, driverFallbackPath } from "@lime/web-bridge";
import { INTERRUPT, MAP, PRIMARY, useSurfaceRuntime } from "../src/useSurfaceRuntime";
import { DevBar } from "../src/DevBar";

function driverRecipe(step: DriverStep, minimized: boolean): DriverRideAction {
  if (minimized) return "minimizeJob";
  if (step === "offline") return "goOffline";
  if (step === "online") return "goOnline";
  if (step === "offer") return "offerIncoming";
  return "working";
}

/**
 * Standalone driver product. Native through offer (Cluster B); later clusters delegate to
 * production web via LegacyWebSurface at the app composition layer (spec §27).
 */
export default function DriverApp() {
  const env = useNativeEnvironment();
  const { step: jumpTo } = useLocalSearchParams<{ step?: string }>();
  const { machine, snapshot, frame, act, perform, snapTo } = useSurfaceRuntime(
    driverHappyPath,
    driverRideSurfaces,
    driverRecipe,
    jumpTo,
  );
  const [worldOpen, setWorldOpen] = useState(false);
  const c = useLimeColors();

  const step = snapshot.step as DriverStep;
  const fallbackPath = driverFallbackPath(step);
  const copy = driverCopy[step];
  const live = machine.isLive();

  const registry = useMemo(
    () =>
      createRegistry([
        [MAP, { component: (() => null) as never, chrome: "canvas" as const }],
        [PRIMARY, DriverScene as never],
        [INTERRUPT, DriverScene as never],
      ]),
    [],
  );

  const dragIntent: Partial<Record<SurfaceId, DragIntent>> = {
    [PRIMARY]: snapshot.minimized ? "none" : live ? "minimize" : "none",
  };

  const onBack = useInteractionBack({
    resolver: (ctx) => resolveBack("driver", live ? "live" : "draft", ctx),
    context: {
      frame,
      hasInterrupt: step === "offer",
      surfaceHistoryDepth: step === "offer" ? 1 : 0,
      workflowCanRegress: !live && machine.canRegress(),
      liveWorkActive: live,
    },
    handlers: {
      returnInterrupt: () => act((m) => m.previous()),
      regressScene: () => act((m) => m.previous()),
      minimizeLiveWork: () => act((m) => m.minimize()),
      delegateToHost: () => act((m) => m.jump("offline")),
    },
  });

  const actions = snapshot.minimized ? (
    <PrimaryAction label="Resume job" onPress={() => act((m) => m.restore())} />
  ) : (
    <View style={{ gap: spacing.sm }}>
      {step === "online" ? null : step === "offline" ? (
        <Button variant="accent" onPress={() => act((m) => m.next())} style={{ width: "100%" }}>
          <Icon name="Steering" size={20} color={c.accentForeground} />
          <Text style={{ ...typeStyle(typography.cta), color: c.accentForeground }}>Go online</Text>
        </Button>
      ) : machine.canAdvance() ? (
        <PrimaryAction label={copy.primaryAction ?? "Continue"} onPress={() => act((m) => m.next())} />
      ) : (
        <PrimaryAction label="Back online" onPress={() => act((m) => m.jump("online"))} />
      )}
      {copy.secondaryAction ? (
        <SecondaryAction label={copy.secondaryAction} onPress={() => act((m) => m.previous())} />
      ) : live ? (
        <SecondaryAction label="Minimize" onPress={() => act((m) => m.minimize())} />
      ) : null}
    </View>
  );

  if (fallbackPath) {
    return (
      <LegacyWebSurface
        path={fallbackPath}
        product="driver"
        onEvent={(event) => {
          if (event.type === "close") act((m) => m.jump("offline"));
        }}
      />
    );
  }

  return (
    <NativeShell intent={frame.shell}>
      <NativeSceneRenderer
        frame={frame}
        env={env}
        registry={registry}
        data={{
          [PRIMARY]: {
            step: step === "offer" ? "online" : step,
            map: frame.scene.map,
            env,
          },
          [INTERRUPT]: { step: "offer" },
        }}
        actions={{ [PRIMARY]: step === "offer" ? null : actions, [INTERRUPT]: step === "offer" ? actions : null }}
        dragIntent={dragIntent}
        onSnapTo={(_, destination) => snapTo(destination, "minimize")}
        onPick={() => {
          if (step !== "online") return;
          perform(worldOpen ? "collapseIdleMap" : "expandIdleMap");
          setWorldOpen((open) => !open);
        }}
      />
      <DevBar top={env.safeArea.top} onBack={onBack} onNext={machine.canAdvance() ? () => act((m) => m.next()) : undefined} />
    </NativeShell>
  );
}
