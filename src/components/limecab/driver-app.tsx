"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Call02Icon, Shield01Icon } from "@hugeicons/core-free-icons";

import { useAdaptiveSurface } from "@/components/service-app/adaptive-surface";
import { AdaptiveSurface } from "@/components/service-app/adaptive-surface";
import { createMapboxAdapter } from "@/components/service-app/mapbox-adapter";
import { ServiceAppShell } from "@/components/service-app/service-app-shell";
import { ServiceMap } from "@/components/service-app/service-map";
import { ServiceSheet } from "@/components/service-app/service-sheet";
import { SurfaceSkeleton } from "@/components/service-app/surface-skeleton";
import {
  ManagedSurface,
  SurfaceManagerProvider,
  useSurfaceManager,
} from "@/components/service-app/surface-manager";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  advanceActionFor,
  DriverCompleteScene,
  DriverDutyScene,
  DriverJobScene,
  DriverOfferScene,
  MapControl,
  type JobTrip,
  type OfferTrip,
} from "@/components/limecab/driver-scenes";
import {
  DRIVER_MAP_MODE,
  DRIVER_SCENE_SURFACES,
  driverSurfaces,
  type DriverSurfaceAction,
  type DriverSurfaceId,
} from "@/components/limecab/driver-surfaces";
import { isCourierProduct } from "@/lib/limecab/courier";
import {
  driverAppQuestion,
  driverSceneForTripStatus,
  isDriving,
  reduceDriverAppState,
  type DriverAppEvent,
  type DriverAppState,
} from "@/lib/limecab/driver-state";
import { CURRENT_LOCATION, SAVED_PLACES } from "@/lib/limecab/mock";
import { fetchDrivingRoute } from "@/lib/service-app/directions";
import type { MapPoint } from "@/lib/service-app/map-adapter";
import { splitAddress } from "@/lib/service-app/services";
import { env } from "@/env";
import { api, type RouterOutputs } from "@/trpc/react";

/**
 * The driver app — a duty session, not an inbox.
 *
 * The map is the product: it stays mounted from off duty, through an offer,
 * through the job, and back. One sheet floats over it holding exactly one
 * question, and an incoming ride interrupts that sheet rather than appending
 * a row to a list nobody can read from a car mount.
 *
 * Everything mechanical underneath — surfaces, interruption/return, the async
 * choreography, map postures — is the service-app kit unchanged. The trip
 * itself belongs to the server: `driver.advance` and the trip state machine
 * decide what is legal, and this only ever offers the one legal action.
 */

type Inbox = RouterOutputs["driver"]["inbox"];
type ActiveTrip = Inbox["active"][number];

/** How long a driver gets to decide. The countdown *is* the decline. */
const OFFER_SECONDS = 20;

/** While hunting, a four-second list refresh is a missed ride. */
const HUNTING_MS = 1_000;
const RESTING_MS = 4_000;

/** The fare stays up for a beat, then the driver is back in the hunt. */
const FARE_SPLASH_MS = 2_600;

const mapAdapter = env.NEXT_PUBLIC_MAPBOX_TOKEN
  ? createMapboxAdapter(env.NEXT_PUBLIC_MAPBOX_TOKEN)
  : undefined;

const FALLBACK_POINT: MapPoint = {
  latitude: CURRENT_LOCATION.latitude!,
  longitude: CURRENT_LOCATION.longitude!,
};

const HEADING_PRESETS = SAVED_PLACES.filter((place) =>
  ["home", "work", "union"].includes(place.id),
);

export function DriverApp({ driverInitial }: { driverInitial: string }) {
  return (
    <SurfaceManagerProvider manager={driverSurfaces}>
      <DriverFlow driverInitial={driverInitial} />
    </SurfaceManagerProvider>
  );
}

