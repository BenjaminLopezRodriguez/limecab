"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Gps01Icon } from "@hugeicons/core-free-icons";

import { useAdaptiveSurface } from "@/components/service-app/adaptive-surface";
import { LocationPinScene } from "@/components/service-app/location-pin-scene";
import { LocationSearchScene } from "@/components/service-app/location-search-scene";
import { createMapboxAdapter } from "@/components/service-app/mapbox-adapter";
import { ServiceAppShell } from "@/components/service-app/service-app-shell";
import { MapRouteBar } from "@/components/service-app/map-route-bar";
import { ServiceMap } from "@/components/service-app/service-map";
import { ServiceSheet } from "@/components/service-app/service-sheet";
import {
  ManagedSurface,
  SurfaceManagerProvider,
  useSurfaceManager,
} from "@/components/service-app/surface-manager";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { LimeCabCompleteScene } from "@/components/limecab/limecab-complete-scene";
import { LimeCabConfigureScene } from "@/components/limecab/limecab-configure-scene";
import { LimeCabHomeScene } from "@/components/limecab/limecab-home-scene";
import {
  LimeCabCancelSurfaces,
  LimeCabDetailSurface,
  LimeCabForTheWaySurface,
  LimeCabPaymentSurface,
  LimeCabUnavailableSurface,
  type DetailKind,
} from "@/components/limecab/limecab-interrupts";
import { LimeCabTripPill } from "@/components/limecab/limecab-trip-pill";
import { LimeCabQuoteScene } from "@/components/limecab/limecab-quote-scene";
import { LimeCabRideSelectScene } from "@/components/limecab/limecab-ride-select-scene";
import {
  limeCabNormalizeQuery,
  renderLimeCabSearchResults,
} from "@/components/limecab/limecab-search-results";
import { LimeCabStatusScene } from "@/components/limecab/limecab-status-scene";
import {
  LimeCabVoiceBanner,
  VoiceMicButton,
  submitVoiceText,
  useVoiceCapture,
} from "@/components/limecab/limecab-voice-banner";
import { LimeCabWhenScene } from "@/components/limecab/limecab-when-scene";
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
  GEOCODE_FIXTURES,
  NEARBY_DRIVERS,
  PAYMENT_METHODS,
  RIDER,
  RIDE_PRODUCTS,
  SAVED_PLACES,
  quoteFor,
} from "@/lib/limecab/mock";
import {
  FOR_THE_WAY_CAFE,
  forTheWayEligible,
  forTheWayItem,
  type FOR_THE_WAY_ITEMS,
} from "@/lib/limecab/for-the-way";
import { reservedLabel } from "@/lib/limecab/reserve";
import type { SearchIntent } from "@/lib/limecab/search-intent";
import { createPlacesAdapter } from "@/lib/limecab/places";
import { SIM_PHASE_MS, simulatedApproachStart } from "@/lib/limecab/simulate";
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
import { cn } from "@/lib/utils";
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

function searchTitle(target: RideSearchTarget, courier: boolean): string {
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
  matching: SIM_PHASE_MS.requested,
  assigned: SIM_PHASE_MS.matched,
  provider_en_route: SIM_PHASE_MS.arriving,
  active: SIM_PHASE_MS.in_progress,
};

const placesAdapter = createPlacesAdapter();

function locationFromFixture(query: string): Location | null {
  const needle = query.trim().toLowerCase();
  const hit = GEOCODE_FIXTURES.find(
    (entry) =>
      entry.address.toLowerCase().includes(needle) ||
      entry.context.toLowerCase().includes(needle) ||
      entry.id.toLowerCase() === needle,
  );
  if (!hit) return null;
  return {
    address: hit.address,
    latitude: hit.latitude,
    longitude: hit.longitude,
  };
}

