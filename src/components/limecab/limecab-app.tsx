"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Car,
  Check,
  ChevronRight,
  CreditCard,
  MessageCircle,
  Phone,
  RotateCcw,
  Sparkles,
  Star,
  Tag,
  Users,
} from "lucide-react";

import {
  AdaptiveSurface,
  useAdaptiveSurface,
} from "@/components/service-app/adaptive-surface";
import { CompletionPanel } from "@/components/service-app/completion-panel";
import { ConfirmActionSurface } from "@/components/service-app/confirm-action-surface";
import { LocationSearchScene } from "@/components/service-app/location-search-scene";
import { LocationTrigger } from "@/components/service-app/location-trigger";
import { ProviderCard } from "@/components/service-app/provider-card";
import { QuotePanel } from "@/components/service-app/quote-panel";
import { SavedPlaces } from "@/components/service-app/saved-places";
import { ServiceAppShell } from "@/components/service-app/service-app-shell";
import { ServiceGrid } from "@/components/service-app/service-grid";
import { ServiceMap } from "@/components/service-app/service-map";
import { ServiceSheet } from "@/components/service-app/service-sheet";
import { ServiceStatusPanel } from "@/components/service-app/service-status";
import {
  ManagedSurface,
  SurfaceManagerProvider,
  useSurfaceManager,
} from "@/components/service-app/surface-manager";
import { SurfaceSkeleton } from "@/components/service-app/surface-skeleton";
import { PrimaryAction } from "@/components/service-app/task-scene";
import { Button } from "@/components/ui/button";
import {
  LIMECAB_MAP_MODE,
  LIMECAB_SCENE_SURFACES,
  limeCabSurfaces,
  type LimeCabAction,
  type LimeCabSurfaceId,
} from "@/components/limecab/surfaces";
import {
  clockTime,
  vehicleLabel,
  TIP_PRESETS,
  type RideProduct,
  type Trip,
} from "@/lib/limecab/domain";
import {
  AVAILABLE_PROMO,
  CURRENT_LOCATION,
  DRIVER_START,
  LAST_TRIP,
  NEARBY_DRIVERS,
  PAYMENT_METHODS,
  RIDE_PRODUCTS,
  SAVED_PLACES,
  geocodeAdapter,
  lerpPoint,
  matchDriver,
  quoteFor,
  submitRideRequest,
} from "@/lib/limecab/mock";
import type { MapPoint } from "@/lib/service-app/map-adapter";
import {
  formatMoney,
  splitAddress,
  type Location,
  type Place,
  type ServiceDefinition,
} from "@/lib/service-app/services";
import {
  isCommitted,
  reduceServiceAppState,
  serviceAppQuestion,
  type ServiceAppEvent,
  type ServiceAppState,
} from "@/lib/service-app/state";
import type { ServiceStatus } from "@/lib/service-app/status";
import { cn } from "@/lib/utils";

/**
 * LimeCab — the ride flow.
 *
 * Product composition only: the ride catalogue, the fare, the driver, the
 * mocked dispatch, and the copy. Every interaction mechanic underneath it
 * (surfaces, scenes, async choreography, map postures, waiting states) comes
 * from the service-app kit unchanged.
 */

const PRODUCT_ICON = {
  lime: <Car strokeWidth={1.7} />,
  "lime-xl": <Users strokeWidth={1.7} />,
  "lime-comfort": <Sparkles strokeWidth={1.7} />,
  "lime-pool": <Users strokeWidth={1.7} />,
} as Record<string, React.ReactNode>;

/** Mocked lifecycle: how long each committed phase lasts. */
const PHASE_MS: Partial<Record<ServiceAppState, number>> = {
  assigned: 2500,
  provider_en_route: 15_000,
  active: 16_000,
  completing: 2500,
};

const NEXT_EVENT: Partial<Record<ServiceAppState, ServiceAppEvent>> = {
  assigned: "provider_moving",
  provider_en_route: "service_started",
  active: "service_finishing",
  completing: "service_complete",
};

/** The tail of the en-route phase, where the question becomes "which car?". */
const ARRIVED_AT = 0.82;

export function LimeCabApp({
  onSceneChange,
}: {
  /** The shell hides its chrome once the rider is inside a task. */
  onSceneChange?: (state: ServiceAppState) => void;
}) {
  return (
    <SurfaceManagerProvider manager={limeCabSurfaces}>
      <LimeCabFlow onSceneChange={onSceneChange} />
    </SurfaceManagerProvider>
  );
}