function DriverFlow({ driverInitial }: { driverInitial: string }) {
  const surfaces = useSurfaceManager<DriverSurfaceId, DriverSurfaceAction>();

  const [scene, setScene] = useState<DriverAppState>("offline");
  /** The one ride being offered. App data, not a scene and not a boolean. */
  const [offeredId, setOfferedId] = useState<string | null>(null);
  const [declined, setDeclined] = useState<string[]>([]);
  /**
   * The finished trip, held for the fare splash. It has already left
   * `inbox.active` — a completed trip is terminal — so the scene keeps its
   * own copy rather than reading a row that no longer exists.
   */
  const [finished, setFinished] = useState<JobTrip | null>(null);
  const [device, setDevice] = useState<MapPoint | null>(null);
  const [route, setRoute] = useState<MapPoint[] | null>(null);

  const hunting = scene === "online" && offeredId === null;
  const inbox = api.driver.inbox.useQuery(undefined, {
    refetchInterval: hunting ? HUNTING_MS : RESTING_MS,
  });

  const available = inbox.data?.driver?.available ?? false;
  const todayCents = inbox.data?.todayCents ?? 0;
  const headingAddress = inbox.data?.driver?.headingAddress ?? null;
  const open = useMemo(() => inbox.data?.open ?? [], [inbox.data?.open]);
  // A driver holds at most one live job; if the server ever returns more, the
  // newest is the one they are actually doing.
  const active = inbox.data?.active[0] ?? null;
  const activeStatus = active?.status ?? null;

  const go = useCallback(
    (event: DriverAppEvent) =>
      setScene((current) => reduceDriverAppState(current, event)),
    [],
  );

  /**
   * The server is the truth about a live job. This only corrects drift — a
   * refresh mid-job, a rider cancelling, duty changed on another device — so
   * the driver never lands on the GO button with a rider in the car.
   */
  useEffect(() => {
    // The fare splash is this client's moment; it outlives the trip row.
    if (scene === "complete") return;
    const target = activeStatus
      ? (driverSceneForTripStatus(activeStatus) ?? scene)
      : available
        ? "online"
        : "offline";
    if (target !== scene) setScene(target);
  }, [activeStatus, available, scene]);

  // The scene says which question; the recipe says how the surfaces sit.
  useEffect(() => {
    surfaces.apply("progress", DRIVER_SCENE_SURFACES[scene]);
  }, [scene, surfaces]);

  /**
   * The device fix, live. The driver *is* the provider point on this canvas,
   * so the follow-cam has something real to follow.
   */
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      ({ coords }) =>
        setDevice({
          latitude: coords.latitude,
          longitude: coords.longitude,
          kind: "provider",
          heading: coords.heading ?? undefined,
        }),
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const driverPoint = useMemo<MapPoint>(
    () => ({ ...(device ?? FALLBACK_POINT), kind: "provider" }),
    [device],
  );

  const offer = useMemo(
    () => open.find((trip) => trip.id === offeredId) ?? null,
    [offeredId, open],
  );

  /**
   * The best open ride, by deadhead — Uber's default when the driver is not
   * surfing a destination filter. One offer at a time; the rest wait.
   */
  const candidate = useMemo(() => {
    if (!hunting || !available) return null;
    return (
      [...open]
        .filter((trip) => !declined.includes(trip.id))
        .sort((a, b) => a.arrivalMinutes - b.arrivalMinutes)[0] ?? null
    );
  }, [available, declined, hunting, open]);

  const candidateId = candidate?.id ?? null;
  useEffect(() => {
    if (!candidateId) return;
    setOfferedId(candidateId);
    surfaces.perform("offerIncoming");
    alertDriver();
  }, [candidateId, surfaces]);

  /** The ride is the driver's now — it is not declined, it is theirs. */
  const clearOffer = useCallback(() => setOfferedId(null), []);

  const dismissOffer = useCallback(
    (tripId: string) => {
      setDeclined((current) =>
        current.includes(tripId) ? current : [...current, tripId],
      );
      setOfferedId(null);
      surfaces.perform("offerDismissed");
    },
    [surfaces],
  );

  /* ---- what the canvas is showing ------------------------------------- */

  const job: JobTrip | null = useMemo(() => {
    if (scene === "complete") return finished;
    return active ? toJobTrip(active) : null;
  }, [active, finished, scene]);

  /** The point the driver is currently driving to. */
  const target = useMemo<MapPoint | null>(() => {
    const trip = offer ?? active;
    if (!trip) return null;
    const toDestination = scene === "on_trip" || scene === "complete";
    const latitude = toDestination
      ? trip.destinationLatitude
      : trip.pickupLatitude;
    const longitude = toDestination
      ? trip.destinationLongitude
      : trip.pickupLongitude;
    if (latitude == null || longitude == null) return null;
    return {
      latitude,
      longitude,
      kind: toDestination ? "destination" : "origin",
    };
  }, [active, offer, scene]);

  /**
   * One route request per leg, not per GPS tick: the geometry is drawn from
   * where the leg started. This build has no turn-by-turn and does not
   * pretend to — `Open in Maps` is the honest escape hatch.
   */
  const legKey = target
    ? `${offer?.id ?? active?.id ?? ""}:${target.kind}`
    : null;
  const legStart = useRef(driverPoint);
  legStart.current = driverPoint;
  useEffect(() => {
    if (!legKey || !target) {
      setRoute(null);
      return;
    }
    const from = legStart.current;
    const ac = new AbortController();
    void fetchDrivingRoute(from, target, ac.signal)
      .then(setRoute)
      .catch(() => {
        if (!ac.signal.aborted) setRoute([from, target]);
      });
    return () => ac.abort();
    // The leg — not the moving car — is what defines this request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legKey]);

  const mapPosture = surfaces.layout.map?.presentation ?? "idle";
  const points = useMemo(
    () => (target ? [driverPoint, target] : [driverPoint]),
    [driverPoint, target],
  );

  const jobChip = job ?? offer;

  return (
    <ServiceAppShell
      layout="task"
      map={
        <ManagedSurface<DriverSurfaceId> id="map">
          <div className="relative size-full">
            <ServiceMap
              adapter={mapAdapter}
              mode={DRIVER_MAP_MODE[mapPosture] ?? "home"}
              center={scene === "complete" ? (target ?? driverPoint) : driverPoint}
              // ponytail: the canvas follows the device on every fix, so
              // there is nothing to recentre and nothing to pan away from.
              // Pan needs a kit prop to suppress the pin crosshair; add it
              // when a driver actually asks to look somewhere else.
              interactive={false}
              points={points}
              route={route ?? undefined}
            />

            {/* Canvas controls. Account and safety are always one tap away and
                never compete with the scene's own action. */}
            <div className="absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex items-start justify-between gap-3">
              <Link
                href="/driver/profile"
                aria-label="Your profile"
                className="bg-card ring-border focus-visible:ring-ring flex size-11 items-center justify-center rounded-full text-[17px] font-semibold tracking-tight shadow-[0_4px_16px_rgba(26,24,20,0.12)] ring-1 focus-visible:ring-2 focus-visible:outline-none"
              >
                {driverInitial}
              </Link>
              <div className="flex gap-2">
                <MapControl label="Safety toolkit" href="/driver/profile/safety">
                  <Icon icon={Shield01Icon} size={20} aria-hidden="true" />
                </MapControl>
                <MapControl label="Call 911" href="tel:911">
                  <Icon
                    icon={Call02Icon}
                    size={20}
                    className="text-destructive"
                    aria-hidden="true"
                  />
                </MapControl>
              </div>
            </div>

            {jobChip ? (
              <p className="bg-card/95 ring-border absolute inset-x-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.25rem)] z-10 truncate rounded-full px-4 py-2 text-[15px] font-medium tracking-tight shadow-[0_4px_16px_rgba(26,24,20,0.12)] ring-1 backdrop-blur-sm">
                {splitAddress(jobChip.pickupAddress).line}
                <span className="text-muted-foreground"> → </span>
                {splitAddress(jobChip.destinationAddress).line}
              </p>
            ) : null}

          </div>
        </ManagedSurface>
      }
    >
      <DriverSurfaces
        scene={scene}
        go={go}
        offer={offer}
        job={job}
        todayCents={todayCents}
        headingAddress={headingAddress}
        loading={!inbox.data}
        onDismissOffer={dismissOffer}
        onOfferTaken={clearOffer}
        onFinished={setFinished}
        onResumed={() => setFinished(null)}
        refresh={inbox.refetch}
      />
    </ServiceAppShell>
  );
}

/* ------------------------------------------------------------- surfaces */

function DriverSurfaces({
  scene,
  go,
  offer,
  job,
  todayCents,
  headingAddress,
  loading,
  onDismissOffer,
  onOfferTaken,
  onFinished,
  onResumed,
  refresh,
}: {
  scene: DriverAppState;
  go: (event: DriverAppEvent) => void;
  offer: OfferTrip | null;
  job: JobTrip | null;
  todayCents: number;
  headingAddress: string | null;
  loading: boolean;
  onDismissOffer: (tripId: string) => void;
  onOfferTaken: () => void;
  onFinished: (trip: JobTrip) => void;
  onResumed: () => void;
  refresh: () => Promise<unknown>;
}) {
  const surface = useAdaptiveSurface();
  const surfaces = useSurfaceManager<DriverSurfaceId, DriverSurfaceAction>();
  const [aside, setAside] = useState<"heading" | null>(null);
  const [pickupCode, setPickupCode] = useState("");
  const [deliveryCode, setDeliveryCode] = useState("");
  const [left, setLeft] = useState(OFFER_SECONDS);
  /**
   * The last refusal, owned here rather than read off the progress machine:
   * its `error` survives until the next transition starts, and a stale
   * "no longer available" on the *next* ride's card would be a lie.
   */
  const [failure, setFailure] = useState<string | null>(null);

  const setAvailable = api.driver.setAvailable.useMutation();
  const setHeading = api.driver.setHeading.useMutation();
  const accept = api.driver.accept.useMutation();
  const advance = api.driver.advance.useMutation();

  const courier = job ? isCourierProduct(job.productId) : false;

  /* ---- duty ------------------------------------------------------------ */

  const setDuty = (next: boolean) => {
    if (surface.progress.locked) return;
    setFailure(null);
    surfaces.perform(next ? "goOnline" : "goOffline");
    void surface
      .transition({
        intent: "progress",
        from: next ? "offline" : "online",
        to: next ? "online" : "offline",
        task: async () => {
          await setAvailable.mutateAsync({ available: next });
          await refresh();
        },
      })
      .then(
        () => go(next ? "go_online" : "go_offline"),
        // The transition restores the peek; the reason goes beside the button.
        (reason: unknown) => setFailure(errorMessage(reason)),
      );
  };

  /* ---- the offer ------------------------------------------------------- */

  const offerId = offer?.id ?? null;
  // A fresh ride starts with a clean slate.
  useEffect(() => {
    if (offerId) setFailure(null);
  }, [offerId]);

  const dismiss = useRef(onDismissOffer);
  dismiss.current = onDismissOffer;
  const locked = surface.progress.locked;

  useEffect(() => {
    if (!offerId) return;
    setLeft(OFFER_SECONDS);
    const started = Date.now();
    const id = window.setInterval(() => {
      const remaining =
        OFFER_SECONDS - Math.floor((Date.now() - started) / 1000);
      // Never yank an offer out from under a driver mid-accept.
      if (remaining <= 0 && !locked) {
        window.clearInterval(id);
        dismiss.current(offerId);
        return;
      }
      setLeft(Math.max(0, remaining));
    }, 250);
    return () => window.clearInterval(id);
  }, [locked, offerId]);

  /**
   * Accept is a progression, not a return: there is no offer to come back to
   * once the ride is the driver's. A CONFLICT — someone else was faster —
   * lands them back on the idle peek with the reason, never on a dead route.
   */
  const acceptOffer = () => {
    if (!offer || surface.progress.locked) return;
    const tripId = offer.id;
    setFailure(null);
    void surface
      .transition({
        intent: "progress",
        from: "online",
        to: "to_pickup",
        interim: "map",
        task: async () => {
          await accept.mutateAsync({ tripId });
          await refresh();
        },
      })
      .then(
        () => {
          onOfferTaken();
          surfaces.perform("accepted");
          go("accepted");
        },
        (reason: unknown) => {
          setFailure(errorMessage(reason));
          onDismissOffer(tripId);
        },
      );
  };

  /* ---- the job --------------------------------------------------------- */

  const action = advanceActionFor(scene);

  const runAdvance = () => {
    if (!job || !action || surface.progress.locked) return;
    setFailure(null);
    const next =
      action === "arrive"
        ? "at_pickup"
        : action === "start"
          ? "on_trip"
          : "complete";
    void surface
      .transition({
        intent: "progress",
        from: scene,
        to: next,
        task: async () => {
          await advance.mutateAsync({
            tripId: job.id,
            action,
            ...(courier && action === "start" ? { pickupCode } : {}),
            ...(courier && action === "complete"
              ? {
                  submittedPin:
                    job.deliveryProof === "hand" ? deliveryCode : undefined,
                  leftAtDoor: job.deliveryProof === "door" ? true : undefined,
                  signatureCaptured:
                    job.deliveryProof === "signature" ? true : undefined,
                }
              : {}),
          });
          // The completed row leaves `active`, so keep it for the splash
          // *before* the refetch takes it away.
          if (action === "complete") onFinished(job);
          await refresh();
        },
      })
      .then(
        () => {
          surfaces.perform(
            action === "arrive"
              ? "arrived"
              : action === "start"
                ? "started"
                : "completed",
          );
          go(
            action === "arrive"
              ? "arrived"
              : action === "start"
                ? "started"
                : "completed",
          );
          setPickupCode("");
          setDeliveryCode("");
        },
        (reason: unknown) => setFailure(errorMessage(reason)),
      );
  };

  /** The fare is read, not dismissed into a dead end. */
  const resumeIdle = useCallback(() => {
    surfaces.perform("resumeIdle");
    go("done");
    onResumed();
  }, [go, onResumed, surfaces]);

  useEffect(() => {
    if (scene !== "complete") return;
    const id = window.setTimeout(resumeIdle, FARE_SPLASH_MS);
    return () => window.clearTimeout(id);
  }, [resumeIdle, scene]);

  const closeAside = () => {
    setAside(null);
    surfaces.perform("closeAside");
  };

  // Mid-transition the sheet shows the scene the choreography is on, not the
  // one the app has already moved to.
  const visible =
    surface.progress.phase === "idle"
      ? scene
      : ((surface.progress.content as DriverAppState | null) ?? scene);
  const question = driverAppQuestion(visible, courier);

  return (
    <>
      <div className="sr-only" aria-live="polite">
        {question.question} {question.action}.
      </div>

      <ManagedSurface<DriverSurfaceId> id="primary">
        <ServiceSheet
          label="Your duty session"
          presentation={visible === "offline" || visible === "online" ? "peek" : "sheet"}
        >
          {loading ? <SurfaceSkeleton lines={2} /> : null}

          {!loading && (visible === "offline" || visible === "online") ? (
            <DriverDutyScene
              scene={visible}
              todayCents={todayCents}
              headingAddress={headingAddress}
              busy={surface.progress.locked}
              error={failure}
              onGoOnline={() => setDuty(true)}
              onGoOffline={() => setDuty(false)}
              onOpenHeading={() => {
                surfaces.perform("openHeading");
                setAside("heading");
              }}
            />
          ) : null}

          {/* Nothing about a job is asserted until the server has confirmed
              one: no address, no rider, no PIN before the row exists. */}
          {!loading && isDriving(visible) ? (
            job ? (
              <DriverJobScene
                scene={visible as "to_pickup" | "at_pickup" | "on_trip"}
                trip={job}
                courier={courier}
                pickupCode={pickupCode}
                onPickupCode={setPickupCode}
                deliveryCode={deliveryCode}
                onDeliveryCode={setDeliveryCode}
                busy={surface.progress.locked}
                error={failure}
                onAdvance={runAdvance}
              />
            ) : (
              <SurfaceSkeleton lines={3} />
            )
          ) : null}

          {!loading && visible === "complete" && job ? (
            <DriverCompleteScene
              trip={job}
              todayCents={todayCents}
              courier={courier}
              onDone={resumeIdle}
            />
          ) : null}
        </ServiceSheet>
      </ManagedSurface>

      {/* The offer suspends the peek; it never replaces it. Declining puts
          the driver back exactly where they were. */}
      <AdaptiveSurface.Interrupt
        id="offer"
        open={Boolean(offer)}
        onOpenChange={(next) => {
          if (!next && offer) onDismissOffer(offer.id);
        }}
        locked={surface.progress.locked}
        label={offer && isCourierProduct(offer.productId) ? "Delivery offer" : "Ride offer"}
      >
        {offer ? (
          <DriverOfferScene
            trip={offer}
            secondsLeft={left}
            totalSeconds={OFFER_SECONDS}
            busy={surface.progress.locked}
            onAccept={acceptOffer}
            onDecline={() => onDismissOffer(offer.id)}
          />
        ) : null}
      </AdaptiveSurface.Interrupt>

      <AdaptiveSurface.Interrupt
        id="heading"
        open={aside === "heading"}
        onOpenChange={(next) => {
          if (!next) closeAside();
        }}
        label="Where are you heading?"
        description="You’ll only be offered rides that end up that way."
      >
        <HeadingChoice
          address={headingAddress}
          busy={setHeading.isPending}
          onChoose={(place) => {
            setHeading.mutate(place, {
              onSettled: () => {
                void refresh();
                closeAside();
              },
            });
          }}
        />
      </AdaptiveSurface.Interrupt>
    </>
  );
}

function HeadingChoice({
  address,
  busy,
  onChoose,
}: {
  address: string | null;
  busy: boolean;
  onChoose: (place: {
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  }) => void;
}) {
  const options = [
    { id: "anywhere", label: "Anywhere", address: null, latitude: null, longitude: null },
    ...HEADING_PRESETS.map((place) => ({
      id: place.id,
      label: place.label,
      address: place.address,
      latitude: place.latitude ?? null,
      longitude: place.longitude ?? null,
    })),
  ];

  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => {
        const active = (option.address ?? null) === address;
        return (
          <Button
            key={option.id}
            variant={active ? "default" : "outline"}
            className="h-14 w-full justify-start text-[17px]"
            disabled={busy}
            onClick={() =>
              onChoose({
                address: option.address,
                latitude: option.latitude,
                longitude: option.longitude,
              })
            }
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- helpers */

function errorMessage(reason: unknown): string {
  return reason instanceof Error && reason.message.trim()
    ? reason.message
    : "Something went wrong. Nothing changed.";
}

function toJobTrip(trip: ActiveTrip): JobTrip {
  return {
    id: trip.id,
    status: trip.status,
    productId: trip.productId,
    totalCents: trip.totalCents,
    distanceMiles: trip.distanceMiles,
    tripMinutes: trip.tripMinutes,
    arrivalMinutes: trip.arrivalMinutes,
    pickupAddress: trip.pickupAddress,
    pickupMeetingPoint: trip.pickupMeetingPoint,
    destinationAddress: trip.destinationAddress,
    // Courier codes stay with the merchant and the recipient; the driver
    // types what they are shown.
    pickupPin: isCourierProduct(trip.productId) ? null : trip.pickupPin,
    riderName: trip.riderName,
    riderPhone: trip.riderPhone,
    recipientName: trip.recipientName,
    recipientPhone: trip.recipientPhone,
    packageCount: trip.packageCount,
    deliveryProof: trip.deliveryProof,
  };
}

/**
 * Drivers listen for the ping with the phone on the dash. If autoplay is
 * blocked the visual interrupt is still the whole product — this never
 * throws its way into breaking one.
 */
function alertDriver() {
  try {
    navigator.vibrate?.([90, 60, 90]);
  } catch {
    // Vibration is a nicety, never a dependency.
  }
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.52);
    osc.onended = () => void ctx.close();
  } catch {
    // Autoplay policy, no AudioContext, a locked device: the sheet is enough.
  }
}
