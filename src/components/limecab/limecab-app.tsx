"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { BookmarkAdd01Icon, Gps01Icon } from "@hugeicons/core-free-icons";

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
import { LimeCabConfirmPickupScene } from "@/components/limecab/limecab-confirm-pickup-scene";
import { LimeCabQuoteScene } from "@/components/limecab/limecab-quote-scene";
import { LimeCabRideSelectScene } from "@/components/limecab/limecab-ride-select-scene";
import { SavePlaceSurface } from "@/components/limecab/limecab-save-place";
import { LimeCabSearchInputAdapter } from "@/components/limecab/limecab-search-input";
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
import { LimeCabHelpKindScene } from "@/components/limecab/limecab-help-kind-scene";
import { LimeCabShopScene } from "@/components/limecab/limecab-shop-scene";
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
  estimateFare,
  isWaitSaveProduct,
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
  SHOP_OPTIONS,
} from "@/lib/limecab/courier";
import {
  helpKindLabel,
  helpVisitLabel,
  helpVisitSlots,
  HELP_VISIT_MINUTES,
  isCareProduct,
  isHelpProduct,
} from "@/lib/limecab/help";
import {
  AVAILABLE_PROMO,
  CURRENT_LOCATION,
  GEOCODE_FIXTURES,
  PAYMENT_METHODS,
  RIDE_PRODUCTS,
  quoteFor,
} from "@/lib/limecab/mock";
import {
  FOR_THE_WAY_CAFE,
  forTheWayEligible,
  forTheWayItem,
  type FOR_THE_WAY_ITEMS,
} from "@/lib/limecab/for-the-way";
import { reservedLabel } from "@/lib/limecab/reserve";
import {
  normalizeShopList,
  shopItemCountLabel,
  shopListSummary,
  shopListUnitCount,
  type ShopItem,
} from "@/lib/limecab/shop-list";
import type { SearchIntent } from "@/lib/limecab/search-intent";
import {
  searchInputContract,
  type BookingMode,
  type SearchAudience,
  type SearchTarget,
} from "@/lib/limecab/search-input";
import {
  createPlacesAdapter,
  fetchNearbyShops,
  setSearchProximity,
} from "@/lib/limecab/places";
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
  MAX_INTERMEDIATE_STOPS,
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
  type Place,
} from "@/lib/service-app/services";
import {
  isCommitted,
  reduceServiceAppState,
  serviceAppQuestion,
  type ServiceAppEvent,
  type ServiceAppState,
} from "@/lib/service-app/state";
import {
  serviceStatusView,
  type ServiceStatus,
} from "@/lib/service-app/status";
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
type RideSearchTarget = SearchTarget;

function fieldFromTarget(target: RideSearchTarget): SearchField {
  return target === "pickup" ? "origin" : target;
}