function LimeCabFlow({
  onSceneChange,
}: {
  onSceneChange?: (state: ServiceAppState) => void;
}) {
  const surfaces = useSurfaceManager<LimeCabSurfaceId, LimeCabAction>();

  const [state, setState] = useState<ServiceAppState>("home");
  const [pickup, setPickup] = useState(CURRENT_LOCATION);
  const [destination, setDestination] = useState<Location | null>(null);
  const [searchTarget, setSearchTarget] = useState<"pickup" | "destination">(
    "destination",
  );
  const [productId, setProductId] = useState<string | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [phaseStart, setPhaseStart] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  const product = RIDE_PRODUCTS.find((entry) => entry.id === productId) ?? null;
  const available = product?.status === "available";

  // The scene says which step; the recipe says how the surfaces sit around it.
  useEffect(() => {
    surfaces.apply("progress", LIMECAB_SCENE_SURFACES[state]);
  }, [state, surfaces]);

  useEffect(() => {
    onSceneChange?.(state);
  }, [onSceneChange, state]);

  // One clock drives every estimate and the car's position.
  useEffect(() => {
    if (!isCommitted(state) || state === "complete") return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [state]);

  // Mocked lifecycle advance. A real app advances on dispatch events.
  useEffect(() => {
    const next = NEXT_EVENT[state];
    const ms = PHASE_MS[state];
    if (!next || !ms) return;
    const id = setTimeout(() => {
      setPhaseStart(Date.now());
      setNow(Date.now());
      setState((current) =>
        reduceServiceAppState(current, next, {
          hasLocation: true,
          hasService: true,
          needsConfigure: false,
        }),
      );
    }, ms);
    return () => clearTimeout(id);
  }, [state]);

  const go = useCallback(
    (
      event: ServiceAppEvent,
      overrides?: Partial<{ hasLocation: boolean; hasService: boolean }>,
    ) =>
      setState((current) =>
        reduceServiceAppState(current, event, {
          hasLocation: Boolean(destination),
          hasService: Boolean(available),
          needsConfigure: false,
          ...overrides,
        }),
      ),
    [available, destination],
  );

  const duration = PHASE_MS[state] ?? 0;
  const t = duration > 0 ? Math.min(1, (now - phaseStart) / duration) : 0;
  const arrived = state === "provider_en_route" && t >= ARRIVED_AT;

  const destinationPoint = useMemo<MapPoint | null>(
    () =>
      destination?.latitude !== undefined && destination.longitude !== undefined
        ? {
            latitude: destination.latitude,
            longitude: destination.longitude,
            kind: "destination",
          }
        : null,
    [destination],
  );

  const pickupPoint = useMemo<MapPoint>(
    () => ({
      latitude: pickup.latitude ?? CURRENT_LOCATION.latitude!,
      longitude: pickup.longitude ?? CURRENT_LOCATION.longitude!,
      kind: "origin",
    }),
    [pickup],
  );

  const driverPoint = useMemo<MapPoint | null>(() => {
    if (state === "assigned") {
      return { ...lerpPoint(DRIVER_START, pickupPoint, 0.12), kind: "provider" };
    }
    if (state === "provider_en_route") {
      return {
        ...lerpPoint(DRIVER_START, pickupPoint, 0.12 + 0.88 * (t / ARRIVED_AT)),
        kind: "provider",
      };
    }
    if (
      (state === "active" || state === "completing") &&
      destinationPoint
    ) {
      return {
        ...lerpPoint(pickupPoint, destinationPoint, state === "active" ? t : 1),
        kind: "provider",
      };
    }
    return null;
  }, [destinationPoint, pickupPoint, state, t]);

  const points = useMemo<MapPoint[]>(() => {
    const list: MapPoint[] = [pickupPoint];
    if (destinationPoint && state !== "home") list.push(destinationPoint);
    if (driverPoint) list.push(driverPoint);
    // Idle cars on the home canvas: the rider's first question is whether
    // LimeCab is even available here, and this answers it before any tap.
    if (state === "home" || state === "matching") list.push(...NEARBY_DRIVERS);
    return list;
  }, [destinationPoint, driverPoint, pickupPoint, state]);

  const estimate = useMemo(
    () => (destination ? quoteFor(RIDE_PRODUCTS[0]!, pickup, destination) : null),
    [destination, pickup],
  );

  const status = useMemo<ServiceStatus>(() => {
    if (failure) return { state: "failed", reason: failure };
    switch (state) {
      case "matching":
        return { state: "matching", typicalSeconds: 60 };
      case "assigned":
        return {
          state: "assigned",
          providerName: trip?.driver.name,
          etaSeconds: (trip?.arrivalMinutes ?? 4) * 60,
        };
      case "provider_en_route":
        return arrived
          ? { state: "arriving", providerName: trip?.driver.name }
          : {
              state: "provider_en_route",
              providerName: trip?.driver.name,
              etaSeconds: Math.max(
                30,
                Math.round((trip?.arrivalMinutes ?? 4) * 60 * (1 - t / ARRIVED_AT)),
              ),
            };
      case "active":
        return {
          state: "active",
          completedSteps: Math.floor(t * 4),
          totalSteps: 4,
          currentStep: destination
            ? `On the way to ${splitAddress(destination.address).line}`
            : "On the way",
          remainingSeconds: Math.max(
            30,
            Math.round((trip?.tripMinutes ?? 18) * 60 * (1 - t)),
          ),
        };
      case "completing":
        return { state: "completing", remainingSeconds: 20 };
      case "complete":
        return { state: "complete", summary: "Thanks for riding with LimeCab." };
      default:
        return { state: "pending" };
    }
  }, [arrived, destination, failure, state, t, trip]);

  const mapPosture = surfaces.layout.map?.presentation ?? "bounded";
  const center =
    state === "home" || !destinationPoint ? pickupPoint : destinationPoint;

  const openSearch = useRef<(target: "pickup" | "destination") => void>(
    () => undefined,
  );
  openSearch.current = (target) => {
    setSearchTarget(target);
    surfaces.perform(
      target === "pickup" ? "openPickupSearch" : "openDestinationSearch",
    );
    go("open_search");
  };

  return (
    <ServiceAppShell
      layout={state === "home" ? "home" : "task"}
      onMapPress={() => openSearch.current("destination")}
      map={
        <ManagedSurface<LimeCabSurfaceId> id="map">
          <ServiceMap
            mode={LIMECAB_MAP_MODE[mapPosture] ?? "home"}
            center={center}
            points={points}
            route={
              destinationPoint && state !== "home"
                ? [pickupPoint, destinationPoint]
                : undefined
            }
            label={
              state === "home"
                ? splitAddress(pickup.address).line
                : (destination?.address ?? pickup.address)
            }
            callout={status.state === "failed" ? null : serviceCallout(status)}
          />
        </ManagedSurface>
      }
    >
      <LimeCabSurfaces
        state={state}
        setState={setState}
        go={go}
        pickup={pickup}
        setPickup={setPickup}
        destination={destination}
        setDestination={setDestination}
        searchTarget={searchTarget}
        openSearch={(target) => openSearch.current(target)}
        product={product}
        setProductId={setProductId}
        trip={trip}
        setTrip={setTrip}
        failure={failure}
        setFailure={setFailure}
        status={status}
        estimate={estimate}
        onPhase={() => {
          setPhaseStart(Date.now());
          setNow(Date.now());
        }}
      />
    </ServiceAppShell>
  );
}

/** Short physical-world marker text. Empty outside arrival-shaped states. */
function serviceCallout(status: ServiceStatus): string | null {
  if (status.state === "assigned" || status.state === "provider_en_route") {
    return `${Math.max(1, Math.ceil(status.etaSeconds / 60))} MIN`;
  }
  if (status.state === "arriving") return "HERE";
  return null;
}

function LimeCabSurfaces({
  state,
  setState,
  go,
  pickup,
  setPickup,
  destination,
  setDestination,
  searchTarget,
  openSearch,
  product,
  setProductId,
  trip,
  setTrip,
  failure,
  setFailure,
  status,
  estimate,
  onPhase,
}: {
  state: ServiceAppState;
  setState: (next: ServiceAppState) => void;
  go: (
    event: ServiceAppEvent,
    overrides?: Partial<{ hasLocation: boolean; hasService: boolean }>,
  ) => void;
  pickup: typeof CURRENT_LOCATION;
  setPickup: (next: typeof CURRENT_LOCATION) => void;
  destination: Location | null;
  setDestination: (next: Location | null) => void;
  searchTarget: "pickup" | "destination";
  openSearch: (target: "pickup" | "destination") => void;
  product: RideProduct | null;
  setProductId: (next: string | null) => void;
  trip: Trip | null;
  setTrip: (next: Trip | null) => void;
  failure: string | null;
  setFailure: (next: string | null) => void;
  status: ServiceStatus;
  estimate: { miles: number; minutes: number } | null;
  onPhase: () => void;
}) {
  const surface = useAdaptiveSurface();
  const surfaces = useSurfaceManager<LimeCabSurfaceId, LimeCabAction>();
  const [unavailable, setUnavailable] = useState<RideProduct | null>(null);
  const [cancelStage, setCancelStage] = useState<"confirm" | "reason" | null>(
    null,
  );
  const [detail, setDetail] = useState<DetailKind | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [paymentId, setPaymentId] = useState(PAYMENT_METHODS[0]!.id);
  const [promoApplied, setPromoApplied] = useState(false);
  const [tipCents, setTipCents] = useState<number | null>(null);
  const [quoteReady, setQuoteReady] = useState(false);

  // Mid-transition the surface shows the scene the choreography is on, not the
  // scene the app has already moved to.
  const visible =
    surface.progress.phase === "idle"
      ? state
      : ((surface.progress.content as ServiceAppState | null) ?? state);

  const question = serviceAppQuestion(visible);
  const destinationLine = splitAddress(destination?.address ?? "").line;
  const pickupLine = splitAddress(pickup.address).line;

  // The quote paints its own shape while the fare is priced — no spinner
  // standing in for a surface that already knows its layout.
  useEffect(() => {
    if (visible !== "quote") {
      setQuoteReady(false);
      return;
    }
    const id = setTimeout(() => setQuoteReady(true), 380);
    return () => clearTimeout(id);
  }, [visible, product?.id]);

  const rideOptions = useMemo<ServiceDefinition[]>(() => {
    if (!destination) return [];
    const priced = RIDE_PRODUCTS.map((entry) => ({
      entry,
      fare: quoteFor(entry, pickup, destination).fare,
    }));

    // The two comparisons riders actually make. Marking them is the whole
    // reason the tiers sit in one list instead of behind a picker.
    const sellable = priced.filter(({ entry }) => entry.status === "available");
    const cheapest = sellable.reduce<string | null>(
      (best, item) =>
        best === null ||
        item.fare.totalCents <
          (sellable.find((x) => x.entry.id === best)?.fare.totalCents ?? 0)
          ? item.entry.id
          : best,
      null,
    );
    const fastest = sellable.reduce<string | null>(
      (best, item) =>
        best === null ||
        item.entry.etaMinutes <
          (sellable.find((x) => x.entry.id === best)?.entry.etaMinutes ?? 0)
          ? item.entry.id
          : best,
      null,
    );

    return priced.map(({ entry, fare }) => {
      const badge =
        entry.id === fastest
          ? "Fastest"
          : entry.id === cheapest
            ? "Cheapest"
            : null;
      return {
        id: entry.id,
        title: entry.name,
        description: entry.description,
        icon: PRODUCT_ICON[entry.id],
        status: entry.status,
        meta: {
          value: formatMoney(fare.totalCents),
          // Dropoff as a clock time: "18 min" answers the wrong question when
          // what the rider is really checking is whether they make the 3:30.
          note: `${badge ? `${badge} · ` : ""}${clockTime(
            entry.etaMinutes + (estimate?.minutes ?? 0),
          )} dropoff · ${entry.seats} seats`,
        },
      };
    });
  }, [destination, estimate?.minutes, pickup]);

  const payment =
    PAYMENT_METHODS.find((entry) => entry.id === paymentId) ??
    PAYMENT_METHODS[0]!;
  const discountCents = promoApplied ? AVAILABLE_PROMO.amountCents : 0;

  const quote = useMemo(() => {
    if (!product || !destination) return null;
    const { fare, miles, minutes } = quoteFor(product, pickup, destination);
    return {
      fare,
      miles,
      minutes,
      panel: {
        totalCents: fare.totalCents,
        lines: [
          { label: "Base fare", value: formatMoney(fare.baseCents) },
          {
            label: `Distance · ${miles.toFixed(1)} mi`,
            value: formatMoney(fare.distanceCents),
          },
          {
            label: `Time · ${minutes} min`,
            value: formatMoney(fare.timeCents),
          },
          { label: "Booking fee", value: formatMoney(fare.bookingCents) },
        ],
      },
    };
  }, [destination, pickup, product]);

  /** What the rider is actually charged, after any credit. */
  const payableCents = Math.max(
    0,
    (quote?.fare.totalCents ?? 0) - discountCents,
  );

  const chooseLocation = (result: Location) => {
    if (searchTarget === "pickup") {
      setPickup({ ...pickup, ...result, followsDevice: false });
      go("cancel_search");
      return;
    }
    setDestination(result);
    surfaces.perform("destinationSelected");
    go("select_location", { hasLocation: true });
  };

  const chooseRide = (option: ServiceDefinition) => {
    const next = RIDE_PRODUCTS.find((entry) => entry.id === option.id);
    if (!next) return;
    if (next.status !== "available") {
      // A temporary question about the task: the scene recedes, it is not lost.
      surfaces.perform("interruptCancel");
      setUnavailable(next);
      return;
    }
    setProductId(next.id);
    surfaces.perform("chooseRide");
    go("select_service", { hasService: true });
  };

  /**
   * The perceived-performance path. One semantic action moves three surfaces;
   * the progress machine owns the lock, the choreography, and the truthful
   * order — the quote is gone before "Finding your driver" appears, and no
   * driver exists until dispatch says so.
   */
  const requestRide = () => {
    if (!destination || !product || surface.progress.locked) return;
    setFailure(null);
    void (async () => {
      try {
        surfaces.perform("requestRide");
        const receipt = await surface.transition({
          intent: "progress",
          from: "quote",
          to: "matching",
          interim: "map",
          task: () => submitRideRequest({ pickup, destination, product }),
        });
        onPhase();
        setState("matching");

        const matched = await matchDriver({
          requestId: receipt.requestId,
          pickup,
          destination,
          product,
        });
        setTrip(matched);
        onPhase();
        setState("assigned");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Something went wrong. Nothing was dispatched.";
        if (state === "quote") {
          // Submission failed: the quote comes back untouched.
          surfaces.perform("requestFailed");
          setState("quote");
          return;
        }
        // Matching failed after the request was accepted: stay on the status
        // surface and turn it into something the rider can act on.
        setFailure(message);
      }
    })();
  };

  const backToQuote = () => {
    setFailure(null);
    setTrip(null);
    surfaces.perform("requestFailed");
    setState("quote");
  };

  const reset = () => {
    setFailure(null);
    setTrip(null);
    setProductId(null);
    setDestination(null);
    setRating(null);
    setTipCents(null);
    setPromoApplied(false);
    setPickup(CURRENT_LOCATION);
    setState("home");
  };

  const openDetail = (kind: DetailKind) => {
    surfaces.perform("openDetails");
    setDetail(kind);
  };

  /** Cancellation is done; the reason is optional telemetry, not a gate. */
  const finishCancel = (reason?: string) => {
    if (reason) console.info("[LimeCab] cancellation reason:", reason);
    closeInterrupt(() => setCancelStage(null));
    reset();
  };

  const closeInterrupt = (close: () => void) => {
    close();
    surfaces.perform("resumeRide");
  };

  const live = isCommitted(visible) && visible !== "complete" && !failure;
  const cancellable =
    live &&
    (visible === "matching" ||
      visible === "assigned" ||
      visible === "provider_en_route");
  const showDriver =
    Boolean(trip) &&
    (visible === "assigned" ||
      visible === "provider_en_route" ||
      visible === "active");

  return (
    <>
      <div className="sr-only" aria-live="polite">
        {question.question} {question.action}.
      </div>

      {visible === "home" ? (
        <div className="flex flex-col gap-6">
          <PickupRow
            label={pickupLine}
            onPress={() => openSearch("pickup")}
            following={pickup.followsDevice ?? false}
          />
          <LocationTrigger
            hint="Where to?"
            label={destination?.address}
            onPress={() => openSearch("destination")}
          />
          <SavedPlaces
            title="Saved and recent"
            places={SAVED_PLACES}
            onSelect={(place) =>
              chooseLocation({
                address: place.address,
                latitude: place.latitude ?? undefined,
                longitude: place.longitude ?? undefined,
              })
            }
          />
          <RecentTrip
            place={LAST_TRIP}
            onPress={() =>
              chooseLocation({
                address: LAST_TRIP.address,
                latitude: LAST_TRIP.latitude ?? undefined,
                longitude: LAST_TRIP.longitude ?? undefined,
              })
            }
          />
        </div>
      ) : null}

      {visible !== "home" && visible !== "location_search" ? (
        <ManagedSurface<LimeCabSurfaceId> id="primary">
          <ServiceSheet
            label="Your ride"
            presentation={sheetPresentation(
              surfaces.layout.primary?.presentation ?? "sheet",
            )}
          >
            {!isCommitted(visible) && !surface.progress.locked ? (
              <Button
                variant="ghost"
                className="text-muted-foreground mb-2 -ml-2 h-11 justify-start px-2"
                onClick={() => go("back")}
              >
                Back
              </Button>
            ) : null}

            {visible === "service_select" ? (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-[17px] font-medium tracking-tight">
                    Choose your ride
                  </h2>
                  {estimate ? (
                    <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                      ~{estimate.minutes} min trip
                    </span>
                  ) : null}
                </div>
                <RouteLine
                  className="mt-2"
                  pickup={pickupLine}
                  destination={destinationLine}
                  onEditPickup={() => openSearch("pickup")}
                  onEditDestination={() => openSearch("destination")}
                />
                <ServiceGrid
                  className="mt-4"
                  variant="list"
                  services={rideOptions}
                  selectedId={product?.id ?? null}
                  onSelect={chooseRide}
                />
              </>
            ) : null}

            {visible === "quote" && product && quote && destination ? (
              quoteReady ? (
                <QuotePanel
                  title={product.name}
                  address={destination.address}
                  quote={{ totalCents: payableCents, lines: [] }}
                  confirmLabel={`Request ${product.name} · ${formatMoney(
                    payableCents,
                  )}`}
                  busy={surface.progress.locked}
                  error={surface.progress.error}
                  extra={
                    <div className="flex flex-col gap-3">
                      <Itinerary
                        pickup={pickupLine}
                        destination={destinationLine}
                        arrival={`~${product.etaMinutes} min`}
                        trip={`${clockTime(
                          product.etaMinutes + quote.minutes,
                        )} dropoff`}
                        onEditPickup={() => openSearch("pickup")}
                      />
                      <div className="divide-border ring-border divide-y rounded-2xl ring-1">
                        <SettingRow
                          icon={<CreditCard strokeWidth={1.7} />}
                          label={payment.label}
                          value={payment.detail}
                          onPress={() => openDetail("payment")}
                        />
                        <SettingRow
                          icon={<Tag strokeWidth={1.7} />}
                          label="Promo"
                          value={
                            promoApplied
                              ? `−${formatMoney(AVAILABLE_PROMO.amountCents)} applied`
                              : "Add a code"
                          }
                          onPress={() => openDetail("promo")}
                        />
                      </div>
                      <DetailButton onPress={() => openDetail("fare")}>
                        Fare details
                      </DetailButton>
                    </div>
                  }
                  footnote="Fares are estimates. Nothing is charged in this demo."
                  onConfirm={requestRide}
                />
              ) : (
                <SurfaceSkeleton lines={4} showAction label="Pricing your ride" />
              )
            ) : null}

            {isCommitted(visible) && visible !== "complete" ? (
              <ServiceStatusPanel
                status={status}
                labels={{ provider: "driver", service: "ride" }}
                subtitle={
                  status.state === "arriving"
                    ? `Meet at ${pickup.meetingPoint ?? pickupLine}`
                    : product && destination
                      ? `${product.name} · ${destinationLine}`
                      : undefined
                }
                actions={
                  <div className="flex flex-col gap-3">
                    {status.state === "arriving" && trip ? (
                      <PickupPin
                        pin={trip.pickupPin}
                        meetAt={pickup.meetingPoint ?? pickupLine}
                      />
                    ) : null}
                    {showDriver && trip ? (
                      <ProviderCard
                        provider={{
                          id: trip.driver.id,
                          name: trip.driver.name,
                          detail: vehicleLabel(trip.driver.vehicle),
                          rating: trip.driver.rating,
                        }}
                        actions={
                          <div className="flex gap-2">
                            <IconAction
                              label={`Message ${trip.driver.name}`}
                              onPress={() => openDetail("contact")}
                            >
                              <MessageCircle strokeWidth={1.7} />
                            </IconAction>
                            <IconAction
                              label={`Call ${trip.driver.name}`}
                              onPress={() => openDetail("contact")}
                            >
                              <Phone strokeWidth={1.7} />
                            </IconAction>
                          </div>
                        }
                        eta={
                          status.state === "provider_en_route"
                            ? `${Math.max(
                                1,
                                Math.ceil(status.etaSeconds / 60),
                              )} min away`
                            : status.state === "arriving"
                              ? "Here now"
                              : null
                        }
                      />
                    ) : null}
                    {showDriver && trip ? (
                      <div className="grid grid-cols-2 gap-2">
                        <DetailButton onPress={() => openDetail("trip")}>
                          Trip details
                        </DetailButton>
                        <DetailButton onPress={() => openDetail("safety")}>
                          Safety
                        </DetailButton>
                      </div>
                    ) : null}
                    {failure ? (
                      <PrimaryAction onClick={backToQuote}>
                        Back to the quote
                      </PrimaryAction>
                    ) : null}
                    {cancellable ? (
                      <Button
                        variant="ghost"
                        className="text-muted-foreground border-border h-11 w-full rounded-xl border"
                        onClick={() => {
                          surfaces.perform("interruptCancel");
                          setCancelStage("confirm");
                        }}
                      >
                        Cancel ride
                      </Button>
                    ) : null}
                  </div>
                }
              />
            ) : null}

            {visible === "complete" ? (
              <CompletionPanel
                headline="You've arrived"
                summary={`${destinationLine || "Destination"} · thanks for riding with LimeCab.`}
                totalCents={(trip?.fare.totalCents ?? 0) + (tipCents ?? 0)}
                totalLabel="Trip total"
                detail={
                  <div className="flex flex-col gap-4">
                    <p className="text-muted-foreground text-sm tabular-nums">
                      {trip?.tripMinutes ?? 0} min · {trip?.distanceMiles ?? 0} mi
                    </p>
                    <RatePanel
                      name={trip?.driver.name ?? "your driver"}
                      value={rating}
                      onRate={setRating}
                    />
                    <TipPanel value={tipCents} onTip={setTipCents} />
                  </div>
                }
                actions={
                  <>
                    <PrimaryAction onClick={reset}>Done</PrimaryAction>
                    <DetailButton onPress={() => openDetail("receipt")}>
                      View receipt
                    </DetailButton>
                  </>
                }
              />
            ) : null}
          </ServiceSheet>
        </ManagedSurface>
      ) : null}

      <ManagedSurface<LimeCabSurfaceId> id="search">
        <LocationSearchScene
          open={state === "location_search"}
          adapter={geocodeAdapter}
          places={SAVED_PLACES}
          title={searchTarget === "pickup" ? "Pickup" : "Where to?"}
          onSelect={chooseLocation}
          onDismiss={() => {
            setSearchError(null);
            go("cancel_search");
          }}
          error={searchError}
          onError={setSearchError}
        />
      </ManagedSurface>

      <ConfirmActionSurface
        open={unavailable !== null}
        onOpenChange={(open) => {
          if (!open) closeInterrupt(() => setUnavailable(null));
        }}
        id="ride-unavailable"
        title={`${unavailable?.name ?? "This ride"} isn't live yet`}
        description={
          unavailable
            ? `${unavailable.description}. We'll let you know when it reaches your city.`
            : undefined
        }
        confirmLabel="Got it"
        cancelLabel="Back to rides"
        onConfirm={() => closeInterrupt(() => setUnavailable(null))}
      />

      {/* Disclosure, not a step: the ride surface is suspended behind this and
          restored untouched when it closes. */}
      <AdaptiveSurface.Interrupt
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) closeInterrupt(() => setDetail(null));
        }}
        id="ride-detail"
        label={DETAIL_TITLE[detail ?? "fare"]}
      >
        {detail === "fare" && quote && product ? (
          <DetailLines
            lines={[
              ...quote.panel.lines,
              { label: "Estimated total", value: formatMoney(quote.fare.totalCents), strong: true },
            ]}
            footnote="Estimates. The final fare follows the route actually driven."
          />
        ) : null}

        {detail === "trip" && trip ? (
          <DetailLines
            lines={[
              { label: "Ride", value: product?.name ?? "Lime" },
              { label: "Driver", value: trip.driver.name },
              { label: "Vehicle", value: vehicleLabel(trip.driver.vehicle) },
              { label: "Pickup", value: pickupLine },
              { label: "Meet at", value: pickup.meetingPoint ?? pickupLine },
              { label: "Destination", value: destinationLine },
              { label: "Distance", value: `${trip.distanceMiles} mi` },
              { label: "Trip time", value: `~${trip.tripMinutes} min` },
              { label: "Payment", value: payment.detail },
              {
                label: "Estimated total",
                value: formatMoney(trip.fare.totalCents - discountCents),
                strong: true,
              },
            ]}
          />
        ) : null}

        {detail === "receipt" && trip ? (
          <DetailLines
            lines={[
              { label: "Base fare", value: formatMoney(trip.fare.baseCents) },
              { label: `Distance · ${trip.distanceMiles} mi`, value: formatMoney(trip.fare.distanceCents) },
              { label: `Time · ${trip.tripMinutes} min`, value: formatMoney(trip.fare.timeCents) },
              { label: "Booking fee", value: formatMoney(trip.fare.bookingCents) },
              ...(discountCents
                ? [{ label: AVAILABLE_PROMO.label, value: `−${formatMoney(discountCents)}` }]
                : []),
              ...(tipCents
                ? [{ label: `Tip for ${trip.driver.name}`, value: formatMoney(tipCents) }]
                : []),
              {
                label: "Trip total",
                value: formatMoney(trip.fare.totalCents - discountCents + (tipCents ?? 0)),
                strong: true,
              },
            ]}
            footnote={`Trip ${trip.id} · ${product?.name ?? "Lime"} with ${trip.driver.name}.`}
          />
        ) : null}

        {detail === "payment" ? (
          <ul className="divide-border ring-border divide-y rounded-2xl ring-1">
            {PAYMENT_METHODS.map((method) => (
              <li key={method.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={method.id === paymentId}
                  onClick={() => {
                    setPaymentId(method.id);
                    closeInterrupt(() => setDetail(null));
                  }}
                  className="focus-visible:ring-ring active:bg-accent flex min-h-14 w-full items-center gap-3 px-4 text-left first:rounded-t-2xl last:rounded-b-2xl focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
                >
                  <CreditCard
                    className="text-muted-foreground size-4 shrink-0"
                    strokeWidth={1.7}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium tracking-tight">
                      {method.label}
                    </span>
                    <span className="text-muted-foreground block truncate text-sm">
                      {method.detail}
                    </span>
                  </span>
                  {method.id === paymentId ? (
                    <Check
                      className="text-primary size-5 shrink-0"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {detail === "promo" ? (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm leading-relaxed">
              {promoApplied
                ? `${AVAILABLE_PROMO.label} is applied to this ride.`
                : `Code ${AVAILABLE_PROMO.code} is available on your account.`}
            </p>
            <PrimaryAction
              onClick={() => {
                setPromoApplied(!promoApplied);
                closeInterrupt(() => setDetail(null));
              }}
            >
              {promoApplied
                ? "Remove credit"
                : `Apply ${formatMoney(AVAILABLE_PROMO.amountCents)} credit`}
            </PrimaryAction>
          </div>
        ) : null}

        {detail === "contact" && trip ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            Calling and messaging {trip.driver.name} needs a dispatch connection,
            which this build doesn&apos;t have. Nothing was sent.
          </p>
        ) : null}

        {detail === "safety" ? (
          <div className="flex flex-col gap-3">
            <DetailLines
              lines={[
                { label: "Trip", value: trip?.id ?? "—" },
                { label: "Driver", value: trip?.driver.name ?? "—" },
                { label: "Vehicle", value: trip ? trip.driver.vehicle.plate : "—" },
              ]}
              footnote="Sharing and emergency calling need a live trip service. Nothing here contacts anyone yet."
            />
            <DetailButton onPress={() => undefined}>Share trip status</DetailButton>
          </div>
        ) : null}

        <Button
          variant="ghost"
          className="border-border h-11 w-full rounded-xl border"
          onClick={() => closeInterrupt(() => setDetail(null))}
        >
          Close
        </Button>
      </AdaptiveSurface.Interrupt>

      <ConfirmActionSurface
        open={cancelStage === "confirm"}
        onOpenChange={(open) => {
          if (!open) closeInterrupt(() => setCancelStage(null));
        }}
        id="cancel-ride"
        intent="destructive"
        title="Cancel this ride?"
        description={
          trip
            ? `${trip.driver.name} stops heading to you. You won't be charged.`
            : "We'll stop looking for a driver. You won't be charged."
        }
        confirmLabel="Cancel ride"
        cancelLabel="Keep ride"
        // The ride is cancelled here. The reason is asked *after*, because
        // making the rider answer a survey before we stop the car would be
        // holding the cancellation hostage.
        onConfirm={() => setCancelStage("reason")}
        onCancel={() => closeInterrupt(() => setCancelStage(null))}
      />

      <AdaptiveSurface.Interrupt
        open={cancelStage === "reason"}
        onOpenChange={(open) => {
          if (!open) finishCancel();
        }}
        id="cancel-reason"
        label="Ride cancelled"
        description="What happened? This helps us send a better driver next time."
      >
        <ul className="divide-border ring-border divide-y rounded-2xl ring-1">
          {CANCEL_REASONS.map((reason) => (
            <li key={reason}>
              <button
                type="button"
                onClick={() => finishCancel(reason)}
                className="focus-visible:ring-ring active:bg-accent flex min-h-12 w-full items-center px-4 text-left text-[15px] first:rounded-t-2xl last:rounded-b-2xl focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
              >
                {reason}
              </button>
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
          className="text-muted-foreground h-11 w-full rounded-xl"
          onClick={() => finishCancel()}
        >
          Skip
        </Button>
      </AdaptiveSurface.Interrupt>
    </>
  );
}

/**
 * Progressive density: the live scene answers "where are we and when", and
 * everything the rider might *also* want — the fare breakdown, the plate, the
 * receipt — sits one deliberate tap away instead of crowding the answer.
 */
type DetailKind =
  | "fare"
  | "trip"
  | "receipt"
  | "payment"
  | "promo"
  | "contact"
  | "safety";

const DETAIL_TITLE: Record<DetailKind, string> = {
  fare: "Fare details",
  trip: "Trip details",
  receipt: "Receipt",
  payment: "Payment method",
  promo: "Promo code",
  contact: "Contact your driver",
  safety: "Safety",
};

const CANCEL_REASONS = [
  "Driver was too far away",
  "Wait was too long",
  "Booked by mistake",
  "Plans changed",
  "Price was too high",
] as const;

/** A settings-style row: what it is now, and that it can be changed. */
function SettingRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={`${label}: ${value}. Change`}
      className="focus-visible:ring-ring active:bg-accent flex min-h-14 w-full items-center gap-3 px-4 text-left first:rounded-t-2xl last:rounded-b-2xl focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className="text-muted-foreground shrink-0 [&_svg]:size-4"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px]">{value}</span>
      <ChevronRight
        className="text-muted-foreground size-4 shrink-0"
        strokeWidth={1.7}
        aria-hidden="true"
      />
    </button>
  );
}

/** A round icon-only affordance. Label is spoken, never drawn. */
function IconAction({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      className="ring-border focus-visible:ring-ring active:bg-accent inline-flex size-10 shrink-0 items-center justify-center rounded-full ring-1 focus-visible:ring-2 focus-visible:outline-none [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

/**
 * The code the rider reads out at the curb.
 *
 * It is the largest thing on the screen for the few seconds it matters,
 * because the rider is looking at a phone at arm's length beside a road.
 */
function PickupPin({ pin, meetAt }: { pin: string; meetAt: string }) {
  return (
    <div className="bg-accent text-accent-foreground rounded-2xl px-4 py-3">
      <p className="text-[11px] tracking-[0.12em] uppercase opacity-70">
        Give your driver this code
      </p>
      <p className="mt-1 text-[28px] leading-none font-semibold tabular-nums">
        {pin.split("").join(" ")}
      </p>
      <p className="mt-2 text-sm opacity-80">Meet at {meetAt}</p>
    </div>
  );
}

/** Flat tip amounts. Percentages make the rider do arithmetic to be kind. */
function TipPanel({
  value,
  onTip,
}: {
  value: number | null;
  onTip: (next: number | null) => void;
}) {
  return (
    <div className="bg-muted/60 rounded-2xl p-4">
      <p className="text-[15px] font-medium tracking-tight">
        {value ? "Tip added" : "Add a tip?"}
      </p>
      <div className="mt-3 flex gap-2">
        {TIP_PRESETS.map((amount) => {
          const selected = value === amount;
          return (
            <button
              key={amount}
              type="button"
              aria-pressed={selected}
              onClick={() => onTip(selected ? null : amount)}
              className={cn(
                "ring-border focus-visible:ring-ring h-11 flex-1 rounded-xl text-[15px] font-medium tabular-nums ring-1 focus-visible:ring-2 focus-visible:outline-none",
                selected
                  ? "bg-primary text-primary-foreground ring-primary"
                  : "bg-card active:bg-accent",
              )}
            >
              {formatMoney(amount)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The affordance that discloses a detail surface. Never the primary action. */
function DetailButton({
  onPress,
  children,
}: {
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      className="text-muted-foreground border-border h-11 w-full rounded-xl border text-sm font-normal"
      onClick={onPress}
    >
      {children}
    </Button>
  );
}

/** A label/value ledger. Amounts share precision so the column reads. */
function DetailLines({
  lines,
  footnote,
}: {
  lines: { label: string; value: string; strong?: boolean }[];
  footnote?: string;
}) {
  return (
    <div>
      <dl className="flex flex-col gap-2.5">
        {lines.map((row) => (
          <div
            key={row.label}
            className={cn(
              "flex items-baseline gap-3 text-sm",
              row.strong && "border-border mt-1 border-t pt-3",
            )}
          >
            <dt className={cn("text-muted-foreground", row.strong && "text-foreground font-medium")}>
              {row.label}
            </dt>
            <dd
              className={cn(
                "ml-auto tabular-nums",
                row.strong && "text-[15px] font-medium",
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {footnote ? (
        <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
          {footnote}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The last trip, offered as one tap. Most rides repeat, so the cheapest good
 * home screen answers "again?" before it asks "where to?".
 */
function RecentTrip({
  place,
  onPress,
}: {
  place: Place;
  onPress: () => void;
}) {
  return (
    <section aria-label="Recent trip">
      <p className="text-muted-foreground text-xs tracking-wide uppercase">
        Recent trip
      </p>
      <button
        type="button"
        onClick={onPress}
        className="bg-card ring-border focus-visible:ring-ring hover:ring-ring/40 mt-2 flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 text-left ring-1 focus-visible:ring-2 focus-visible:outline-none"
      >
        <RotateCcw
          className="text-muted-foreground size-4 shrink-0"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium tracking-tight">
            {place.label}
          </span>
          <span className="text-muted-foreground block truncate text-sm">
            {place.hint} · {splitAddress(place.address).line}
          </span>
        </span>
        <span className="text-muted-foreground shrink-0 text-sm">Rebook</span>
      </button>
    </section>
  );
}

/** Pickup is editable from the first screen — it is not just "wherever I am". */
function PickupRow({
  label,
  following,
  onPress,
}: {
  label: string;
  following: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="focus-visible:ring-ring group flex w-full items-center gap-3 rounded-2xl text-left focus-visible:ring-2 focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className="bg-primary ring-primary/25 size-2.5 shrink-0 rounded-full ring-4"
      />
      <span className="min-w-0 flex-1">
        <span className="text-muted-foreground block text-[11px] tracking-[0.12em] uppercase">
          Pickup
        </span>
        <span className="block truncate text-[15px] font-medium tracking-tight">
          {following ? "Current location" : label}
        </span>
      </span>
      <span className="text-muted-foreground text-sm group-hover:underline">
        Change
      </span>
    </button>
  );
}

/**
 * The one-line route. Ride selection is a comparison scene: the itinerary is
 * context the rider has already decided, so it gets a line, not a card.
 */
function RouteLine({
  pickup,
  destination,
  onEditPickup,
  onEditDestination,
  className,
}: {
  pickup: string;
  destination: string;
  onEditPickup: () => void;
  onEditDestination: () => void;
  className?: string;
}) {
  return (
    <p className={cn("text-muted-foreground flex items-center gap-1.5 text-sm", className)}>
      <button
        type="button"
        onClick={onEditPickup}
        aria-label={`Pickup: ${pickup}. Change`}
        className="focus-visible:ring-ring min-w-0 truncate rounded hover:underline focus-visible:ring-2 focus-visible:outline-none"
      >
        {pickup}
      </button>
      <span aria-hidden="true">→</span>
      <button
        type="button"
        onClick={onEditDestination}
        aria-label={`Destination: ${destination}. Change`}
        className="text-foreground focus-visible:ring-ring min-w-0 truncate rounded font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
      >
        {destination}
      </button>
    </p>
  );
}

/** Pickup → destination, with the two estimates that answer "when". */
function Itinerary({
  pickup,
  destination,
  arrival,
  trip,
  onEditPickup,
  onEditDestination,
  className,
}: {
  pickup: string;
  destination: string;
  arrival?: string;
  trip?: string;
  onEditPickup?: () => void;
  onEditDestination?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("bg-muted/60 rounded-2xl p-3", className)}>
      <ItineraryRow
        kind="pickup"
        label="Pickup"
        value={pickup}
        onPress={onEditPickup}
      />
      <div aria-hidden="true" className="border-border ml-[5px] h-4 border-l" />
      <ItineraryRow
        kind="destination"
        label="Destination"
        value={destination}
        onPress={onEditDestination}
      />
      {arrival ?? trip ? (
        <dl className="border-border mt-3 flex gap-6 border-t pt-3 text-sm">
          {arrival ? (
            <div>
              <dt className="text-muted-foreground text-[11px] tracking-[0.12em] uppercase">
                Driver arrival
              </dt>
              <dd className="font-medium tabular-nums">{arrival}</dd>
            </div>
          ) : null}
          {trip ? (
            <div>
              <dt className="text-muted-foreground text-[11px] tracking-[0.12em] uppercase">
                Trip
              </dt>
              <dd className="font-medium tabular-nums">{trip}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}

function ItineraryRow({
  kind,
  label,
  value,
  onPress,
}: {
  kind: "pickup" | "destination";
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const body = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "size-2.5 shrink-0",
          kind === "pickup"
            ? "bg-primary rounded-full"
            : "bg-foreground rounded-[3px]",
        )}
      />
      <span className="min-w-0 flex-1 truncate text-sm">
        {value || "Not set"}
      </span>
    </>
  );

  if (!onPress) {
    return (
      <div className="flex items-center gap-3">
        <span className="sr-only">{label}: </span>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={`${label}: ${value}. Change`}
      className="focus-visible:ring-ring flex w-full items-center gap-3 rounded-lg text-left focus-visible:ring-2 focus-visible:outline-none"
    >
      {body}
    </button>
  );
}

function RatePanel({
  name,
  value,
  onRate,
}: {
  name: string;
  value: number | null;
  onRate: (next: number) => void;
}) {
  return (
    <div className="bg-muted/60 rounded-2xl p-4">
      <p className="text-[15px] font-medium tracking-tight">
        {value ? "Thanks for the feedback" : `How was your ride with ${name}?`}
      </p>
      <div className="mt-3 flex gap-1.5" role="radiogroup" aria-label="Rate your ride">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            onClick={() => onRate(star)}
            className="focus-visible:ring-ring rounded-lg p-1.5 focus-visible:ring-2 focus-visible:outline-none"
          >
            <Star
              className={cn(
                "size-7",
                value !== null && star <= value
                  ? "fill-primary text-primary"
                  : "text-muted-foreground",
              )}
              strokeWidth={1.6}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

const SHEET_PRESENTATIONS = ["peek", "sheet", "expanded", "fullscreen"] as const;
type SheetPresentation = (typeof SHEET_PRESENTATIONS)[number];

function sheetPresentation(value: string | null): SheetPresentation {
  return SHEET_PRESENTATIONS.find((entry) => entry === value) ?? "sheet";
}
