/**
 * Uber-aligned in-ride scene compositions.
 */
import { useState } from "react";
import { SceneRenderer } from "../SceneRenderer.tsx";
import { InterruptSurface } from "../InterruptSurface.tsx";
import {
  InRideCardStack, RideSheetChrome, MapChromeButtons, rideDark,
} from "../ride-cards.tsx";
import {
  RideDetailsInterrupt, DriverDetailsInterrupt, SafetyInterrupt,
} from "../ride-interrupts.tsx";
import { ActivityScene } from "../activity.tsx";
import type { PresentationEnvironment } from "../../policy/environment.ts";
import { surfaceId, sceneId } from "../../core/index.ts";
import { IN_RIDE } from "../../fixtures/in-ride.ts";
import type { MapPoint } from "../../core/map.ts";
import { radius, spacing } from "../../tokens/index.ts";

const PRIMARY = surfaceId("primary");
const ONTARIO: MapPoint = { id: "o", role: "origin", latitude: 34.06, longitude: -117.6, label: "Ontario, CA" };
const HOME: MapPoint = { id: "d", role: "destination", latitude: 34.05, longitude: -118.25, label: "Home" };

export type InRideInterrupt = "none" | "trip" | "driver" | "safety";

export function InRideSpatialScene({
  env,
  tipValue: tipProp,
  interrupt: interruptProp,
  onInterruptChange,
}: {
  env: PresentationEnvironment;
  tipValue?: number;
  interrupt?: InRideInterrupt;
  onInterruptChange?: (i: InRideInterrupt) => void;
}) {
  const [tip, setTip] = useState(tipProp ?? 4);
  const [interrupt, setInterrupt] = useState<InRideInterrupt>(interruptProp ?? "none");

  const setI = (i: InRideInterrupt) => {
    setInterrupt(i);
    onInterruptChange?.(i);
  };

  const d = IN_RIDE;

  return (
    <div style={{ position: "relative", background: rideDark.canvas, borderRadius: 24, overflow: "hidden" }}>
      <SceneRenderer
        frame={{
          scene: {
            id: sceneId("rider.in_ride"),
            surfaces: { [PRIMARY]: { emphasis: "primary", presentation: "sheet", interaction: "active" } },
            map: {
              mode: "active_route",
              points: [ONTARIO, HOME, { id: "c", role: "subject", latitude: 34.02, longitude: -118.1, label: "Driver" }],
              route: { originId: "o", destinationId: "d" },
              camera: { intent: "follow" },
            },
            metadata: { product: "rider", state: "in_ride" },
          },
        }}
        env={env}
        content={{
          [PRIMARY]: (
            <RideSheetChrome maxHeight={env.viewport.height * 0.62}>
              <InRideCardStack
                dropoffLabel={d.dropoffLabel}
                shareContact={d.shareContact}
                productLabel={d.productLabel}
                destinationLabel={d.destinationLabel}
                driver={d.driver}
                tips={d.tips}
                tipValue={tip}
                tipNote={d.tipNote}
                promo={d.promo}
                onTripMore={() => setI("trip")}
                onTipMore={() => setI("driver")}
                onTip={setTip}
              />
            </RideSheetChrome>
          ),
        }}
      />
      <MapChromeButtons onSafety={() => setI("safety")} />

      <InterruptSurface open={interrupt === "trip"} env={env} variant="ride-dark" label="Ride details" onClose={() => setI("none")}>
        <RideDetailsInterrupt
          destination={d.destinationAddress}
          arrivalLabel="1:37 AM"
          fare={d.fareDisplay}
          payment={d.payment}
          loyalty={d.loyalty}
          onClose={() => setI("none")}
        />
      </InterruptSurface>

      <InterruptSurface open={interrupt === "driver"} env={env} variant="ride-dark" label="Driver details" onClose={() => setI("none")}>
        <DriverDetailsInterrupt
          driver={d.driver}
          plate={d.driver.plate}
          vehicle={d.driver.vehicle}
          tips={d.tips}
          tipValue={tip}
          tipNote={d.tipNote}
          onClose={() => setI("none")}
        />
      </InterruptSurface>

      <InterruptSurface open={interrupt === "safety"} env={env} variant="ride-dark" label="Safety" onClose={() => setI("none")}>
        <SafetyInterrupt
          tools={[...d.safety.tools]}
          protection={[...d.safety.protection]}
          onClose={() => setI("none")}
        />
      </InterruptSurface>
    </div>
  );
}

export function InRideCardStackScene({ tipValue }: { tipValue?: number }) {
  const [tip, setTip] = useState(tipValue ?? 4);
  const d = IN_RIDE;
  return (
    <div style={{ width: 390, background: rideDark.sheet, borderRadius: radius.sheet, overflow: "hidden" }}>
      <RideSheetChrome>
        <InRideCardStack
          dropoffLabel={d.dropoffLabel}
          shareContact={d.shareContact}
          productLabel={d.productLabel}
          destinationLabel={d.destinationLabel}
          driver={d.driver}
          tips={d.tips}
          tipValue={tip}
          tipNote={d.tipNote}
          promo={d.promo}
          onTip={setTip}
        />
      </RideSheetChrome>
    </div>
  );
}

export function RideDetailsScene({ onClose }: { onClose?: () => void }) {
  const d = IN_RIDE;
  return (
    <div style={{ width: 390, background: rideDark.sheet, padding: spacing.xl, borderRadius: radius.sheet }}>
      <RideDetailsInterrupt
        destination={d.destinationAddress}
        arrivalLabel="1:37 AM"
        fare={d.fareDisplay}
        payment={d.payment}
        loyalty={d.loyalty}
        onClose={onClose}
      />
    </div>
  );
}

export function DriverDetailsScene({ onClose }: { onClose?: () => void }) {
  const d = IN_RIDE;
  return (
    <div style={{ width: 390, background: rideDark.sheet, padding: spacing.xl, borderRadius: radius.sheet }}>
      <DriverDetailsInterrupt
        driver={d.driver}
        plate={d.driver.plate}
        vehicle={d.driver.vehicle}
        tips={d.tips}
        tipValue={4}
        tipNote={d.tipNote}
        onClose={onClose}
      />
    </div>
  );
}

export function SafetyScene({ onClose }: { onClose?: () => void }) {
  const d = IN_RIDE;
  return (
    <div style={{ width: 390, background: rideDark.sheet, padding: spacing.xl, borderRadius: radius.sheet }}>
      <SafetyInterrupt
        tools={[...d.safety.tools]}
        protection={[...d.safety.protection]}
        onClose={onClose}
      />
    </div>
  );
}

export function RiderActivityScene() {
  const d = IN_RIDE.activity;
  return (
    <ActivityScene
      ongoing={{ ...d.ongoing, driverInitial: IN_RIDE.driver.initial }}
      past={[...d.past]}
    />
  );
}
