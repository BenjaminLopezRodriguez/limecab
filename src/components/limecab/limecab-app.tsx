"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useAdaptiveSurface } from "@/components/service-app/adaptive-surface";
import { LocationPinScene } from "@/components/service-app/location-pin-scene";
import { LocationSearchScene } from "@/components/service-app/location-search-scene";
import { createMapboxAdapter } from "@/components/service-app/mapbox-adapter";
import { ServiceAppShell } from "@/components/service-app/service-app-shell";
import { ServiceMap } from "@/components/service-app/service-map";
import { ServiceSheet } from "@/components/service-app/service-sheet";
import {
  ManagedSurface,
  SurfaceManagerProvider,
  useSurfaceManager,
} from "@/components/service-app/surface-manager";
import { Button } from "@/components/ui/button";
import { LimeCabCompleteScene } from "@/components/limecab/limecab-complete-scene";
import { LimeCabConfigureScene } from "@/components/limecab/limecab-configure-scene";
import { LimeCabHomeScene } from "@/components/limecab/limecab-home-scene";
import {
  LimeCabCancelSurfaces,
  LimeCabDetailSurface,
  LimeCabUnavailableSurface,
  type DetailKind,
} from "@/components/limecab/limecab-interrupts";
import { LimeCabQuoteScene } from "@/components/limecab/limecab-quote-scene";
import { LimeCabRideSelectScene } from "@/components/limecab/limecab-ride-select-scene";
import { LimeCabStatusScene } from "@/components/limecab/limecab-status-scene";
import {
  LIMECAB_MAP_MODE,
  LIMECAB_SCENE_SURFACES,
  limeCabSurfaces,
  type LimeCabAction,
  type LimeCabSurfaceId,
} from "@/components/limecab/surfaces";
import {
  clockTime,
  type Pickup,
  type RideProduct,
  type Trip,
} from "@/lib/limecab/domain";
import {
  COURIER_OPTIONS,
  courierDraftFromOptions,
  courierDraftReady,
  courierMeetingPoint,
  courierProductFromOptions,
  findBookableProduct,
  isCourierProduct,
} from "@/lib/limecab/courier";
import {
  AVAILABLE_PROMO,
  CURRENT_LOCATION,
  DRIVER_START,
  NEARBY_DRIVERS,
  PAYMENT_METHODS,
  RIDE_PRODUCTS,
  SAVED_PLACES,
  geocodeAdapter,
  lerpPoint,
  quoteFor,
} from "@/lib/limecab/mock";
import {
  fetchDrivingRoute,
  fetchReverseGeocode,
} from "@/lib/service-app/directions";
import type { MapPoint } from "@/lib/service-app/map-adapter";
import { pointAlongPath } from "@/lib/service-app/map-adapter";
import {
  addStop,
  applyRouteChoice,
  nextEmptyField,
  removeStop,
  type SearchField,
} from "@/lib/service-app/route-draft";
import {
  defaultOptionValues,
  summarizeOptions,
  type ServiceOptionValues,
} from "@/lib/service-app/options";
import {
  formatMoney,
  splitAddress,
  type Location,
} from "@/lib/service-app/services";
import {
  isCommitted,
  reduceServiceAppState,
  serviceAppQuestion,
  type ServiceAppEvent,
  type ServiceAppState,
} from "@/lib/service-app/state";
import type { ServiceStatus } from "@/lib/service-app/status";
import { env } from "@/env";
import { api, type RouterOutputs } from "@/trpc/react";

/**
 * LimeCab — the ride flow.
 *
 * Product composition only: the ride catalogue, the fare, the driver, the
 * mocked dispatch, and the copy. Every interaction mechanic underneath it
 * (surfaces, scenes, async choreography, map postures, waiting states) comes
 * from the service-app kit unchanged.
 */

type TripRow = RouterOutputs["trip"]["get"];
type RideSearchTarget = "pickup" | "destination" | `stop:${number}`;

function fieldFromTarget(target: RideSearchTarget): SearchField {
  return target === "pickup" ? "origin" : target;
}

function targetFromField(field: SearchField): RideSearchTarget {
  return field === "origin" ? "pickup" : field;
}

function searchTitle(
  target: RideSearchTarget,
  courier: boolean,
): string {
  if (target === "pickup") return courier ? "Pick up package" : "Pickup";
  if (target.startsWith("stop:")) {
    return `Stop ${Number(target.slice("stop:".length)) + 1}`;
  }
  return courier ? "Deliver to?" : "Where to?";
}
type TripStatus = TripRow["status"];