type BookingMode = "ride" | "courier" | "reserve";

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
  onTaskChange,
  signedIn = false,
  standby = false,
}: {
  /**
   * The shell hides its chrome while the ride owns the screen. A minimized
   * live ride is *not* a task: Home, its launcher, and the tabs come back.
   */
  onTaskChange?: (inTask: boolean) => void;
  /** Signed-out riders browse and quote; only booking is gated. */
  signedIn?: boolean;
  /**
   * The rider is looking at another tab. Every surface stands down — the
   * sheet portals to `document.body`, so hiding an ancestor cannot hide it —
   * while the state machine, the polling and the surface recipes keep running
   * underneath, so coming back restores the exact scene they left.
   */
  standby?: boolean;
}) {
  return (
    <SurfaceManagerProvider manager={limeCabSurfaces}>
      <LimeCabFlow
        onTaskChange={onTaskChange}
        signedIn={signedIn}
        standby={standby}
      />
    </SurfaceManagerProvider>
  );
}

function LimeCabFlow({
  onTaskChange,
  signedIn,
  standby,
}: {
  onTaskChange?: (inTask: boolean) => void;
  signedIn: boolean;
  standby: boolean;
}) {
  const surfaces = useSurfaceManager<LimeCabSurfaceId, LimeCabAction>();
  const searchParams = useSearchParams();
  const wantCourier = searchParams.get("service") === "courier";
  const wantReserve = searchParams.get("service") === "reserve";

  const [state, setState] = useState<ServiceAppState>("home");
  const [bookingMode, setBookingMode] = useState<BookingMode>(
    wantCourier ? "courier" : wantReserve ? "reserve" : "ride",
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
  const [approachRoute, setApproachRoute] = useState<MapPoint[] | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  /**
   * A committed ride, stood down to the pill while the rider is still on `/`.
   * Not a scene and not a step: the request keeps running and the reducer never
   * hears about it. It is where the *surfaces* sit, so it lives here and not in
   * `ServiceAppState`.
   */
  const [rideMinimized, setRideMinimized] = useState(false);
  const [recentering, setRecentering] = useState(false);
  const [phaseStart, setPhaseStart] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  const product = findBookableProduct(productId ?? "", RIDE_PRODUCTS) ?? null;
  const available = product?.status === "available";
  const courier = bookingMode === "courier";
  const reserve = bookingMode === "reserve";

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
        isTerminal(query.state.data?.status) ? false : 1500,
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
    if (isCourierProduct(live.productId)) setBookingMode("courier");
    else if (live.productId === "lime-reserve") setBookingMode("reserve");
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
  // While the ride is minimized, `minimizeRide` owns the posture instead —
  // the server advancing matched → arriving must not pop the sheet back up.
  useEffect(() => {
    if (rideMinimized) return;
    surfaces.apply("progress", LIMECAB_SCENE_SURFACES[state]);
  }, [rideMinimized, state, surfaces]);

  useEffect(() => {
    onTaskChange?.(state !== "home" && !rideMinimized);
  }, [onTaskChange, rideMinimized, state]);

  // Nothing live to stand down: a cancelled, completed, or never-started ride
  // must not leave the next scene's sheet hidden behind a stale pill.
  useEffect(() => {
    if (!isCommitted(state) || state === "complete") setRideMinimized(false);
  }, [state]);

  // One clock drives every estimate and the car's position. While the
  // vehicle is moving, tick every frame so the follow-cam can slide the
  // map under the car instead of jumping twice a second.
  const liveVehicle =
    state === "assigned" ||
    state === "provider_en_route" ||
    state === "active" ||
    state === "completing";
  useEffect(() => {
    if (!isCommitted(state) || state === "complete") return;
    if (liveVehicle) {
      let frame = 0;
      const tick = () => {
        setNow(Date.now());
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [liveVehicle, state]);

  // Each scene restarts the cosmetic clock. The scene itself comes from the
  // server's status, never from a timer.
  useEffect(() => {
    setPhaseStart(Date.now());
    setNow(Date.now());
  }, [state]);

  useEffect(() => {
    if (isCommitted(state)) return;
    if (wantCourier) {
      setBookingMode("courier");
      setProductId((id) => (isCourierProduct(id) ? id : "courier-small"));
      return;
    }
    if (wantReserve) {
      setBookingMode("reserve");
      setProductId("lime-reserve");
    }
  }, [wantCourier, wantReserve, state]);

  useEffect(() => {
    if (wantCourier || wantReserve || isCommitted(state) || state !== "home") {
      return;
    }
    setBookingMode("ride");
    setProductId((id) =>
      isCourierProduct(id) || id === "lime-reserve" ? null : id,
    );
  }, [wantCourier, wantReserve, state]);

  const go = useCallback(
    (
      event: ServiceAppEvent,
      overrides?: Partial<{
        hasLocation: boolean;
        hasService: boolean;
        pinEntry: "home" | "search";
        needsConfigure: boolean;
        needsServiceSelect: boolean;
      }>,
    ) =>
      setState((current) =>
        reduceServiceAppState(current, event, {
          hasLocation: Boolean(destination),
          hasService: courier || reserve || Boolean(available),
          needsConfigure: courier || reserve,
          needsServiceSelect: !courier && !reserve,
          pinEntry,
          ...overrides,
        }),
      ),
    [available, courier, destination, pinEntry, reserve],
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
    const waypoints: MapPoint[] = [
      pickupPoint,
      ...stops.flatMap((stop) =>
        stop.latitude !== undefined && stop.longitude !== undefined
          ? [{ latitude: stop.latitude, longitude: stop.longitude }]
          : [],
      ),
      destinationPoint,
    ];
    const ac = new AbortController();
    void (async () => {
      const segments: MapPoint[] = [];
      try {
        for (let index = 0; index < waypoints.length - 1; index += 1) {
          const from = waypoints[index]!;
          const to = waypoints[index + 1]!;
          const piece = await fetchDrivingRoute(from, to, ac.signal);
          if (segments.length && piece.length) segments.pop();
          segments.push(...piece);
        }
        if (!ac.signal.aborted) setDrivenRoute(segments);
      } catch {
        if (!ac.signal.aborted) setDrivenRoute(waypoints);
      }
    })();
    return () => ac.abort();
  }, [destinationPoint, pickupPoint, stops]);

  const needsApproach =
    state === "matching" ||
    state === "assigned" ||
    state === "provider_en_route";

  useEffect(() => {
    if (!needsApproach) return;
    const origin = simulatedApproachStart(pickupPoint, tripId ?? "preview");
    const ac = new AbortController();
    void fetchDrivingRoute(origin, pickupPoint, ac.signal)
      .then(setApproachRoute)
      .catch(() => {
        if (!ac.signal.aborted) setApproachRoute([origin, pickupPoint]);
      });
    return () => ac.abort();
  }, [needsApproach, pickupPoint, tripId]);

  const driverPoint = useMemo<MapPoint | null>(() => {
    if (state === "assigned" || state === "provider_en_route") {
      const origin = simulatedApproachStart(pickupPoint, tripId ?? "preview");
      const path =
        approachRoute && approachRoute.length > 1
          ? approachRoute
          : [origin, pickupPoint];
      const progress =
        state === "assigned"
          ? 0.1 * t
          : 0.1 + 0.9 * Math.min(1, t / ARRIVED_AT);
      return { ...pointAlongPath(path, progress), kind: "provider" };
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
  }, [
    approachRoute,
    destinationPoint,
    drivenRoute,
    pickupPoint,
    state,
    t,
    tripId,
  ]);

  const points = useMemo<MapPoint[]>(() => {
    const list: MapPoint[] = [pickupPoint];
    for (const stop of stops) {
      if (stop.latitude === undefined || stop.longitude === undefined) continue;
      list.push({
        latitude: stop.latitude,
        longitude: stop.longitude,
        kind: "marker",
      });
    }
    if (destinationPoint && state !== "home") list.push(destinationPoint);
    if (driverPoint) list.push(driverPoint);
    // Idle cars on the home canvas: the rider's first question is whether
    // LimeCab is even available here, and this answers it before any tap.
    if (state === "home" || state === "matching") list.push(...NEARBY_DRIVERS);
    return list;
  }, [destinationPoint, driverPoint, pickupPoint, state, stops]);

  const estimate = useMemo(
    () =>
      destination ? quoteFor(RIDE_PRODUCTS[0]!, pickup, destination) : null,
    [destination, pickup],
  );

  const status = useMemo<ServiceStatus>(() => {
    if (failure) return { state: "failed", reason: failure };
    switch (state) {
      case "matching":
        return {
          state: "matching",
          typicalSeconds: Math.max(
            8,
            Math.round(((PHASE_HINT_MS.matching ?? 5000) / 1000) * (1 - t)),
          ),
        };
      case "assigned":
        return {
          state: "assigned",
          providerName: trip?.driver.name,
          etaSeconds: Math.max(
            6,
            Math.round(
              (SIM_PHASE_MS.matched * (1 - t) + SIM_PHASE_MS.arriving) / 1000,
            ),
          ),
        };
      case "provider_en_route":
        return arrived
          ? { state: "arriving", providerName: trip?.driver.name }
          : {
              state: "provider_en_route",
              providerName: trip?.driver.name,
              etaSeconds: Math.max(
                6,
                Math.round(
                  (SIM_PHASE_MS.arriving / 1000) * (1 - t / ARRIVED_AT),
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
            6,
            Math.round((SIM_PHASE_MS.in_progress / 1000) * (1 - t)),
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
      : liveVehicle && driverPoint
        ? driverPoint
        : state === "home" || !destinationPoint
          ? pickupPoint
          : destinationPoint;
  const fallbackTrip = useMemo(
    () =>
      destinationPoint ? [pickupPoint, destinationPoint] : undefined,
    [destinationPoint, pickupPoint],
  );
  const mapRoute =
    pinning || state === "home"
      ? undefined
      : state === "matching" ||
          state === "assigned" ||
          state === "provider_en_route"
        ? (approachRoute ?? undefined)
        : (drivenRoute ?? fallbackTrip);
  const pickupLine = splitAddress(pickup.address).line;
  const destinationLine = splitAddress(destination?.address ?? "").line;
  const canReviseRoute =
    state === "service_select" ||
    state === "configure" ||
    state === "quote";
  /** A committed request that is still running: minimizable, not revisable. */
  const liveRide = isCommitted(state) && state !== "complete";

  const openSearch = useRef<(target: RideSearchTarget) => void>(
    () => undefined,
  );
  openSearch.current = (target) => {
    // A live ride is minimized behind Home. The launcher is not an invitation
    // to book a second one — the reducer refuses that — so it is the way back
    // to the ride already running.
    if (rideMinimized) return restoreRide();
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
            resolved = await placesAdapter.reverse?.(
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

  /**
   * Back on a live ride. Not `go("back")` and not a cancellation: one named
   * action stands the sheet down to the pill and hands Home back.
   */
  const minimizeRide = () => {
    surfaces.perform("minimizeRide");
    setRideMinimized(true);
  };

  /** The pill, tapped. The scene recipe re-seats the map on the same frame. */
  const restoreRide = () => {
    surfaces.perform("restoreRide");
    setRideMinimized(false);
  };

  /**
   * "I'm here" — put the pickup back on the device, without opening search.
   * Same geolocation path the search scene and the home map tap already use.
   */
  const recenterPickup = () => {
    if (recentering || typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }
    setRecentering(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude, longitude } = coords;
        void fetchReverseGeocode(latitude, longitude)
          .catch(() => undefined)
          .then((resolved) => {
            setPickup({
              address: resolved?.address ?? "Current location",
              latitude,
              longitude,
              followsDevice: true,
            });
            setRecentering(false);
          });
      },
      () => setRecentering(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <ServiceAppShell
      layout={state === "home" || rideMinimized ? "home" : "task"}
      onMapPress={
        rideMinimized ? restoreRide : () => openPin("pickup", "home")
      }
      map={
        standby ? null : (
          <ManagedSurface<LimeCabSurfaceId> id="map">
            <div className="relative size-full">
              <ServiceMap
                adapter={mapAdapter}
                mode={LIMECAB_MAP_MODE[mapPosture] ?? "home"}
                center={center}
                interactive={surfaces.layout.map?.interaction === "active"}
                onCameraChange={pinning ? setPin : undefined}
                points={pinning ? [] : points}
                route={mapRoute}
                pinLabel={pinning ? pinShortName : undefined}
                pinLocating={pinning && pinLocating}
                label={
                  pinning || (state !== "home" && destination)
                    ? null
                    : pickupLine
                }
                callout={
                  pinning || status.state === "failed"
                    ? null
                    : serviceCallout(status)
                }
              />
              {!pinning &&
              !rideMinimized &&
              state !== "home" &&
              state !== "location_search" &&
              destination ? (
                <MapRouteBar
                  origin={pickupLine}
                  destination={destinationLine}
                  // Back revises while the request is still a draft; once it is
                  // committed, Back minimizes. It never unwinds and never
                  // cancels — cancelling has its own confirmation.
                  onBack={
                    canReviseRoute
                      ? () => go("back")
                      : liveRide
                        ? minimizeRide
                        : undefined
                  }
                  onEdit={
                    canReviseRoute
                      ? () => openSearch.current("destination")
                      : undefined
                  }
                />
              ) : null}

              {/* Between the destination bar and the sheet, on the canvas —
                  not in the sheet's action band, which answers the scene. */}
              {!pinning &&
              !rideMinimized &&
              state !== "home" &&
              !isCommitted(state) ? (
                <RecenterPickupButton
                  busy={recentering}
                  onPress={recenterPickup}
                />
              ) : null}
            </div>
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
        reserve={reserve}
        setBookingMode={setBookingMode}
        trip={trip}
        serverStatus={serverStatus}
        startTrip={startTrip}
        cancelTrip={cancelTrip}
        clearTrip={clearTrip}
        signedIn={signedIn}
        standby={standby}
        rideMinimized={rideMinimized}
        onRestoreRide={restoreRide}
        failure={failure}
        setFailure={setFailure}
        status={status}
        estimate={estimate}
      />
    </ServiceAppShell>
  );
}

/**
 * "I'm here". A canvas control, deliberately not a sheet action: the sheet
 * answers the scene's question, and where the rider is standing is not it.
 */
function RecenterPickupButton({
  busy,
  onPress,
}: {
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={busy}
      aria-label="Recenter pickup on my location"
      className={cn(
        "bg-card ring-border focus-visible:ring-ring absolute right-3 z-10 inline-flex size-11 items-center justify-center rounded-full shadow-[0_4px_16px_rgba(26,24,20,0.12)] ring-1 touch-manipulation focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60",
        // Sits in the gap the sheet leaves. The rung is a known fraction, so
        // this is one CSS expression and not another measured overlay.
        "bottom-[calc(var(--sheet-snap,0)*100dvh+1rem)] md:bottom-6",
      )}
    >
      <Icon
        icon={Gps01Icon}
        size={20}
        className={busy ? "animate-pulse" : undefined}
      />
    </button>
  );
}

/** Short physical-world marker text. Empty outside arrival-shaped states. */
function serviceCallout(status: ServiceStatus): string | null {
  if (status.state === "assigned" || status.state === "provider_en_route") {
    if (status.etaSeconds < 60) {
      return `${Math.max(1, Math.round(status.etaSeconds))}s`;
    }
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
  reserve,
  setBookingMode,
  trip,
  serverStatus,
  startTrip,
  cancelTrip,
  clearTrip,
  signedIn,
  standby,
  rideMinimized,
  onRestoreRide,
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
      needsConfigure: boolean;
      needsServiceSelect: boolean;
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
  reserve: boolean;
  setBookingMode: (next: BookingMode) => void;
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
  standby: boolean;
  /** A live ride stood down to the pill while the rider uses Home. */
  rideMinimized: boolean;
  onRestoreRide: () => void;
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
  const [traveling, setTraveling] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [snack, setSnack] = useState<(typeof FOR_THE_WAY_ITEMS)[number] | null>(
    null,
  );
  const [forTheWayOpen, setForTheWayOpen] = useState(false);
  const forTheWayAsked = useRef(false);
  const voiceOpenedSearch = useRef(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const applyVoiceRef = useRef<(text: string) => void>(() => undefined);
  const voice = useVoiceCapture((text) => applyVoiceRef.current(text));

  applyVoiceRef.current = (text) => {
    const parsed = submitVoiceText(text, (message) => {
      setVoiceError(message);
      setSearchError(message);
    });
    if (!parsed?.destinationQuery) {
      voice.setTyped(text);
      return;
    }
    const place = locationFromFixture(parsed.destinationQuery);
    if (!place) {
      const message = "Couldn’t find that place. Try LAX, Home, or Griffith.";
      setVoiceError(message);
      setSearchError(message);
      voice.setTyped(text);
      return;
    }
    voice.stop();
    setVoiceError(null);
    setSearchError(null);
    setProductId(parsed.productHint);
    setDestination(place);
    surfaces.perform("voiceResolved");
    go("select_location", {
      hasLocation: true,
      hasService: false,
      needsConfigure: false,
      needsServiceSelect: true,
    });
  };

  const openVoice = () => {
    if (rideMinimized) return onRestoreRide();
    setVoiceError(null);
    setSearchError(null);
    voiceOpenedSearch.current = state !== "location_search";
    surfaces.perform("openVoiceBooking");
    if (state !== "location_search") go("open_search");
    voice.start();
  };

  const cancelVoice = () => {
    const opened = voiceOpenedSearch.current;
    voice.stop();
    setVoiceError(null);
    if (opened && !destination) go("cancel_search");
  };

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

  useEffect(() => {
    if (visible === "quote" || visible === "matching") return;
    if (visible === "assigned" || visible === "provider_en_route") return;
    if (visible === "active" || visible === "completing" || visible === "complete") {
      return;
    }
    forTheWayAsked.current = false;
  }, [visible]);

  useEffect(() => {
    if (visible !== "quote") return;
    if (!forTheWayEligible(product?.id)) return;
    if (forTheWayAsked.current || snack) return;
    forTheWayAsked.current = true;
    surfaces.perform("openForTheWay");
    setForTheWayOpen(true);
  }, [product?.id, snack, surfaces, visible]);

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
          // The stop is real; the charge is not ours. `trip.request` prices
          // the ride from product and distance and never reads a client
          // total, so folding the drink into the fare would show a number
          // nobody charges. The rider pays the counter.
          ...(snack
            ? [
                {
                  label: `${snack.label} · paid at the counter`,
                  value: formatMoney(snack.priceCents),
                },
              ]
            : []),
        ],
      },
    };
  }, [courier, courierValues, destination, pickup, product, snack]);

  /** What the rider is actually charged, after any credit. */
  const payableCents = Math.max(
    0,
    (quote?.fare.totalCents ?? 0) - discountCents,
  );

  const chooseLocation = (result: Location) => {
    // Same reason as the launcher: a saved place cannot re-route a committed
    // ride, and the reducer's `select_location` has no committed guard.
    if (rideMinimized) return onRestoreRide();
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
      go("select_location", {
        hasLocation: true,
        hasService: courier || reserve,
        needsConfigure: courier || reserve,
        needsServiceSelect: !courier && !reserve,
      });
      return;
    }

    openSearch(targetFromField(next));
  };

  const chooseIntent = (
    suggestion: { id: string; address: string },
    intent: SearchIntent,
  ) => {
    if (rideMinimized) return onRestoreRide();
    void (async () => {
      let result: Location;
      try {
        result = await placesAdapter.retrieve(suggestion.id);
      } catch {
        result =
          locationFromFixture(suggestion.address) ?? {
            address: suggestion.address,
          };
      }
      if (intent === "ride") {
        chooseLocation(result);
        return;
      }
      setBookingMode("courier");
      setProductId("courier-small");
      if (intent === "store") {
        setPickup({ ...result, followsDevice: false });
        setDestination({
          address: CURRENT_LOCATION.address,
          latitude: CURRENT_LOCATION.latitude,
          longitude: CURRENT_LOCATION.longitude,
        });
        setCourierValues({
          ...defaultOptionValues(COURIER_OPTIONS),
          fulfillment: "buy",
          recipientName: RIDER.fullName,
          recipientPhone: RIDER.phone,
        });
      } else {
        setDestination(result);
        setCourierValues(defaultOptionValues(COURIER_OPTIONS));
      }
      surfaces.perform("destinationSelected");
      go("select_location", {
        hasLocation: true,
        hasService: true,
        needsConfigure: true,
        needsServiceSelect: false,
      });
    })();
  };

  const skipForTheWay = () => {
    surfaces.perform("skipForTheWay");
    setForTheWayOpen(false);
  };

  const addForTheWay = (itemId: string) => {
    if (snack) return;
    const item = forTheWayItem(itemId);
    if (!item) return;
    const already = stops.some(
      (stop) => stop.address === FOR_THE_WAY_CAFE.address,
    );
    if (!already) {
      setStops(
        stops.length < 2
          ? [...stops, FOR_THE_WAY_CAFE]
          : [...stops.slice(0, 1), FOR_THE_WAY_CAFE],
      );
    }
    setSnack(item);
    surfaces.perform("addForTheWay");
    setForTheWayOpen(false);
  };

  const pickRide = (next: RideProduct) => {
    if (next.status !== "available") {
      // A temporary question about the task: the scene recedes, it is not lost.
      surfaces.perform("interruptCancel");
      setUnavailable(next);
      return;
    }
    setProductId(next.id);
  };

  const confirmRide = () => {
    if (product?.status !== "available") return;
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
            const meeting = courier
              ? courierMeetingPoint(courierValues)
              : [
                  reserve && scheduledAt ? reservedLabel(scheduledAt) : null,
                  snack
                    ? `${snack.label} at Grand Central Market`
                    : null,
                  pickup.meetingPoint,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined;
            return startTrip({
              pickup: {
                ...pickup,
                meetingPoint: meeting,
              },
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
    setProductId(courier ? "courier-small" : reserve ? "lime-reserve" : null);
    setCourierValues(defaultOptionValues(COURIER_OPTIONS));
    setDestination(null);
    setStops([]);
    setScheduledAt(null);
    setSnack(null);
    forTheWayAsked.current = false;
    voice.stop();
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
    // Payment is the same kind of interruption, at a different rung: a list
    // with an "add one" affordance is a prepared environment, not a drawer.
    surfaces.perform(kind === "payment" ? "openPayment" : "openDetails");
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
    if (!standby) return;
    setDetail(null);
    setCancelStage(null);
    setUnavailable(null);
    setForTheWayOpen(false);
  }, [standby]);

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
  if (standby) return null;

  return (
    <>
      <div className="sr-only" aria-live="polite">
        {question.question} {question.action}.
      </div>

      {visible === "home" || rideMinimized ? (
        <LimeCabHomeScene
          destination={destination}
          title={
            courier ? "Where is it going?" : reserve ? "Book ahead" : undefined
          }
          destinationHint={courier ? "Where is it going?" : "Where to?"}
          traveling={traveling}
          onTravelingChange={setTraveling}
          onSearch={openSearch}
          onVoice={openVoice}
          onChooseLocation={chooseLocation}
        />
      ) : null}

      {/* The drawer portals to `document.body`; only not rendering it takes
          it off a minimized rider's screen. */}
      {visible !== "home" && visible !== "location_search" && !rideMinimized ? (
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
            {visible === "location_pin" && !surface.progress.locked ? (
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
                destination={destination}
                estimate={estimate}
                product={product}
                payment={payment}
                onSelect={pickRide}
                onConfirm={confirmRide}
                onOpenPayment={() => openDetail("payment")}
              />
            ) : null}

            {visible === "configure" ? (
              reserve ? (
                <LimeCabWhenScene
                  value={scheduledAt}
                  onChange={setScheduledAt}
                  onContinue={() => go("configure_done")}
                />
              ) : (
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
              )
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
                stopLines={stops.map(
                  (stop) => stop.shortName ?? splitAddress(stop.address).line,
                )}
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
                    : reserve && scheduledAt
                      ? reservedLabel(scheduledAt)
                      : undefined
                }
                confirmLabel={
                  signedIn
                    ? reserve
                      ? `Reserve Lime · ${formatMoney(payableCents)}`
                      : undefined
                    : undefined
                }
                footnote={
                  courierValues.fulfillment === "buy"
                    ? "Item cost is paid in store; this fare is the trip. Nothing is charged in this demo."
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
                        window.location.href = "/signin";
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
                shareLabel={
                  traveling ? "Share with someone at home" : "Share trip"
                }
                liveSubtitle={
                  snack &&
                  (visible === "assigned" || visible === "provider_en_route")
                    ? `Picking up your ${snack.label.toLowerCase()}, then you`
                    : courier &&
                        courierValues.fulfillment === "buy" &&
                        (visible === "matching" || visible === "assigned")
                      ? "Courier will text to confirm the item — messaging isn’t wired, so they will pick the described item."
                      : reserve && scheduledAt
                        ? reservedLabel(scheduledAt)
                        : undefined
                }
                onOpenDetail={openDetail}
                onShareTrip={
                  showDriver
                    ? () => {
                        surfaces.perform("openTravelShare");
                        setDetail("safety");
                      }
                    : undefined
                }
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
          adapter={placesAdapter}
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
            voice.stop();
            go("cancel_search");
          }}
          error={searchError ?? voiceError}
          onError={setSearchError}
          trailing={
            <VoiceMicButton
              onPress={openVoice}
              listening={voice.capture.kind === "listening"}
            />
          }
          banner={
            voice.capture.kind === "idle" ? null : (
              <LimeCabVoiceBanner
                capture={voice.capture}
                error={voiceError}
                onTypedChange={voice.setTyped}
                onSubmit={applyVoiceRef.current}
                onCancel={cancelVoice}
              />
            )
          }
          normalizeQuery={limeCabNormalizeQuery}
          renderResults={(input) =>
            renderLimeCabSearchResults({
              ...input,
              onChooseIntent: chooseIntent,
            })
          }
        />
      </ManagedSurface>

      <LimeCabUnavailableSurface
        product={unavailable}
        onDismiss={() => closeInterrupt(() => setUnavailable(null))}
      />

      {/* Minimized on Home: the ride is the pill, and tapping it is the only
          way back. Off Home the shell renders its own. */}
      {rideMinimized ? <LimeCabTripPill onRestore={onRestoreRide} /> : null}

      <LimeCabPaymentSurface
        open={detail === "payment"}
        paymentId={paymentId}
        onSelect={(id) => {
          setPaymentId(id);
          closeInterrupt(() => setDetail(null));
        }}
        onClose={() => closeInterrupt(() => setDetail(null))}
      />

      <LimeCabDetailSurface
        detail={detail === "payment" ? null : detail}
        onClose={() => closeInterrupt(() => setDetail(null))}
        quote={quote}
        product={product}
        trip={trip}
        pickup={pickup}
        pickupLine={pickupLine}
        destinationLine={destinationLine}
        stopLines={stops.map((stop) => splitAddress(stop.address).line)}
        payment={payment}
        promoApplied={promoApplied}
        onTogglePromo={() => {
          setPromoApplied(!promoApplied);
          closeInterrupt(() => setDetail(null));
        }}
        discountCents={discountCents}
        tipCents={tipCents}
      />

      <LimeCabForTheWaySurface
        open={forTheWayOpen}
        onSkip={skipForTheWay}
        onAdd={addForTheWay}
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