function targetFromField(field: SearchField): RideSearchTarget {
  return field === "origin" ? "pickup" : field;
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

/** Whole seconds left in this scene. Floor, never round. */
function phaseSecondsLeft(phaseMs: number, t: number) {
  return Math.max(0, Math.floor((phaseMs / 1000) * (1 - t)));
}

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

/**
 * Where the canvas points before the device has answered. A camera position,
 * *not* a pickup: it is never submitted, never labelled, and never Home. The
 * rider's real pickup arrives from geolocation, recenter, or a pin.
 */
const CAMERA_FALLBACK = {
  latitude: CURRENT_LOCATION.latitude!,
  longitude: CURRENT_LOCATION.longitude!,
};

/** No address until the device, a pin, or a Places result gives us one. */
const UNSET_PICKUP: Pickup = { address: "", followsDevice: true };

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
  const wantShop = searchParams.get("service") === "shop";
  const wantHelp = searchParams.get("service") === "help";

  const [state, setState] = useState<ServiceAppState>("home");
  const [bookingMode, setBookingMode] = useState<BookingMode>(
    wantHelp
      ? "help"
      : wantShop
        ? "shop"
        : wantCourier
          ? "courier"
          : wantReserve
            ? "reserve"
            : "ride",
  );
  /**
   * Lime Shop's store, once chosen. Not a scene flag: it is the fact that
   * flips the flow's order — options first, drop-off last — and the reducer
   * reads it as `locationAfterConfigure`.
   */
  const [shopStore, setShopStore] = useState<Location | null>(null);
  const [pickup, setPickup] = useState<Pickup>(UNSET_PICKUP);
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
  const [mapRecenterAt, setMapRecenterAt] = useState(0);
  const [phaseStart, setPhaseStart] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  const product = findBookableProduct(productId ?? "", RIDE_PRODUCTS) ?? null;
  const available = product?.status === "available";
  // Shop rides the courier rails: same products, same recipient, same proof.
  // Only the questions differ, so `courier` stays true for both.
  const shop = bookingMode === "shop";
  const courier = bookingMode === "courier" || shop;
  const reserve = bookingMode === "reserve";
  /**
   * Lime Help. Its scenes are the ordinary ones in an unusual order — when,
   * then kind, then where — so it is a booking mode, not a second reducer.
   */
  const help = bookingMode === "help";

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
    if (isCourierProduct(live.productId)) {
      setBookingMode(live.itemList ? "shop" : "courier");
    } else if (isHelpProduct(live.productId)) {
      setBookingMode("help");
    } else if (live.productId === "lime-reserve") setBookingMode("reserve");
    setState(SCENE_FOR_STATUS[live.status]);
  }, [activeTrip.data, activeTrip.isSuccess]);

  const startTrip = useCallback(
    async (input: {
      pickup: Pickup;
      destination: Location;
      productId: string;
      idempotencyKey: string;
      scheduledAt?: Date;
      courier?: {
        recipientName: string;
        recipientPhone: string;
        packageCount: number;
        proof: "hand" | "door" | "signature";
        itemList?: ShopItem[];
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
        scheduledAt: input.scheduledAt,
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
  // Depend on `apply`, not the manager object: layout changes (interrupts)
  // must not re-apply the scene recipe and wipe a suspended ride.
  const applySurfaces = surfaces.apply;
  useEffect(() => {
    if (rideMinimized) return;
    applySurfaces("progress", LIMECAB_SCENE_SURFACES[state]);
  }, [applySurfaces, rideMinimized, state]);

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
    if (wantHelp) {
      setBookingMode("help");
      // The kind is the second question, so no Help product is chosen yet.
      setProductId((id) => (isHelpProduct(id) ? id : null));
      return;
    }
    if (wantShop) {
      setBookingMode("shop");
      setProductId((id) => (isCourierProduct(id) ? id : "courier-small"));
      return;
    }
    if (wantCourier) {
      setBookingMode("courier");
      setProductId((id) => (isCourierProduct(id) ? id : "courier-small"));
      return;
    }
    if (wantReserve) {
      setBookingMode("reserve");
      setProductId("lime-reserve");
    }
  }, [wantCourier, wantHelp, wantReserve, wantShop, state]);

  useEffect(() => {
    if (
      wantCourier ||
      wantReserve ||
      wantShop ||
      wantHelp ||
      isCommitted(state) ||
      state !== "home"
    ) {
      return;
    }
    setBookingMode("ride");
    setShopStore(null);
    setProductId((id) =>
      isCourierProduct(id) || isHelpProduct(id) || id === "lime-reserve"
        ? null
        : id,
    );
  }, [wantCourier, wantHelp, wantReserve, wantShop, state]);

  const go = useCallback(
    (
      event: ServiceAppEvent,
      overrides?: Partial<{
        hasLocation: boolean;
        hasService: boolean;
        pinEntry: "home" | "search";
        needsConfigure: boolean;
        needsServiceSelect: boolean;
        locationAfterConfigure: boolean;
        selectAfterConfigure: boolean;
        needsPickupConfirm: boolean;
      }>,
    ) =>
      setState((current) =>
        reduceServiceAppState(current, event, {
          hasLocation: Boolean(destination),
          hasService: courier || reserve || Boolean(available),
          needsConfigure: courier || reserve || help,
          needsServiceSelect: (!courier && !reserve) || help,
          // Shop asks for the shop, then the list, then the drop-off — until
          // the shop is chosen it is in its ordinary order. Help always asks
          // when, then what kind, then where.
          locationAfterConfigure: help || (shop && shopStore !== null),
          selectAfterConfigure: help,
          // Immediate rides confirm the curb after the product; courier,
          // Reserve, and Help still purchase on the quote.
          needsPickupConfirm: !courier && !reserve && !help,
          pinEntry,
          ...overrides,
        }),
      ),
    [available, courier, destination, help, pinEntry, reserve, shop, shopStore],
  );

  const duration = PHASE_HINT_MS[state] ?? 0;
  const t = duration > 0 ? Math.min(1, (now - phaseStart) / duration) : 0;

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
      latitude: pickup.latitude ?? CAMERA_FALLBACK.latitude,
      longitude: pickup.longitude ?? CAMERA_FALLBACK.longitude,
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
    return list;
  }, [destinationPoint, driverPoint, pickupPoint, state, stops]);

  const estimate = useMemo(
    () =>
      destination ? quoteFor(RIDE_PRODUCTS[0]!, pickup, destination) : null,
    [destination, pickup],
  );

  const status = useMemo<ServiceStatus>(() => {
    if (failure) return { state: "failed", reason: failure };
    const secondsLeft = phaseSecondsLeft(duration, t);
    switch (state) {
      case "matching":
        return { state: "matching", typicalSeconds: secondsLeft };
      case "assigned":
        return {
          state: "assigned",
          providerName: trip?.driver.name,
          etaSeconds: secondsLeft,
        };
      case "provider_en_route":
        return secondsLeft === 0
          ? { state: "arriving", providerName: trip?.driver.name }
          : {
              state: "provider_en_route",
              providerName: trip?.driver.name,
              etaSeconds: secondsLeft,
            };
      case "active":
        return {
          state: "active",
          completedSteps: Math.floor(t * 4),
          totalSteps: 4,
          currentStep: destination
            ? `On the way to ${splitAddress(destination.address).line}`
            : "On the way",
          remainingSeconds: secondsLeft,
        };
      case "completing":
        return { state: "completing" };
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
  }, [courier, destination, duration, failure, state, t, trip]);

  const mapPosture = surfaces.layout.map?.presentation ?? "bounded";
  const pinning = state === "location_pin";
  const confirmingPickup = state === "confirm_pickup";
  const locatingPickup = pinning || confirmingPickup;
  const center =
    locatingPickup && pin
      ? pin
      : liveVehicle && driverPoint
        ? driverPoint
        : confirmingPickup || state === "home" || !destinationPoint
          ? pickupPoint
          : destinationPoint;
  const fallbackTrip = useMemo(
    () => (destinationPoint ? [pickupPoint, destinationPoint] : undefined),
    [destinationPoint, pickupPoint],
  );
  const mapRoute =
    locatingPickup || state === "home"
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
    state === "confirm_pickup" ||
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
    if (isCommitted(state)) {
      if (surfaces.layout.search.emphasis !== "primary") {
        surfaces.perform("addRideStop");
      }
      return;
    }
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
      latitude: seed.latitude ?? CAMERA_FALLBACK.latitude,
      longitude: seed.longitude ?? CAMERA_FALLBACK.longitude,
    });
    setPinAddress(seed.address || pickup.address);
    setPinShortName(splitAddress(seed.address || pickup.address).line);
    setPinLocating(false);
    surfaces.perform("chooseOnMap");
    go("choose_on_map", { pinEntry: entry });
  };

  useEffect(() => {
    if (!locatingPickup || !pin) return;
    const seeded =
      Boolean(pickup.address) &&
      pickup.latitude !== undefined &&
      pickup.longitude !== undefined &&
      Math.abs(pin.latitude - pickup.latitude) < 1e-5 &&
      Math.abs(pin.longitude - pickup.longitude) < 1e-5;
    // The pin was just placed on the known pickup. Don't reverse until
    // the rider actually moves the map — a failed geocode would replace
    // the real street with "Pinned location".
    if (seeded && state === "confirm_pickup") return;
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
            if (resolved?.address) {
              setPinAddress(resolved.address);
              setPinShortName(
                resolved.shortName ??
                  splitAddress(resolved.address).line ??
                  "Pinned location",
              );
            }
          }
        } catch {
          // Keep the seeded address; "Pinned location" is only when we have none.
        } finally {
          if (!cancelled) setPinLocating(false);
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    locatingPickup,
    pin,
    pickup.address,
    pickup.latitude,
    pickup.longitude,
    state,
  ]);

  /** Seed the pin from the current pickup when the curb becomes the question. */
  useEffect(() => {
    if (state !== "confirm_pickup") return;
    setPin({
      latitude: pickup.latitude ?? CAMERA_FALLBACK.latitude,
      longitude: pickup.longitude ?? CAMERA_FALLBACK.longitude,
    });
    setPinAddress(pickup.address || null);
    setPinShortName(splitAddress(pickup.address).line || null);
    setPinLocating(false);
    // Pickup is read on entry; panning must not re-seed from a stale address.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

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
  const recenterPickup = useCallback(() => {
    if (
      recentering ||
      typeof navigator === "undefined" ||
      !navigator.geolocation
    ) {
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
            setPin({ latitude, longitude });
            setPinAddress(resolved?.address ?? "Current location");
            setPinShortName(
              resolved?.shortName ??
                splitAddress(resolved?.address ?? "Current location").line,
            );
            setRecentering(false);
          });
      },
      () => setRecentering(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [recentering]);

  /**
   * The pickup starts unset and is *found*, never assumed. The device first,
   * because that is where the rider is standing; their last pickup second,
   * because that is where they have actually been. Nothing invents an address.
   */
  const pickupSeeded = useRef(false);
  const resetPickupSeed = useCallback(() => {
    pickupSeeded.current = false;
  }, []);
  const recent = api.trip.list.useQuery(undefined, {
    enabled: signedIn && !pickup.address,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (pickupSeeded.current || pickup.address) return;
    pickupSeeded.current = true;
    recenterPickup();
  }, [pickup.address, recenterPickup]);

  useEffect(() => {
    if (pickup.address || recentering) return;
    const last = recent.data?.find(
      (row) => row.pickupLatitude != null && row.pickupLongitude != null,
    );
    if (!last) return;
    setPickup({
      address: last.pickupAddress,
      latitude: last.pickupLatitude ?? undefined,
      longitude: last.pickupLongitude ?? undefined,
      followsDevice: false,
    });
  }, [pickup.address, recent.data, recentering]);

  // Address search is biased to where the rider actually is, not to a constant.
  useEffect(() => {
    setSearchProximity(pickup);
  }, [pickup]);

  /**
   * Cars near the pickup — drivers who have pinged in the last 45 seconds,
   * snapped to their cell centre. Zero of them draws zero of them: an empty
   * canvas is the truthful answer to "is LimeCab live here?", and three
   * invented Priuses were the most dishonest pixels in the product.
   */
  const wantsNearby =
    signedIn &&
    (state === "home" || state === "matching") &&
    pickup.latitude !== undefined &&
    pickup.longitude !== undefined;
  const nearby = api.driver.nearby.useQuery(
    {
      latitude: pickup.latitude ?? CAMERA_FALLBACK.latitude,
      longitude: pickup.longitude ?? CAMERA_FALLBACK.longitude,
    },
    { enabled: wantsNearby, refetchInterval: 4_000 },
  );
  const nearbyCars = useMemo<MapPoint[]>(
    () =>
      wantsNearby
        ? (nearby.data ?? []).map((car) => ({
            ...car,
            kind: "marker" as const,
          }))
        : [],
    [nearby.data, wantsNearby],
  );

  return (
    <ServiceAppShell
      layout={state === "home" || rideMinimized ? "home" : "task"}
      onMapPress={rideMinimized ? restoreRide : () => openPin("pickup", "home")}
      map={
        standby ? null : (
          <ManagedSurface<LimeCabSurfaceId> id="map">
            <div className="relative size-full">
              <ServiceMap
                adapter={mapAdapter}
                mode={LIMECAB_MAP_MODE[mapPosture] ?? "home"}
                center={center}
                interactive={surfaces.layout.map?.interaction === "active"}
                recenterAt={mapRecenterAt}
                onCameraChange={locatingPickup ? setPin : undefined}
                // Idle cars on the home canvas: the rider's first question is
                // whether LimeCab is even live here, and real pings answer it
                // before any tap. None nearby draws none.
                points={locatingPickup ? [] : [...points, ...nearbyCars]}
                route={mapRoute}
                pinLabel={locatingPickup ? pinShortName : undefined}
                pinLocating={locatingPickup && pinLocating}
                label={
                  locatingPickup ||
                  rideMinimized ||
                  (state !== "home" && state !== "location_search")
                    ? null
                    : pickupLine
                }
                callout={
                  locatingPickup || status.state === "failed"
                    ? null
                    : serviceStatusView(status).callout
                }
              />
              {!pinning &&
              !rideMinimized &&
              state !== "home" &&
              state !== "location_search" ? (
                <MapRouteBar
                  origin={pickupLine || destinationLine}
                  // A visit has one address; the bar would otherwise show it
                  // twice with an arrow between. A shop list has a store and
                  // no drop-off yet — same origin-only bar, so Back exists.
                  destination={
                    help || !destination || confirmingPickup ? "" : destinationLine
                  }
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
                    canReviseRoute && destination && !confirmingPickup
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
              state !== "location_search" &&
              (!isCommitted(state) || liveRide) ? (
                <RecenterPickupButton
                  busy={!isCommitted(state) && recentering}
                  label={
                    liveRide
                      ? "Recenter the map"
                      : "Recenter pickup on my location"
                  }
                  onPress={
                    liveRide
                      ? () => setMapRecenterAt((n) => n + 1)
                      : recenterPickup
                  }
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
        shop={shop}
        help={help}
        shopStore={shopStore}
        setShopStore={setShopStore}
        setSearchTarget={setSearchTarget}
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
        resetPickupSeed={resetPickupSeed}
        onMinimizeRide={minimizeRide}
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
  label = "Recenter pickup on my location",
  onPress,
}: {
  busy: boolean;
  label?: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={busy}
      aria-label={label}
      className={cn(
        "bg-card ring-border focus-visible:ring-ring absolute right-3 z-10 inline-flex size-11 touch-manipulation items-center justify-center rounded-full shadow-[0_4px_16px_rgba(26,24,20,0.12)] ring-1 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60",
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

/**
 * File this address, without choosing it. Deliberately a second target beside
 * the row rather than a control inside it: tapping the row books there, and
 * these two answers must not be one tap apart from each other's target.
 */
function SaveRowButton({ onPress }: { onPress: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Save this place"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPress}
      className="text-muted-foreground"
    >
      <Icon icon={BookmarkAdd01Icon} size={18} />
    </Button>
  );
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
  shop,
  help,
  shopStore,
  setShopStore,
  setSearchTarget,
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
  resetPickupSeed,
  onMinimizeRide,
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
      locationAfterConfigure: boolean;
      selectAfterConfigure: boolean;
      needsPickupConfirm: boolean;
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
  shop: boolean;
  help: boolean;
  shopStore: Location | null;
  setShopStore: (next: Location | null) => void;
  setSearchTarget: (next: RideSearchTarget) => void;
  setBookingMode: (next: BookingMode) => void;
  trip: Trip | null;
  serverStatus: TripStatus | null;
  startTrip: (input: {
    pickup: Pickup;
    destination: Location;
    productId: string;
    idempotencyKey: string;
    scheduledAt?: Date;
    courier?: {
      recipientName: string;
      recipientPhone: string;
      packageCount: number;
      proof: "hand" | "door" | "signature";
      itemList?: ShopItem[];
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
  resetPickupSeed: () => void;
  onMinimizeRide: () => void;
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
   * Lime Shop's list. Draft rows, so an empty one is a row waiting to be
   * typed rather than an item; `normalizeShopList` decides what is real.
   */
  const [shopItems, setShopItems] = useState<ShopItem[]>([{ label: "" }]);
  /** What needs doing at the house. Inline on the kind scene, not a scene. */
  const [helpNote, setHelpNote] = useState("");
  const [traveling, setTraveling] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [snack, setSnack] = useState<(typeof FOR_THE_WAY_ITEMS)[number] | null>(
    null,
  );
  const [forTheWayOpen, setForTheWayOpen] = useState(false);
  const forTheWayAsked = useRef(false);
  const voiceOpenedSearch = useRef(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  /** Which address the save interrupt is filing. App data, not a screen flag. */
  const [placeToSave, setPlaceToSave] = useState<Location | null>(null);
  const [searchAudience, setSearchAudience] = useState<SearchAudience>("self");
  const [locatingHere, setLocatingHere] = useState(false);
  const applyVoiceRef = useRef<(text: string) => void>(() => undefined);
  const voice = useVoiceCapture((text) => applyVoiceRef.current(text));

  const bookingMode: BookingMode = help
    ? "help"
    : shop
      ? "shop"
      : courier
        ? "courier"
        : reserve
          ? "reserve"
          : "ride";
  const searchContract = searchInputContract({
    mode: bookingMode,
    target: searchTarget,
    audience: searchAudience,
  });

  useEffect(() => {
    setSearchAudience("self");
  }, [searchTarget, help, shop, courier, reserve]);

  /** The rider themselves, for the courier flow's "send it to me" prefill. */
  const rider = api.rider.me.useQuery(undefined, { enabled: signedIn }).data;

  /**
   * This user's own places. Home and Work are slots; custom spots are a list;
   * recents come from their own trips. An account with none has none — the
   * lists render nothing rather than borrowing somebody else's Echo Park.
   */
  const savedQuery = api.places.list.useQuery(undefined, { enabled: signedIn });
  const savedSlots = useMemo<Place[]>(() => {
    const list = savedQuery.data;
    if (!list) return [];
    return [list.home, list.work].flatMap((place) => (place ? [place] : []));
  }, [savedQuery.data]);
  const recents = useMemo(
    () => savedQuery.data?.recents ?? [],
    [savedQuery.data?.recents],
  );

  /**
   * Custom spots a few blocks from the pickup, ranked above recents on an
   * empty query. The only search path that touches H3 — and it never returns
   * a cell, so the rider never sees a hex.
   */
  const nearbyPlaces = api.places.nearby.useQuery(
    {
      latitude: pickup.latitude ?? 0,
      longitude: pickup.longitude ?? 0,
    },
    {
      enabled:
        signedIn &&
        pickup.latitude !== undefined &&
        pickup.longitude !== undefined,
    },
  );

  /**
   * Shops around the rider, for Shop's "Which shop?". Mapbox Category Search
   * with a fixture list behind it — the scene always has rows.
   */
  const [nearbyShops, setNearbyShops] = useState<Place[]>([]);
  const wantsShops =
    shop && state === "location_search" && searchTarget === "pickup";
  useEffect(() => {
    if (!wantsShops) return;
    const ac = new AbortController();
    void fetchNearbyShops(pickup, ac.signal)
      .then((stops) =>
        setNearbyShops(
          stops.slice(0, 8).map((stop, index) => ({
            id: `shop:${stop.latitude},${stop.longitude},${index}`,
            label: stop.shortName ?? splitAddress(stop.address).line,
            address: stop.address,
            latitude: stop.latitude,
            longitude: stop.longitude,
            source: "saved" as const,
            hint: stop.category === "pharmacy" ? "Pharmacy" : "Grocery",
          })),
        ),
      )
      .catch(() => undefined);
    return () => ac.abort();
  }, [pickup, wantsShops]);

  /** Home/Work slots, then nearby customs, then recents — not every custom. */
  const searchPlaces = useMemo<Place[]>(() => {
    const near = nearbyPlaces.data ?? [];
    const nearIds = new Set(near.map((place) => place.id));
    const rest = [
      ...savedSlots.filter((place) => !nearIds.has(place.id)),
      ...near,
      ...recents,
    ];
    // Picking the shop is the question, so shops come first — not the
    // rider's own saved addresses, which are never the store.
    return wantsShops ? [...nearbyShops, ...rest] : rest;
  }, [nearbyPlaces.data, nearbyShops, recents, savedSlots, wantsShops]);

  applyVoiceRef.current = (text) => {
    const parsed = submitVoiceText(text, (message) => {
      setVoiceError(message);
      setSearchError(message);
    });
    if (!parsed?.destinationQuery) {
      voice.setTyped(text);
      return;
    }
    // "take me home" still parses to the query "Home"; what Home *means* is
    // this user's saved slot, and an unset slot fails honestly rather than
    // driving them to somebody else's Echo Park.
    const slot = parsed.destinationQuery.trim().toLowerCase();
    const savedSlot =
      slot === "home"
        ? savedQuery.data?.home
        : slot === "work"
          ? savedQuery.data?.work
          : null;
    const place =
      slot === "home" || slot === "work"
        ? savedSlot
          ? {
              address: savedSlot.address,
              latitude: savedSlot.latitude ?? undefined,
              longitude: savedSlot.longitude ?? undefined,
            }
          : null
        : locationFromFixture(parsed.destinationQuery);
    if (!place) {
      const message =
        slot === "home" || slot === "work"
          ? `You haven’t saved a ${slot === "home" ? "Home" : "Work"} yet.`
          : "Couldn’t find that place. Try LAX, Home, or Griffith.";
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
    if (
      visible === "quote" ||
      visible === "confirm_pickup" ||
      visible === "location_search" ||
      visible === "matching"
    ) {
      return;
    }
    if (visible === "assigned" || visible === "provider_en_route") return;
    if (
      visible === "active" ||
      visible === "completing" ||
      visible === "complete"
    ) {
      return;
    }
    forTheWayAsked.current = false;
  }, [visible]);

  useEffect(() => {
    if (visible !== "quote" && visible !== "confirm_pickup") return;
    if (!forTheWayEligible(product?.id)) return;
    if (forTheWayAsked.current || snack) return;
    forTheWayAsked.current = true;
    surfaces.perform("openForTheWay");
    setForTheWayOpen(true);
  }, [product?.id, snack, surfaces, visible]);

  const shopList = useMemo(() => normalizeShopList(shopItems), [shopItems]);
  const shopReady =
    shopList.length > 0 &&
    courierDraftReady(courierDraftFromOptions(courierValues));

  const payment =
    PAYMENT_METHODS.find((entry) => entry.id === paymentId) ??
    PAYMENT_METHODS[0]!;
  const discountCents = promoApplied ? AVAILABLE_PROMO.amountCents : 0;

  const quote = useMemo(() => {
    if (!product || !destination) return null;
    // A visit is priced the way `trip.request` prices it: an hour at the
    // house, zero miles. Quoting driving minutes here would show a number
    // nobody is charged.
    const priced = help
      ? {
          fare: estimateFare(product, 0, HELP_VISIT_MINUTES),
          miles: 0,
          minutes: HELP_VISIT_MINUTES,
        }
      : quoteFor(product, pickup, destination);
    const { fare, miles, minutes } = priced;
    const optionLines = shop
      ? [
          {
            label: `Your list · ${shopItemCountLabel(shopListUnitCount(shopList))}`,
            value: shopListSummary(shopList),
          },
          ...summarizeOptions(SHOP_OPTIONS, courierValues),
        ]
      : courier
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
  }, [
    courier,
    courierValues,
    destination,
    help,
    pickup,
    product,
    shop,
    shopList,
    snack,
  ]);

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

    // Lime Help's only place: the house is where the helper comes and where
    // they stay. Sending it as both ends keeps one trip row and one pin —
    // there is no cross-town route to draw.
    if (help) {
      setPickup({ ...pickup, ...result, followsDevice: false });
      setDestination(result);
      surfaces.perform("destinationSelected");
      go("select_location", { hasLocation: true, hasService: true });
      return;
    }

    // Lime Shop's first question. The store becomes the pickup and the next
    // unknown is the list, not a second address — so this does not fall
    // through to "which field is still empty?".
    if (shop && (searchTarget === "pickup" || shopStore === null)) {
      setPickup({ ...pickup, ...result, followsDevice: false });
      setShopStore(result);
      surfaces.perform("shopSelected");
      go("select_location", {
        hasService: true,
        needsConfigure: true,
        needsServiceSelect: false,
        locationAfterConfigure: false,
      });
      return;
    }

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

    // A stop (or destination edit) on a live ride is an interruption. Apply
    // the draft and restore the ride — never progress back to planning.
    if (isCommitted(state)) {
      if (next === "complete") {
        surfaces.perform("resumeRide");
      } else {
        setSearchTarget(targetFromField(next));
      }
      return;
    }

    // Home map card: adjusting pickup returns to home, does not open search.
    if (pinEntry === "home" && searchTarget === "pickup") {
      setPinEntry("search");
      setState("home");
      return;
    }

    if (next === "complete") {
      const pickupConfirm = !courier && !reserve && !help && Boolean(product);
      surfaces.perform(pickupConfirm ? "confirmPickup" : "destinationSelected");
      go("select_location", {
        hasLocation: true,
        hasService: courier || reserve || Boolean(product),
        needsConfigure: courier || reserve,
        needsServiceSelect: !courier && !reserve,
      });
      return;
    }

    openSearch(targetFromField(next));
  };

  const useHere = () => {
    if (!navigator.geolocation) {
      setSearchError("Current location isn't available in this browser.");
      return;
    }
    setLocatingHere(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void (async () => {
          const { latitude, longitude } = position.coords;
          try {
            const resolved = await placesAdapter.reverse?.(latitude, longitude);
            chooseLocation(
              resolved ?? { address: "Current location", latitude, longitude },
            );
          } catch {
            chooseLocation({
              address: "Current location",
              latitude,
              longitude,
            });
          } finally {
            setLocatingHere(false);
          }
        })();
      },
      () => {
        setLocatingHere(false);
        setSearchError("Location permission is off.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
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
        result = locationFromFixture(suggestion.address) ?? {
          address: suggestion.address,
        };
      }
      if (intent === "ride") {
        chooseLocation(result);
        return;
      }
      if (intent === "help") {
        setBookingMode("help");
        setPickup({ ...pickup, ...result, followsDevice: false });
        setDestination(result);
        // The house is known; when and kind are not. Lie to the reducer about
        // hasLocation so Help still asks the clock first — the destination is
        // already sitting in state for the quote.
        surfaces.perform("chooseRide");
        go("select_service", {
          hasService: false,
          hasLocation: false,
          needsConfigure: true,
          needsServiceSelect: true,
          locationAfterConfigure: true,
          selectAfterConfigure: true,
        });
        return;
      }
      setProductId("courier-small");
      if (intent === "store") {
        // "Get from a store" *is* Lime Shop: the store becomes the pickup and
        // the next question is the list, not a one-line "what should they
        // buy?" crammed into the packed-courier form.
        const here =
          pickup.address && pickup.latitude !== undefined
            ? {
                address: pickup.address,
                latitude: pickup.latitude,
                longitude: pickup.longitude,
              }
            : null;
        setBookingMode("shop");
        setPickup({ ...pickup, ...result, followsDevice: false });
        setShopStore(result);
        setDestination(here);
        setShopItems([{ label: "" }]);
        setCourierValues({
          ...defaultOptionValues(COURIER_OPTIONS),
          recipientName: rider?.name ?? "",
          recipientPhone: rider?.phone ?? "",
        });
        surfaces.perform("shopSelected");
        go("select_location", {
          hasService: true,
          needsConfigure: true,
          needsServiceSelect: false,
          locationAfterConfigure: false,
        });
        return;
      }
      setBookingMode("courier");
      setDestination(result);
      setCourierValues(defaultOptionValues(COURIER_OPTIONS));
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
    surfaces.perform(courier || reserve || help ? "chooseRide" : "confirmPickup");
    go("select_service", { hasService: true });
  };

  const planningScene: ServiceAppState =
    courier || reserve || help ? "quote" : "confirm_pickup";

  /**
   * The perceived-performance path. One semantic action moves three surfaces;
   * the progress machine owns the lock, the choreography, and the truthful
   * order — the quote is gone before "Finding your driver" appears, and no
   * driver exists until dispatch says so.
   */
  const requestRide = (origin: Pickup = pickup) => {
    if (!destination || !product || surface.progress.locked) return;
    setFailure(null);
    idempotencyKey.current ??= crypto.randomUUID();
    const key = idempotencyKey.current;
    void (async () => {
      try {
        surfaces.perform("requestRide");
        await surface.transition({
          intent: "progress",
          from: planningScene,
          to: "matching",
          interim: "map",
          task: () => {
            const draft = courierDraftFromOptions(courierValues);
            // The clock is a column now, so the meeting point carries only
            // what the rider actually wrote about the visit.
            const meeting = help
              ? helpNote.trim() || undefined
              : courier
                ? courierMeetingPoint(
                    courierValues,
                    shop ? shopListUnitCount(shopList) : undefined,
                  )
                : [
                    reserve && scheduledAt ? reservedLabel(scheduledAt) : null,
                    snack ? `${snack.label} at Grand Central Market` : null,
                    origin.meetingPoint,
                  ]
                    .filter(Boolean)
                    .join(" · ") || undefined;
            return startTrip({
              pickup: {
                ...origin,
                meetingPoint: meeting,
              },
              destination,
              productId: product.id,
              idempotencyKey: key,
              // Reserve already had the instant client-side; a visit needs it
              // on the row, so both send it now.
              scheduledAt:
                help || reserve ? (scheduledAt ?? undefined) : undefined,
              courier: courier
                ? {
                    recipientName: draft.recipientName,
                    recipientPhone: draft.recipientPhone,
                    packageCount: draft.quantity,
                    proof: draft.proof,
                    // A list on the row is what makes this a Shop job.
                    itemList: shop ? shopList : undefined,
                  }
                : undefined,
            });
          },
        });
        // Truthful: the request is accepted, so "matching" is what is
        // happening. No driver exists until the server sends one.
        setState("matching");
      } catch {
        // Dispatch refused the request: the planning surface comes back
        // untouched and carries the error the transition captured.
        surfaces.perform(
          planningScene === "confirm_pickup" ? "confirmPickup" : "requestFailed",
        );
        setState(planningScene);
      }
    })();
  };

  const confirmPickupAndRequest = () => {
    const committed =
      pin && pinAddress
        ? {
            ...pickup,
            address: pinAddress,
            latitude: pin.latitude,
            longitude: pin.longitude,
            followsDevice: false,
          }
        : pickup;
    setPickup(committed);
    if (signedIn) {
      requestRide(committed);
      return;
    }
    window.location.href = "/signin";
  };

  const backToQuote = () => {
    setFailure(null);
    clearTrip();
    surfaces.perform("requestFailed");
    setState(planningScene);
  };

  const reset = () => {
    setFailure(null);
    setCancelError(null);
    clearTrip();
    idempotencyKey.current = null;
    setProductId(courier ? "courier-small" : reserve ? "lime-reserve" : null);
    setCourierValues(defaultOptionValues(COURIER_OPTIONS));
    setShopItems([{ label: "" }]);
    setShopStore(null);
    setHelpNote("");
    setDestination(null);
    setStops([]);
    setScheduledAt(null);
    setSnack(null);
    forTheWayAsked.current = false;
    voice.stop();
    setRating(null);
    setTipCents(null);
    setPromoApplied(false);
    setPickup(UNSET_PICKUP);
    resetPickupSeed();
    setState("home");
  };

  /**
   * Leave the current task. A live service stands down to the pill; a draft
   * or a finished trip returns to Home. The sheet's swipe-to-dismiss lands here.
   */
  const leaveTask = () => {
    if (isCommitted(state) && state !== "complete") {
      onMinimizeRide();
      return;
    }
    if (state === "complete") {
      reset();
      return;
    }
    surfaces.perform("leaveTask");
    setShopStore(null);
    setDestination(null);
    setStops([]);
    setShopItems([{ label: "" }]);
    setScheduledAt(null);
    setCourierValues(defaultOptionValues(COURIER_OPTIONS));
    setHelpNote("");
    setSnack(null);
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
    setPlaceToSave(null);
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
          saved={savedSlots}
          recents={recents}
          title={
            help
              ? "Help at home"
              : shop
                ? "Shop"
                : courier
                  ? "Where is it going?"
                  : reserve
                    ? "Book ahead"
                    : undefined
          }
          destinationHint={
            help
              ? "When should they arrive?"
              : shop
                ? "Which shop?"
                : courier
                  ? "Where is it going?"
                  : "Where to?"
          }
          traveling={traveling}
          onTravelingChange={setTraveling}
          onSearch={(target) => {
            // Help's first question is the clock, so its launcher opens the
            // options scene rather than a place search.
            if (help) {
              surfaces.perform("chooseRide");
              go("select_service", { hasService: false });
              return;
            }
            openSearch(shop ? "pickup" : target);
          }}
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
                : visible === "confirm_pickup"
                  ? "Confirm pickup"
                  : courier
                    ? "Your delivery"
                    : "Your ride"
            }
            presentation={sheetPresentation(
              surfaces.layout.primary?.presentation ?? "sheet",
            )}
            onDismiss={visible === "location_pin" ? undefined : leaveTask}
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
                secondary={
                  signedIn && pinAddress && !pinLocating ? (
                    <Button
                      variant="ghost"
                      className="text-muted-foreground -ml-2 h-10 px-2"
                      onClick={() => {
                        surfaces.perform("openDetails");
                        setPlaceToSave({
                          address: pinAddress,
                          latitude: pin?.latitude,
                          longitude: pin?.longitude,
                        });
                      }}
                    >
                      Save this place
                    </Button>
                  ) : null
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

            {visible === "confirm_pickup" ? (
              <LimeCabConfirmPickupScene
                address={
                  pinAddress ? splitAddress(pinAddress).line || pinAddress : null
                }
                locating={pinLocating}
                busy={surface.progress.locked}
                onSearch={() => openSearch("pickup")}
                onConfirm={confirmPickupAndRequest}
              />
            ) : null}

            {visible === "service_select" && help ? (
              <LimeCabHelpKindScene
                productId={product?.id ?? null}
                onSelect={setProductId}
                note={helpNote}
                onNoteChange={setHelpNote}
                onContinue={() => {
                  surfaces.perform("chooseRide");
                  go("select_service", { hasService: true });
                }}
              />
            ) : null}

            {visible === "service_select" && !help ? (
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
              help ? (
                <LimeCabWhenScene
                  value={scheduledAt}
                  onChange={setScheduledAt}
                  onContinue={() => go("configure_done")}
                  title="When should they arrive?"
                  description="Daytime visits, today or tomorrow. No overnight."
                  action="Continue"
                  slotsFor={helpVisitSlots}
                  emptyDayNote="No visits left today. Try tomorrow."
                />
              ) : shop && shopStore ? (
                <LimeCabShopScene
                  store={
                    shopStore.shortName ?? splitAddress(shopStore.address).line
                  }
                  items={shopItems}
                  onItemsChange={setShopItems}
                  values={courierValues}
                  ready={shopReady}
                  onChange={(id, value) => {
                    setCourierValues((current) => {
                      const next = { ...current, [id]: value };
                      if (id === "size") {
                        setProductId(courierProductFromOptions(next).id);
                      }
                      return next;
                    });
                  }}
                  onEditStore={() => openSearch("pickup")}
                  onContinue={() => {
                    // The remaining unknown is the drop-off, so the reducer
                    // sends this to a prepared search and back revises here.
                    setSearchTarget("destination");
                    go("configure_done", { locationAfterConfigure: true });
                  }}
                />
              ) : reserve ? (
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
                destinationLine={help ? "" : destinationLine}
                stopLines={stops.map(
                  (stop) => stop.shortName ?? splitAddress(stop.address).line,
                )}
                pickupLabel={
                  help
                    ? "Where"
                    : shop
                      ? "Shop"
                      : courier
                        ? "Pick up"
                        : "Pickup"
                }
                destinationLabel={courier ? "Drop-off" : "Destination"}
                payment={payment}
                promoApplied={promoApplied}
                busy={surface.progress.locked}
                error={surface.progress.error}
                signedIn={signedIn}
                pricingLabel={
                  help
                    ? "Pricing your visit"
                    : shop
                      ? "Pricing your trip"
                      : courier
                        ? "Pricing your delivery"
                        : "Pricing your ride"
                }
                etaLine={
                  help && scheduledAt
                    ? `${helpVisitLabel(scheduledAt)} · ${helpKindLabel(product.id)}`
                    : courier
                      ? `Pickup in ~${product.etaMinutes} min · Deliver by ${clockTime(product.etaMinutes + quote.minutes)}`
                      : reserve && scheduledAt
                        ? reservedLabel(scheduledAt)
                        : undefined
                }
                confirmLabel={
                  signedIn
                    ? help
                      ? `${isCareProduct(product.id) ? "Schedule Care" : "Schedule Help"} · ${formatMoney(payableCents)}`
                      : reserve
                        ? `Reserve Lime · ${formatMoney(payableCents)}`
                        : undefined
                    : undefined
                }
                footnote={
                  help
                    ? "A visit is priced as an hour at the house. Nothing is charged in this demo."
                    : shop
                      ? "Item cost is paid in store by the courier. This price is the trip. This build does not reimburse or scan receipts."
                      : courierValues.fulfillment === "buy"
                        ? "Item cost is paid in store; this fare is the trip. Nothing is charged in this demo."
                        : isWaitSaveProduct(product.id)
                          ? "Same private Lime ride. A later pickup for a lower fare."
                          : undefined
                }
                signInLabel={
                  help
                    ? "Sign in to schedule a visit"
                    : shop
                      ? "Sign in to send a courier"
                      : courier
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
                  help
                    ? { provider: "helper", service: "visit" }
                    : courier
                      ? { provider: "courier", service: "delivery" }
                      : { provider: "driver", service: "ride" }
                }
                shareLabel={
                  traveling ? "Share with someone at home" : "Share trip"
                }
                liveSubtitle={
                  // Truthful: a visit hours away must not read as a car four
                  // minutes out, so the clock is what the live scene says.
                  help && scheduledAt
                    ? `${helpVisitLabel(scheduledAt)} · ${product ? helpKindLabel(product.id) : ""}`.trim()
                    : shop
                      ? visible === "active" || visible === "completing"
                        ? "On the way to you"
                        : `Buying your list · ${shopItemCountLabel(shopListUnitCount(shopList))}, then delivering`
                      : snack &&
                          (visible === "assigned" ||
                            visible === "provider_en_route")
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
                onAddStop={
                  status.state === "active" &&
                  showDriver &&
                  !courier &&
                  !help &&
                  !shop
                    ? () => {
                        const added = addStop({
                          origin: pickup,
                          destination,
                          stops,
                        });
                        if (!added) return;
                        setStops(added.draft.stops);
                        openSearch(targetFromField(added.next));
                      }
                    : undefined
                }
                canAddStop={stops.length < MAX_INTERMEDIATE_STOPS}
                onTip={
                  status.state === "active" &&
                  showDriver &&
                  !courier &&
                  !help &&
                  !shop
                    ? () => openDetail("tip")
                    : undefined
                }
                tipCents={tipCents}
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
                headline={
                  help
                    ? "Visit finished"
                    : courier
                      ? "Package delivered"
                      : "You've arrived"
                }
                totalLabel={
                  help
                    ? "Visit total"
                    : courier
                      ? "Delivery total"
                      : "Trip total"
                }
                providerNoun={
                  help
                    ? "your helper"
                    : courier
                      ? "your courier"
                      : "your driver"
                }
              />
            ) : null}
          </ServiceSheet>
        </ManagedSurface>
      ) : null}

      <ManagedSurface<LimeCabSurfaceId> id="search">
        <LocationSearchScene
          open={
            state === "location_search" ||
            surfaces.layout.search.emphasis === "primary"
          }
          adapter={placesAdapter}
          places={searchPlaces}
          title={searchContract.title}
          placeholder={searchContract.placeholder}
          inputAriaLabel={searchContract.ariaLabel}
          value={
            searchContract.showRoute
              ? ""
              : searchContract.role === "store"
                ? (shopStore?.address ?? "")
                : (destination?.address ?? "")
          }
          route={
            searchContract.showRoute
              ? {
                  origin: shop && !shopStore ? "" : pickupLine,
                  originLabel: searchContract.originLabel,
                  destination: destination?.address ?? "",
                  destinationLabel: searchContract.destinationLabel,
                  stops: stops.map((stop) => splitAddress(stop.address).line),
                  active: fieldFromTarget(searchTarget),
                  onSwitch: (field) => openSearch(targetFromField(field)),
                  onAddStop: searchContract.allowStops
                    ? () => {
                        const added = addStop({
                          origin: pickup,
                          destination,
                          stops,
                        });
                        if (!added) return;
                        setStops(added.draft.stops);
                        openSearch(targetFromField(added.next));
                      }
                    : undefined,
                  onRemoveStop: searchContract.allowStops
                    ? (index) => {
                        const nextDraft = removeStop(
                          { origin: pickup, destination, stops },
                          index,
                        );
                        setStops(nextDraft.stops);
                        if (searchTarget === `stop:${index}`) {
                          const next =
                            nextEmptyField(nextDraft) ??
                            ("destination" as const);
                          openSearch(targetFromField(next));
                          return;
                        }
                        if (searchTarget.startsWith("stop:")) {
                          const current = Number(
                            searchTarget.slice("stop:".length),
                          );
                          if (current > index) {
                            openSearch(`stop:${current - 1}`);
                          }
                        }
                      }
                    : undefined,
                }
              : undefined
          }
          lead={
            <LimeCabSearchInputAdapter
              contract={searchContract}
              audience={searchAudience}
              locating={locatingHere}
              onAudienceChange={setSearchAudience}
              onUseHere={useHere}
            />
          }
          onSelect={chooseLocation}
          onChooseOnMap={isCommitted(state) ? undefined : onChooseOnMap}
          onDismiss={() => {
            setSearchError(null);
            voice.stop();
            if (isCommitted(state)) {
              surfaces.perform("resumeRide");
              return;
            }
            // Leaving a search returns to the scene that asked for it. For
            // Shop that is the list whenever the *store* is what is being
            // revised, whether or not a drop-off is already set.
            go("cancel_search", {
              ...(shop && searchTarget === "pickup"
                ? { hasLocation: false }
                : {}),
            });
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
          rowAction={
            signedIn
              ? (suggestion) => (
                  <SaveRowButton
                    onPress={() => {
                      void (async () => {
                        let result: Location;
                        try {
                          result = await placesAdapter.retrieve(suggestion.id);
                        } catch {
                          result = locationFromFixture(suggestion.address) ?? {
                            address: suggestion.address,
                          };
                        }
                        surfaces.perform("openDetails");
                        setPlaceToSave(result);
                      })();
                    }}
                  />
                )
              : undefined
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
        onTip={setTipCents}
        onAddStop={
          status.state === "active" &&
          showDriver &&
          !courier &&
          !help &&
          !shop
            ? () => {
                const added = addStop({
                  origin: pickup,
                  destination,
                  stops,
                });
                if (!added) return;
                setStops(added.draft.stops);
                openSearch(targetFromField(added.next));
              }
            : undefined
        }
        canAddStop={stops.length < MAX_INTERMEDIATE_STOPS}
        onShareTrip={
          showDriver
            ? () => {
                surfaces.perform("openTravelShare");
                setDetail("safety");
              }
            : undefined
        }
        shareLabel={traveling ? "Share with someone at home" : "Share trip"}
        onOpen={(kind) => setDetail(kind)}
        onCancel={
          cancellable
            ? () => {
                setCancelError(null);
                surfaces.perform("interruptCancel");
                setCancelStage("confirm");
              }
            : undefined
        }
        cancelLabel={`Cancel ${help ? "visit" : courier ? "delivery" : "ride"}`}
      />

      {/* Filing an address is a question *about* the task, so it suspends the
          scene underneath and hands it back untouched. It never books. */}
      <SavePlaceSurface
        open={placeToSave !== null}
        location={placeToSave}
        onClose={() => closeInterrupt(() => setPlaceToSave(null))}
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
  "overlay",
] as const;
type SheetPresentation = (typeof SHEET_PRESENTATIONS)[number];

function sheetPresentation(value: string | null): SheetPresentation {
  return SHEET_PRESENTATIONS.find((entry) => entry === value) ?? "sheet";
}