/**
 * The server owns the lifecycle; this is the only place its statuses become
 * client scenes. `cancelled` has no scene — the flow returns home.
 */
const SCENE_FOR_STATUS: Record<TripStatus, ServiceAppState> = {
  requested: "matching",
  matched: "assigned",
  arriving: "provider_en_route",
  in_progress: "active",
  complete: "complete",
  cancelled: "home",
};

function isTerminal(status: TripStatus | undefined): boolean {
  return status === "complete" || status === "cancelled";
}

/** Cosmetic only: how long a phase usually runs, for the car track and the
 *  countdown. Nothing here advances the ride — polling does. */
const PHASE_HINT_MS: Partial<Record<ServiceAppState, number>> = {
  assigned: 2500,
  provider_en_route: 15_000,
  active: 16_000,
  completing: 2500,
};

/**
 * A trip row becomes a rider-facing `Trip` only once dispatch has attached a
 * driver. Before that there is no trip object, so no scene can accidentally
 * show a driver who does not exist yet.
 */
function toClientTrip(row: TripRow): Trip | null {
  if (!row.driver) return null;
  return {
    id: row.id,
    request: {
      pickup: {
        address: row.pickupAddress,
        latitude: row.pickupLatitude ?? undefined,
        longitude: row.pickupLongitude ?? undefined,
        meetingPoint: row.pickupMeetingPoint ?? undefined,
      },
      destination: {
        address: row.destinationAddress,
        latitude: row.destinationLatitude ?? undefined,
        longitude: row.destinationLongitude ?? undefined,
      },
      productId: row.productId,
    },
    driver: {
      id: row.driver.id,
      name: row.driver.name,
      rating: row.driver.ratingHundredths / 100,
      vehicle: {
        make: row.driver.vehicleMake,
        model: row.driver.vehicleModel,
        color: row.driver.vehicleColor,
        plate: row.driver.vehiclePlate,
      },
    },
    fare: {
      baseCents: row.baseCents,
      distanceCents: row.distanceCents,
      timeCents: row.timeCents,
      bookingCents: row.bookingCents,
      totalCents: row.totalCents,
    },
    distanceMiles: Number(row.distanceMiles.toFixed(1)),
    tripMinutes: row.tripMinutes,
    arrivalMinutes: row.arrivalMinutes,
    pickupPin: row.pickupPin,
    courier:
      row.recipientName && row.deliveryProof
        ? {
            recipientName: row.recipientName,
            recipientPhone: row.recipientPhone ?? "",
            packageCount: row.packageCount,
            proof: row.deliveryProof as "hand" | "door" | "signature",
            deliveryPin: row.deliveryPin,
            pickupVerifiedAt: row.pickupVerifiedAt,
            deliveryVerifiedAt: row.deliveryVerifiedAt,
          }
        : undefined,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Nothing was dispatched.";
}

const mapAdapter = env.NEXT_PUBLIC_MAPBOX_TOKEN
  ? createMapboxAdapter(env.NEXT_PUBLIC_MAPBOX_TOKEN)
  : undefined;

/** The tail of the en-route phase, where the question becomes "which car?". */
const ARRIVED_AT = 0.82;

export function LimeCabApp({
  onSceneChange,
  signedIn = false,
  minimized = false,
}: {
  /** The shell hides its chrome once the rider is inside a task. */
  onSceneChange?: (state: ServiceAppState) => void;
  /** Signed-out riders browse and quote; only booking is gated. */
  signedIn?: boolean;
  /**
   * The rider is looking at another tab. Every surface stands down — the
   * sheet portals to `document.body`, so hiding an ancestor cannot hide it —
   * while the state machine, the polling and the surface recipes keep running
   * underneath, so coming back restores the exact scene they left.
   */
  minimized?: boolean;
}) {
  return (
    <SurfaceManagerProvider manager={limeCabSurfaces}>
      <LimeCabFlow
        onSceneChange={onSceneChange}
        signedIn={signedIn}
        minimized={minimized}
      />
    </SurfaceManagerProvider>
  );
}

function LimeCabFlow({
  onSceneChange,
  signedIn,
  minimized,
}: {
  onSceneChange?: (state: ServiceAppState) => void;
  signedIn: boolean;
  minimized: boolean;
}) {
  const surfaces = useSurfaceManager<LimeCabSurfaceId, LimeCabAction>();
  const searchParams = useSearchParams();
  const wantCourier = searchParams.get("service") === "courier";

  const [state, setState] = useState<ServiceAppState>("home");
  const [vertical, setVertical] = useState<"ride" | "courier">(
    wantCourier ? "courier" : "ride",
  );
  const [pickup, setPickup] = useState(CURRENT_LOCATION);
  const [destination, setDestination] = useState<Location | null>(null);
  const [stops, setStops] = useState<Location[]>([]);
  const [searchTarget, setSearchTarget] =
    useState<RideSearchTarget>("destination");
  /** Home map tap vs search "choose on map" — drives Back and confirm. */
  const [pinEntry, setPinEntry] = useState<"home" | "search">("search");
  const [pin, setPin] = useState<MapPoint | null>(null);
  const [pinAddress, setPinAddress] = useState<string | null>(null);
  const [pinShortName, setPinShortName] = useState<string | null>(null);
  const [pinLocating, setPinLocating] = useState(false);
  const [drivenRoute, setDrivenRoute] = useState<MapPoint[] | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [phaseStart, setPhaseStart] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  const product =
    findBookableProduct(productId ?? "", RIDE_PRODUCTS) ?? null;
  const available = product?.status === "available";
  const courier = vertical === "courier";

  // ---- the server is the truth -------------------------------------------
  const [tripId, setTripId] = useState<string | null>(null);
  const requestTrip = api.trip.request.useMutation();
  const cancelTripMutation = api.trip.cancel.useMutation();

  /** A ride already in flight, so a refresh does not lose it. */
  const activeTrip = api.trip.active.useQuery(undefined, {
    enabled: signedIn,
    refetchOnWindowFocus: false,
  });

  // Polling, not a timer: the ride advances when the backend says it did.
  const tripQuery = api.trip.get.useQuery(
    { id: tripId ?? "" },
    {
      enabled: tripId !== null,
      refetchInterval: (query) =>
        isTerminal(query.state.data?.status) ? false : 3000,
    },
  );

  const row = tripId ? (tripQuery.data ?? null) : null;
  const serverStatus = row?.status ?? null;
  const trip = useMemo(() => (row ? toClientTrip(row) : null), [row]);

  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !activeTrip.isSuccess) return;
    resumed.current = true;
    const live = activeTrip.data;
    if (!live) return;
    setTripId(live.id);
    setPickup({
      address: live.pickupAddress,
      latitude: live.pickupLatitude ?? undefined,
      longitude: live.pickupLongitude ?? undefined,
      meetingPoint: live.pickupMeetingPoint ?? undefined,
      followsDevice: false,
    });
    setDestination({
      address: live.destinationAddress,
      latitude: live.destinationLatitude ?? undefined,
      longitude: live.destinationLongitude ?? undefined,
    });
    setProductId(live.productId);
    if (isCourierProduct(live.productId)) setVertical("courier");
    setState(SCENE_FOR_STATUS[live.status]);
  }, [activeTrip.data, activeTrip.isSuccess]);

  const startTrip = useCallback(
    async (input: {
      pickup: Pickup;
      destination: Location;
      productId: string;
      idempotencyKey: string;
      courier?: {
        recipientName: string;
        recipientPhone: string;
        packageCount: number;
        proof: "hand" | "door" | "signature";
      };
    }) => {
      const created = await requestTrip.mutateAsync({
        pickup: {
          address: input.pickup.address,
          latitude: input.pickup.latitude,
          longitude: input.pickup.longitude,
          meetingPoint: input.pickup.meetingPoint,
        },
        destination: {
          address: input.destination.address,
          latitude: input.destination.latitude,
          longitude: input.destination.longitude,
        },
        productId: input.productId,
        idempotencyKey: input.idempotencyKey,
        courier: input.courier,
      });
      setTripId(created.id);
    },
    [requestTrip],
  );

  const cancelTrip = useCallback(async () => {
    if (tripId) await cancelTripMutation.mutateAsync({ id: tripId });
  }, [cancelTripMutation, tripId]);

  const clearTrip = useCallback(() => setTripId(null), []);

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

  // Each scene restarts the cosmetic clock. The scene itself comes from the
  // server's status, never from a timer.
  useEffect(() => {
    setPhaseStart(Date.now());
    setNow(Date.now());
  }, [state]);

  useEffect(() => {
    if (isCommitted(state)) return;
    if (wantCourier) {
      setVertical("courier");
      setProductId((id) => (isCourierProduct(id) ? id : "courier-small"));
    }
  }, [wantCourier, state]);

  useEffect(() => {
    if (wantCourier || isCommitted(state) || state !== "home") return;
    setVertical("ride");
    setProductId((id) => (isCourierProduct(id) ? null : id));
  }, [wantCourier, state]);

  const go = useCallback(
    (
      event: ServiceAppEvent,
      overrides?: Partial<{
        hasLocation: boolean;
        hasService: boolean;
        pinEntry: "home" | "search";
      }>,
    ) =>
      setState((current) =>
        reduceServiceAppState(current, event, {
          hasLocation: Boolean(destination),
          hasService: courier || Boolean(available),
          needsConfigure: courier,
          needsServiceSelect: !courier,
          pinEntry,
          ...overrides,
        }),
      ),
    [available, courier, destination, pinEntry],
  );

  const duration = PHASE_HINT_MS[state] ?? 0;
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

  useEffect(() => {
    if (!destinationPoint) {
      setDrivenRoute(null);
      return;
    }
    const ac = new AbortController();
    void fetchDrivingRoute(pickupPoint, destinationPoint, ac.signal)
      .then(setDrivenRoute)
      .catch(() => {
        if (!ac.signal.aborted) {
          setDrivenRoute([pickupPoint, destinationPoint]);
        }
      });
    return () => ac.abort();
  }, [destinationPoint, pickupPoint]);

  const driverPoint = useMemo<MapPoint | null>(() => {
    if (state === "assigned") {
      return {
        ...lerpPoint(DRIVER_START, pickupPoint, 0.12),
        kind: "provider",
      };
    }
    if (state === "provider_en_route") {
      return {
        ...lerpPoint(DRIVER_START, pickupPoint, 0.12 + 0.88 * (t / ARRIVED_AT)),
        kind: "provider",
      };
    }
    if ((state === "active" || state === "completing") && destinationPoint) {
      const path =
        drivenRoute && drivenRoute.length > 1
          ? drivenRoute
          : [pickupPoint, destinationPoint];
      return {
        ...pointAlongPath(path, state === "active" ? t : 1),
        kind: "provider",
      };
    }
    return null;
  }, [destinationPoint, drivenRoute, pickupPoint, state, t]);

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
    () =>
      destination ? quoteFor(RIDE_PRODUCTS[0]!, pickup, destination) : null,
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
                Math.round(
                  (trip?.arrivalMinutes ?? 4) * 60 * (1 - t / ARRIVED_AT),
                ),
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
        return {
          state: "complete",
          summary: courier
            ? "Thanks for sending with LimeCab."
            : "Thanks for riding with LimeCab.",
        };
      default:
        return { state: "pending" };
    }
  }, [arrived, courier, destination, failure, state, t, trip]);

  const mapPosture = surfaces.layout.map?.presentation ?? "bounded";
  const pinning = state === "location_pin";
  const center =
    pinning && pin
      ? pin
      : state === "home" || !destinationPoint
        ? pickupPoint
        : destinationPoint;

  const openSearch = useRef<(target: RideSearchTarget) => void>(
    () => undefined,
  );
  openSearch.current = (target) => {
    setSearchTarget(target);
    surfaces.perform(
      target === "pickup" ? "openPickupSearch" : "openDestinationSearch",
    );
    go("open_search");
  };

  const openPin = (
    target: RideSearchTarget = searchTarget,
    entry: "home" | "search" = "search",
  ) => {
    setSearchTarget(target);
    setPinEntry(entry);
    const stopIndex = target.startsWith("stop:")
      ? Number(target.slice("stop:".length))
      : null;
    const seed =
      target === "pickup"
        ? pickup
        : stopIndex !== null
          ? (stops[stopIndex] ?? pickup)
          : (destination ?? pickup);
    setPin({
      latitude: seed.latitude ?? CURRENT_LOCATION.latitude!,
      longitude: seed.longitude ?? CURRENT_LOCATION.longitude!,
    });
    setPinAddress(seed.address || pickup.address);
    setPinShortName(splitAddress(seed.address || pickup.address).line);
    setPinLocating(false);
    surfaces.perform("chooseOnMap");
    go("choose_on_map", { pinEntry: entry });
  };

  useEffect(() => {
    if (!pinning || !pin) return;
    let cancelled = false;
    setPinLocating(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          let resolved: { address: string; shortName?: string } | undefined;
          try {
            resolved = await fetchReverseGeocode(pin.latitude, pin.longitude);
          } catch {
            resolved = await geocodeAdapter.reverse?.(
              pin.latitude,
              pin.longitude,
            );
          }
          if (!cancelled) {
            setPinAddress(resolved?.address ?? "Pinned location");
            setPinShortName(
              resolved?.shortName ??
                splitAddress(resolved?.address ?? "").line ??
                "Pinned location",
            );
          }
        } catch {
          if (!cancelled) setPinAddress("Pinned location");
        } finally {
          if (!cancelled) setPinLocating(false);
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pin, pinning]);

  return (
    <ServiceAppShell
      layout={state === "home" ? "home" : "task"}
      onMapPress={() => openPin("pickup", "home")}
      map={
        minimized ? null : (
          <ManagedSurface<LimeCabSurfaceId> id="map">
            <ServiceMap
              adapter={mapAdapter}
              mode={LIMECAB_MAP_MODE[mapPosture] ?? "home"}
              center={center}
              interactive={surfaces.layout.map?.interaction === "active"}
              onCameraChange={pinning ? setPin : undefined}
              points={pinning ? [] : points}
              route={
                pinning || !destinationPoint || state === "home"
                  ? undefined
                  : (drivenRoute ?? [pickupPoint, destinationPoint])
              }
              pinLabel={pinning ? pinShortName : undefined}
              pinLocating={pinning && pinLocating}
              label={
                pinning
                  ? null
                  : state === "home"
                    ? splitAddress(pickup.address).line
                    : (destination?.address ?? pickup.address)
              }
              callout={
                pinning || status.state === "failed"
                  ? null
                  : serviceCallout(status)
              }
            />
          </ManagedSurface>
        )
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
        stops={stops}
        setStops={setStops}
        searchTarget={searchTarget}
        pinEntry={pinEntry}
        setPinEntry={setPinEntry}
        openSearch={(target) => openSearch.current(target)}
        onChooseOnMap={() => openPin(searchTarget, "search")}
        pin={pin}
        pinAddress={pinAddress}
        pinLocating={pinLocating}
        product={product}
        setProductId={setProductId}
        courier={courier}
        trip={trip}
        serverStatus={serverStatus}
        startTrip={startTrip}
        cancelTrip={cancelTrip}
        clearTrip={clearTrip}
        signedIn={signedIn}
        minimized={minimized}
        failure={failure}
        setFailure={setFailure}
        status={status}
        estimate={estimate}
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
  stops,
  setStops,
  searchTarget,
  pinEntry,
  setPinEntry,
  openSearch,
  onChooseOnMap,
  pin,
  pinAddress,
  pinLocating,
  product,
  setProductId,
  courier,
  trip,
  serverStatus,
  startTrip,
  cancelTrip,
  clearTrip,
  signedIn,
  minimized,
  failure,
  setFailure,
  status,
  estimate,
}: {
  state: ServiceAppState;
  setState: (next: ServiceAppState) => void;
  go: (
    event: ServiceAppEvent,
    overrides?: Partial<{
      hasLocation: boolean;
      hasService: boolean;
      pinEntry: "home" | "search";
    }>,
  ) => void;
  pickup: Pickup;
  setPickup: (next: Pickup) => void;
  destination: Location | null;
  setDestination: (next: Location | null) => void;
  stops: Location[];
  setStops: (next: Location[]) => void;
  searchTarget: RideSearchTarget;
  pinEntry: "home" | "search";
  setPinEntry: (next: "home" | "search") => void;
  openSearch: (target: RideSearchTarget) => void;
  onChooseOnMap: () => void;
  pin: MapPoint | null;
  pinAddress: string | null;
  pinLocating: boolean;
  product: RideProduct | null;
  setProductId: (next: string | null) => void;
  courier: boolean;
  trip: Trip | null;
  serverStatus: TripStatus | null;
  startTrip: (input: {
    pickup: Pickup;
    destination: Location;
    productId: string;
    idempotencyKey: string;
    courier?: {
      recipientName: string;
      recipientPhone: string;
      packageCount: number;
      proof: "hand" | "door" | "signature";
    };
  }) => Promise<void>;
  cancelTrip: () => Promise<void>;
  clearTrip: () => void;
  signedIn: boolean;
  minimized: boolean;
  failure: string | null;
  setFailure: (next: string | null) => void;
  status: ServiceStatus;
  estimate: { miles: number; minutes: number } | null;
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
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [courierValues, setCourierValues] = useState<ServiceOptionValues>(() =>
    defaultOptionValues(COURIER_OPTIONS),
  );

  /**
   * One key per request attempt. A double tap sends the same key twice and the
   * server returns the one trip it already made. It is cleared only when the
   * quote itself changes, so retrying the same attempt cannot book twice.
   */
  const idempotencyKey = useRef<string | null>(null);
  useEffect(() => {
    idempotencyKey.current = null;
  }, [destination, product?.id]);

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

  const payment =
    PAYMENT_METHODS.find((entry) => entry.id === paymentId) ??
    PAYMENT_METHODS[0]!;
  const discountCents = promoApplied ? AVAILABLE_PROMO.amountCents : 0;

  const quote = useMemo(() => {
    if (!product || !destination) return null;
    const { fare, miles, minutes } = quoteFor(product, pickup, destination);
    const optionLines = courier
      ? summarizeOptions(COURIER_OPTIONS, courierValues)
      : [];
    return {
      fare,
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
          ...optionLines,
        ],
      },
    };
  }, [courier, courierValues, destination, pickup, product]);

  /** What the rider is actually charged, after any credit. */
  const payableCents = Math.max(
    0,
    (quote?.fare.totalCents ?? 0) - discountCents,
  );

  const chooseLocation = (result: Location) => {
    setSearchError(null);
    const { draft, next } = applyRouteChoice(
      { origin: pickup, destination, stops },
      fieldFromTarget(searchTarget),
      result,
    );
    setPickup({
      ...pickup,
      ...draft.origin,
      followsDevice: searchTarget === "pickup" ? false : pickup.followsDevice,
    });
    setDestination(draft.destination);
    setStops(draft.stops);

    // Home map card: adjusting pickup returns to home, does not open search.
    if (pinEntry === "home" && searchTarget === "pickup") {
      setPinEntry("search");
      setState("home");
      return;
    }

    if (next === "complete") {
      surfaces.perform("destinationSelected");
      go("select_location", { hasLocation: true });
      return;
    }

    openSearch(targetFromField(next));
  };

  const chooseRide = (next: RideProduct) => {
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
    idempotencyKey.current ??= crypto.randomUUID();
    const key = idempotencyKey.current;
    void (async () => {
      try {
        surfaces.perform("requestRide");
        await surface.transition({
          intent: "progress",
          from: "quote",
          to: "matching",
          interim: "map",
          task: () => {
            const draft = courierDraftFromOptions(courierValues);
            return startTrip({
              pickup: courier
                ? {
                    ...pickup,
                    meetingPoint: courierMeetingPoint(courierValues),
                  }
                : pickup,
              destination,
              productId: product.id,
              idempotencyKey: key,
              courier: courier
                ? {
                    recipientName: draft.recipientName,
                    recipientPhone: draft.recipientPhone,
                    packageCount: draft.quantity,
                    proof: draft.proof,
                  }
                : undefined,
            });
          },
        });
        // Truthful: the request is accepted, so "matching" is what is
        // happening. No driver exists until the server sends one.
        setState("matching");
      } catch {
        // Dispatch refused the request: the quote comes back untouched and
        // carries the error the transition captured.
        surfaces.perform("requestFailed");
        setState("quote");
      }
    })();
  };

  const backToQuote = () => {
    setFailure(null);
    clearTrip();
    surfaces.perform("requestFailed");
    setState("quote");
  };

  const reset = () => {
    setFailure(null);
    setCancelError(null);
    clearTrip();
    idempotencyKey.current = null;
    setProductId(courier ? "courier-small" : null);
    setCourierValues(defaultOptionValues(COURIER_OPTIONS));
    setDestination(null);
    setStops([]);
    setRating(null);
    setTipCents(null);
    setPromoApplied(false);
    setPickup(CURRENT_LOCATION);
    setState("home");
  };

  /**
   * The lifecycle, derived. Whatever the server says the trip is, that is the
   * scene the rider is in — including a cancellation they did not make.
   */
  useEffect(() => {
    if (!serverStatus) return;
    if (serverStatus === "cancelled") {
      reset();
      return;
    }
    setState(SCENE_FOR_STATUS[serverStatus]);
    // `reset` and `setState` are stable enough for a status-keyed sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverStatus]);

  const openDetail = (kind: DetailKind) => {
    surfaces.perform("openDetails");
    setDetail(kind);
  };

  /**
   * The server decides whether a ride can still be stopped. An in-progress
   * ride cannot, and the rider is told that instead of watching the UI clear.
   */
  const confirmCancel = () => {
    void (async () => {
      try {
        await cancelTrip();
        setCancelError(null);
        setCancelStage("reason");
      } catch (error) {
        closeInterrupt(() => setCancelStage(null));
        setCancelError(errorMessage(error));
      }
    })();
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

  /**
   * Standing down closes any interruption with it. A cancel confirmation or a
   * receipt is a question about *this moment*; re-opening it minutes later,
   * when the rider taps back in from another tab, would be answering a
   * question they have long since walked away from.
   */
  useEffect(() => {
    if (!minimized) return;
    setDetail(null);
    setCancelStage(null);
    setUnavailable(null);
  }, [minimized]);

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

  // Every surface below portals to `document.body`; nothing but returning
  // nothing actually removes them from another tab's screen. The hooks above
  // all keep running, so the scene the rider left is still here.
  if (minimized) return null;

  return (
    <>
      <div className="sr-only" aria-live="polite">
        {question.question} {question.action}.
      </div>

      {visible === "home" ? (
        <LimeCabHomeScene
          destination={destination}
          title={courier ? "Where is it going?" : undefined}
          destinationHint={courier ? "Where is it going?" : "Where to?"}
          onSearch={openSearch}
          onChooseLocation={chooseLocation}
        />
      ) : null}

      {visible !== "home" && visible !== "location_search" ? (
        <ManagedSurface<LimeCabSurfaceId> id="primary">
          <ServiceSheet
            label={
              visible === "location_pin"
                ? "Location"
                : courier
                  ? "Your delivery"
                  : "Your ride"
            }
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

            {visible === "location_pin" ? (
              <LocationPinScene
                title={question.question}
                address={pinAddress}
                locating={pinLocating}
                confirmLabel={
                  searchTarget === "pickup"
                    ? "Set pickup"
                    : searchTarget.startsWith("stop:")
                      ? "Set stop"
                      : courier
                        ? "Set drop-off"
                        : "Set destination"
                }
                onConfirm={() => {
                  if (!pin || !pinAddress) return;
                  chooseLocation({
                    address: pinAddress,
                    latitude: pin.latitude,
                    longitude: pin.longitude,
                  });
                }}
              />
            ) : null}

            {visible === "service_select" ? (
              <LimeCabRideSelectScene
                pickup={pickup}
                pickupLine={pickupLine}
                destination={destination}
                destinationLine={destinationLine}
                estimate={estimate}
                product={product}
                payment={payment}
                onSelect={chooseRide}
                onEditPickup={() => openSearch("pickup")}
                onEditDestination={() => openSearch("destination")}
                onOpenPayment={() => openDetail("payment")}
              />
            ) : null}

            {visible === "configure" ? (
              <LimeCabConfigureScene
                values={courierValues}
                ready={courierDraftReady(
                  courierDraftFromOptions(courierValues),
                )}
                onChange={(id, value) => {
                  setCourierValues((current) => {
                    const next = { ...current, [id]: value };
                    if (id === "size") {
                      setProductId(courierProductFromOptions(next).id);
                    }
                    return next;
                  });
                }}
                onContinue={() => go("configure_done")}
              />
            ) : null}

            {visible === "quote" && product && quote && destination ? (
              <LimeCabQuoteScene
                ready={quoteReady}
                product={product}
                quoteMinutes={quote.minutes}
                payableCents={payableCents}
                fareLines={
                  promoApplied
                    ? [
                        ...quote.panel.lines,
                        {
                          label: AVAILABLE_PROMO.label,
                          value: `−${formatMoney(discountCents)}`,
                        },
                      ]
                    : quote.panel.lines
                }
                pickupLine={pickupLine}
                destinationLine={destinationLine}
                pickupLabel={courier ? "Pick up" : "Pickup"}
                destinationLabel={courier ? "Drop-off" : "Destination"}
                payment={payment}
                promoApplied={promoApplied}
                busy={surface.progress.locked}
                error={surface.progress.error}
                signedIn={signedIn}
                pricingLabel={
                  courier ? "Pricing your delivery" : "Pricing your ride"
                }
                etaLine={
                  courier
                    ? `Pickup in ~${product.etaMinutes} min · Deliver by ${clockTime(product.etaMinutes + quote.minutes)}`
                    : undefined
                }
                signInLabel={
                  courier
                    ? "Sign in to send a delivery"
                    : "Sign in to request a ride"
                }
                onEditPickup={() => openSearch("pickup")}
                onOpenDetail={openDetail}
                onConfirm={
                  signedIn
                    ? requestRide
                    : () => {
                        window.location.href = "/api/auth/signin";
                      }
                }
              />
            ) : null}

            {isCommitted(visible) && visible !== "complete" ? (
              <LimeCabStatusScene
                status={status}
                pickup={pickup}
                pickupLine={pickupLine}
                product={product}
                destination={destination}
                destinationLine={destinationLine}
                trip={trip}
                showDriver={showDriver}
                failure={failure}
                cancelError={cancelError}
                cancellable={cancellable}
                labels={
                  courier
                    ? { provider: "courier", service: "delivery" }
                    : { provider: "driver", service: "ride" }
                }
                onOpenDetail={openDetail}
                onBackToQuote={backToQuote}
                onCancel={() => {
                  setCancelError(null);
                  surfaces.perform("interruptCancel");
                  setCancelStage("confirm");
                }}
              />
            ) : null}

            {visible === "complete" ? (
              <LimeCabCompleteScene
                pickupLine={pickupLine}
                destinationLine={destinationLine}
                trip={trip}
                rating={rating}
                onRate={setRating}
                tipCents={tipCents}
                onTip={setTipCents}
                onDone={reset}
                onOpenDetail={openDetail}
                headline={courier ? "Package delivered" : "You've arrived"}
                totalLabel={courier ? "Delivery total" : "Trip total"}
                providerNoun={courier ? "your courier" : "your driver"}
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
          title={searchTitle(searchTarget, courier)}
          route={{
            origin: pickupLine,
            destination: destination?.address ?? "",
            stops: stops.map((stop) => splitAddress(stop.address).line),
            active: fieldFromTarget(searchTarget),
            onSwitch: (field) => openSearch(targetFromField(field)),
            onAddStop: () => {
              const added = addStop({ origin: pickup, destination, stops });
              if (!added) return;
              setStops(added.draft.stops);
              openSearch(targetFromField(added.next));
            },
            onRemoveStop: (index) => {
              const nextDraft = removeStop(
                { origin: pickup, destination, stops },
                index,
              );
              setStops(nextDraft.stops);
              if (searchTarget === `stop:${index}`) {
                const next =
                  nextEmptyField(nextDraft) ?? ("destination" as const);
                openSearch(targetFromField(next));
                return;
              }
              if (searchTarget.startsWith("stop:")) {
                const current = Number(searchTarget.slice("stop:".length));
                if (current > index) openSearch(`stop:${current - 1}`);
              }
            },
          }}
          onSelect={chooseLocation}
          onChooseOnMap={onChooseOnMap}
          onDismiss={() => {
            setSearchError(null);
            go("cancel_search");
          }}
          error={searchError}
          onError={setSearchError}
        />
      </ManagedSurface>

      <LimeCabUnavailableSurface
        product={unavailable}
        onDismiss={() => closeInterrupt(() => setUnavailable(null))}
      />

      <LimeCabDetailSurface
        detail={detail}
        onClose={() => closeInterrupt(() => setDetail(null))}
        quote={quote}
        product={product}
        trip={trip}
        pickup={pickup}
        pickupLine={pickupLine}
        destinationLine={destinationLine}
        payment={payment}
        paymentId={paymentId}
        onSelectPayment={(id) => {
          setPaymentId(id);
          closeInterrupt(() => setDetail(null));
        }}
        promoApplied={promoApplied}
        onTogglePromo={() => {
          setPromoApplied(!promoApplied);
          closeInterrupt(() => setDetail(null));
        }}
        discountCents={discountCents}
        tipCents={tipCents}
      />

      <LimeCabCancelSurfaces
        stage={cancelStage}
        trip={trip}
        onDismiss={() => closeInterrupt(() => setCancelStage(null))}
        onConfirm={confirmCancel}
        onFinish={finishCancel}
      />
    </>
  );
}

const SHEET_PRESENTATIONS = [
  "peek",
  "sheet",
  "expanded",
  "fullscreen",
] as const;
type SheetPresentation = (typeof SHEET_PRESENTATIONS)[number];

function sheetPresentation(value: string | null): SheetPresentation {
  return SHEET_PRESENTATIONS.find((entry) => entry === value) ?? "sheet";
}
