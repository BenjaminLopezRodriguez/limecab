"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Analytics01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Call02Icon,
  GpsSignal01Icon,
  Home01Icon,
  ArrowExpand01Icon,
  Coffee01Icon,
  Loading03Icon,
  Shield01Icon,
} from "@hugeicons/core-free-icons";

import { useAdaptiveSurface } from "@/components/service-app/adaptive-surface";
import { AdaptiveSurface } from "@/components/service-app/adaptive-surface";
import { LocationPinScene } from "@/components/service-app/location-pin-scene";
import { LocationSearchScene } from "@/components/service-app/location-search-scene";
import { createMapboxAdapter } from "@/components/service-app/mapbox-adapter";
import { ServiceAppShell } from "@/components/service-app/service-app-shell";
import { ServiceMap } from "@/components/service-app/service-map";
import {
  ServiceSheet,
  SHEET_EXPANDED_SNAP,
  SHEET_OVERLAY_SNAP,
} from "@/components/service-app/service-sheet";
import { ConfirmActionSurface } from "@/components/service-app/confirm-action-surface";
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
  DriverHuntingPeek,
  DriverJobScene,
  DriverOfferScene,
  DriverOfflineHeadline,
  DriverOfflineHome,
  DriverPickupPinScene,
  DriverRecommendedScene,
  DriverTrendsScene,
  MapControl,
  RestStopScene,
  type JobTrip,
  type OfferTrip,
  type RestStop,
  type TrendCell,
} from "@/components/limecab/driver-scenes";
import {
  DRIVER_TAB_HEIGHT,
  DriverTabBar,
} from "@/components/limecab/driver-tabs";
import { TripChatThread } from "@/components/limecab/trip-chat-thread";
import {
  DriverSafetyToolkit,
  useDashcam,
  type Dashcam,
} from "@/components/limecab/driver-safety-toolkit";
import {
  DRIVER_MAP_MODE,
  DRIVER_SCENE_SURFACES,
  driverSurfaces,
  type DriverSurfaceAction,
  type DriverSurfaceId,
} from "@/components/limecab/driver-surfaces";
import { isCourierProduct } from "@/lib/limecab/courier";
import { isHelpProduct } from "@/lib/limecab/help";
import {
  currentJob,
  driverAppQuestion,
  driverJobKind,
  driverSceneForTripStatus,
  type DriverAppState,
  isDriving,
  reduceDriverAppState,
  type DriverAppEvent,
} from "@/lib/limecab/driver-state";
import { ridePinBlocksStart } from "@/lib/limecab/pickup-pin";
import { cellCenter, cellPolygon, toDriverCell } from "@/lib/limecab/h3";
import {
  createPlacesAdapter,
  fetchNearbyRestStops,
  setSearchProximity,
} from "@/lib/limecab/places";
import {
  fetchDrivingRoute,
  fetchReverseGeocode,
} from "@/lib/service-app/directions";
import type { MapPoint } from "@/lib/service-app/map-adapter";
import { formatMoney, splitAddress } from "@/lib/service-app/services";
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

/** Questions *about* the duty session, not scenes. Pin is a phase of the
 *  heading question, so it lives here rather than as an extra boolean. */
type DriverAside = "heading" | "heading_pin" | "safety" | "chat" | null;

const placesAdapter = createPlacesAdapter();

/** How long a driver gets to decide. The countdown *is* the decline. */
const OFFER_SECONDS = 20;

/** While hunting, a four-second list refresh is a missed ride. */
const HUNTING_MS = 3_000;
const RESTING_MS = 4_000;

/** The fare stays up for a beat, then the driver is back in the hunt. */
const FARE_SPLASH_MS = 2_600;

const mapAdapter = env.NEXT_PUBLIC_MAPBOX_TOKEN
  ? createMapboxAdapter(env.NEXT_PUBLIC_MAPBOX_TOKEN)
  : undefined;

/** Camera only until geolocation answers — never a submitted address. */
const FALLBACK_POINT: MapPoint = {
  latitude: 34.05,
  longitude: -118.25,
};

/** How often a driver on duty reports where they are. Matches the resting inbox. */
const PING_MS = 4_000;

/** The demand lattice is per-cell, so panning inside one cell is not a refetch. */
const DEMAND_MS = 15_000;

export function DriverApp({
  driverInitial,
  initialScene,
}: {
  driverInitial: string;
  initialScene: DriverAppState;
}) {
  return (
    <SurfaceManagerProvider manager={driverSurfaces}>
      <DriverFlow driverInitial={driverInitial} initialScene={initialScene} />
    </SurfaceManagerProvider>
  );
}

function DriverFlow({
  driverInitial,
  initialScene,
}: {
  driverInitial: string;
  initialScene: DriverAppState;
}) {
  const surfaces = useSurfaceManager<DriverSurfaceId, DriverSurfaceAction>();
  const router = useRouter();
  /**
   * `surfaces` is a new object on every layout change — depending on it inside
   * an effect makes that effect fire on every surface move. Effects take the
   * two stable dispatchers instead.
   */
  const { perform, apply } = surfaces;

  const [scene, setScene] = useState<DriverAppState>(initialScene);
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
  const [aside, setAside] = useState<DriverAside>(null);
  const asideRef = useRef(aside);
  asideRef.current = aside;
  /**
   * Which idle panel is up. App data about the map, deliberately not a
   * scene: reading a chart is not a duty change. Whether the off-duty map is
   * opened out needs no state at all — the primary surface's own rung says so.
   */
  const [panel, setPanel] = useState<"recommended" | "trends" | null>(null);
  const panelRef = useRef(panel);
  panelRef.current = panel;
  const [trendDay, setTrendDay] = useState(() => new Date().getDay());
  /** A cell the driver asked to look at, and the nonce that re-frames on it. */
  const [focus, setFocus] = useState<MapPoint | null>(null);
  const [recenterAt, setRecenterAt] = useState(0);
  /** Where the camera is, rounded to its cell: panning is not a refetch. */
  const [camera, setCamera] = useState<MapPoint | null>(null);
  /** The point under the heading pin. App data for the map, not a scene. */
  const [pin, setPin] = useState<MapPoint | null>(null);
  const [pinAddress, setPinAddress] = useState<string | null>(null);
  const [pinLocating, setPinLocating] = useState(false);
  /** Rest stops on the heading pin. `null` is hidden; an array is showing. */
  const [restStops, setRestStops] = useState<RestStop[] | null>(null);
  const [restStopsLoading, setRestStopsLoading] = useState(false);
  /** Inspecting a stop is local sheet content, not a pin move. */
  const [selectedRestStop, setSelectedRestStop] = useState<RestStop | null>(
    null,
  );
  const restAbort = useRef<AbortController | null>(null);
  const dashcam = useDashcam();

  const hunting = scene !== "offline" && scene !== "complete";
  const inbox = api.driver.inbox.useQuery(undefined, {
    refetchInterval: hunting ? HUNTING_MS : RESTING_MS,
  });

  const available = inbox.data?.driver?.available ?? false;
  const todayCents = inbox.data?.todayCents ?? 0;
  const headingAddress = inbox.data?.driver?.headingAddress ?? null;
  const open = useMemo(() => inbox.data?.open ?? [], [inbox.data?.open]);
  const liveJobs = useMemo(
    () => inbox.data?.active ?? [],
    [inbox.data?.active],
  );
  const [focusTripId, setFocusTripId] = useState<string | null>(null);
  const active =
    liveJobs.find((trip) => trip.id === focusTripId) ??
    currentJob(liveJobs) ??
    null;
  const queuedJobs = liveJobs.filter((trip) => trip.id !== active?.id);
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

  // The scene says which question; the recipe says how the surfaces sit. A
  // scene *change* ends every idle panel — there is nothing to return to — but
  // the first run must not, or it would close a panel opened on the same tick.
  const lastScene = useRef(scene);
  useLayoutEffect(() => {
    if (lastScene.current !== scene) {
      setPanel(null);
      setFocus(null);
    }
    lastScene.current = scene;
    apply("progress", DRIVER_SCENE_SURFACES[scene]);
  }, [apply, scene]);

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

  /**
   * The fix, reported. Until this existed a driver in Santa Monica was offered
   * a pickup in Pasadena — the app held `device` and never sent it.
   *
   * Fail-soft on purpose: a rejected ping is not a duty event, so it never
   * touches the progress lock and never blocks GO. Off duty nobody is asking
   * where this driver is, so nothing is sent.
   */
  const pingLocation = api.driver.pingLocation.useMutation();
  const ping = useRef(pingLocation.mutate);
  ping.current = pingLocation.mutate;
  // The latest fix by reference, so a moving car does not restart the timer on
  // every GPS tick — the cadence is the interval, not the sensor.
  const lastFix = useRef<MapPoint | null>(device);
  lastFix.current = device;
  const onDuty = scene !== "offline" && scene !== "complete";
  useEffect(() => {
    if (!onDuty) return;
    const send = () => {
      const fix = lastFix.current;
      if (!fix) return;
      ping.current(
        { latitude: fix.latitude, longitude: fix.longitude },
        { onError: () => undefined },
      );
    };
    send();
    const id = window.setInterval(send, PING_MS);
    return () => window.clearInterval(id);
  }, [onDuty]);

  const offer = useMemo(
    () => open.find((trip) => trip.id === offeredId) ?? null,
    [offeredId, open],
  );

  /**
   * Open rides as a stack. Inbox already ranked them — Pool detour when the
   * current job is Pool, nearest deadhead otherwise. The driver can bring any
   * card forward. Accepting one does not stop the rest from landing.
   */
  const candidate = useMemo(() => {
    if (!hunting || !available) return [];
    return open.filter((trip) => !declined.includes(trip.id));
  }, [available, declined, hunting, open]);

  const candidateIds = candidate.map((trip) => trip.id).join(",");
  useEffect(() => {
    if (!hunting || !available) {
      if (offeredId) setOfferedId(null);
      return;
    }
    const stillUp = offeredId
      ? candidate.some((trip) => trip.id === offeredId)
      : false;
    const nextId = stillUp ? offeredId : (candidate[0]?.id ?? null);
    if (nextId === offeredId) return;
    if (panelRef.current) {
      setPanel(null);
      perform(
        panelRef.current === "trends" ? "closeTrends" : "closeRecommended",
      );
    }
    setOfferedId(nextId);
    if (nextId) {
      perform("offerIncoming");
      alertDriver();
    } else {
      perform("offerDismissed");
    }
    // candidateIds is the queue membership; offeredId is the front.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, candidateIds, hunting, offeredId, perform]);

  /** The ride is the driver's now — it is not declined, it is theirs. */
  const clearOffer = useCallback(() => setOfferedId(null), []);

  const dismissOffer = useCallback(
    (tripId: string) => {
      setDeclined((current) =>
        current.includes(tripId) ? current : [...current, tripId],
      );
      setOfferedId(null);
      perform("offerDismissed");
    },
    [perform],
  );

  /* ---- what the canvas is showing ------------------------------------- */

  const job: JobTrip | null = useMemo(() => {
    if (scene === "complete") return finished;
    return active ? toJobTrip(active) : null;
  }, [active, finished, scene]);

  /** The point the driver is currently driving to. */
  const target = useMemo<MapPoint | null>(() => {
    const trip = active ?? offer;
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
      label: splitAddress(
        toDestination ? trip.destinationAddress : trip.pickupAddress,
      ).line,
    };
  }, [active, offer, scene]);

  /**
   * One route request per leg, not per GPS tick: the geometry is drawn from
   * where the leg started. This build has no turn-by-turn and does not
   * pretend to — `Open in Maps` is the honest escape hatch.
   */
  const legKey = target
    ? `${active?.id ?? offer?.id ?? ""}:${target.kind}`
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

  const pinning = aside === "heading_pin";
  /**
   * The location lattice.
   *
   * How a driver reads the marketplace they are standing in: every cell in
   * view, filled by how busy it has actually been — open requests standing in
   * it plus trips that started there this week. That is occupancy, not price.
   * There is no scale here, no multiplier, and nothing to bid against.
   *
   * The camera is rounded to its own cell before it becomes a query key, so
   * a car crossing a car park does not refetch the grid. The heading pin uses
   * the same lattice so dropping a pin is a choice *toward* activity, not a
   * blank map.
   */
  const demandAnchor = pinning
    ? (pin ?? device ?? FALLBACK_POINT)
    : (camera ?? device ?? FALLBACK_POINT);
  const anchorCell = toDriverCell(
    demandAnchor.latitude,
    demandAnchor.longitude,
  );
  const idleMap = (surfaces.layout.map?.presentation ?? "idle") === "idle";
  const showDemand = !offer && (idleMap || pinning);
  const demand = api.driver.demand.useQuery(cellCenter(anchorCell), {
    enabled: showDemand,
    refetchInterval: DEMAND_MS,
  });

  const selfCell = device
    ? toDriverCell(device.latitude, device.longitude)
    : null;
  const pinCell =
    pinning && pin ? toDriverCell(pin.latitude, pin.longitude) : null;
  // Names: trends aside, and the heading pin — hot cells only, so the lattice
  // stays a lattice and the busy places read as places.
  const named = panel === "trends";
  const coverage = useMemo<GeoJSON.FeatureCollection | undefined>(() => {
    if (!showDemand) return undefined;
    const cells = demand.data;
    if (!cells?.length) return undefined;
    return {
      type: "FeatureCollection",
      features: cells.map((cell) => {
        const hot = cell.openCount > 0 || cell.weekCount >= 2;
        const here = cell.h3 === selfCell;
        return {
          type: "Feature" as const,
          id: cell.h3,
          properties: {
            weight: cell.openCount + cell.weekCount,
            ...(here
              ? { emphasis: "self" }
              : hot && pinning
                ? { emphasis: "hot" }
                : {}),
            ...(named && cell.label && cell.weekCount >= 1
              ? { label: cell.label }
              : pinning && hot && cell.label
                ? { label: cell.label }
                : {}),
          },
          geometry: cellPolygon(cell.h3),
        };
      }),
    };
  }, [demand.data, named, pinning, showDemand, selfCell]);

  const pinActivity = useMemo(() => {
    if (!pinning || !pinCell || !demand.data) return null;
    const cell = demand.data.find((entry) => entry.h3 === pinCell);
    if (!cell) return null;
    if (cell.openCount >= 1 && cell.weekCount >= 1) {
      return `${cell.openCount} waiting nearby · ${cell.weekCount} trips this week`;
    }
    if (cell.openCount >= 1) {
      return cell.openCount === 1
        ? "1 request waiting nearby"
        : `${cell.openCount} requests waiting nearby`;
    }
    if (cell.weekCount >= 2) {
      return `${cell.weekCount} trips started here this week`;
    }
    return null;
  }, [demand.data, pinCell, pinning]);

  /** The locality the driver is standing in, if their pickups have named it. */
  const areaLabel =
    demand.data?.find((cell) => cell.h3 === selfCell)?.label ?? null;

  /** The driver's own history, loaded only when they ask to read it. */
  const trends = api.driver.trends.useQuery(
    device ? { latitude: device.latitude, longitude: device.longitude } : null,
    { enabled: panel === "trends" },
  );
  const trendCells = trends.data?.cells ?? [];

  const jobChip = job ?? offer;

  const openAside = useCallback(
    (kind: "heading" | "safety" | "chat") => {
      // The offer already owns the interrupt rung; 911 on the map still works.
      if (kind === "safety" && offeredId) return;
      if (kind === "heading") setSearchProximity(device);
      if (asideRef.current === null) {
        perform(
          kind === "safety"
            ? "openSafety"
            : kind === "chat"
              ? "openTripChat"
              : "openHeading",
        );
      }
      setAside(kind);
    },
    [device, offeredId, perform],
  );

  const hideRestStops = useCallback(() => {
    restAbort.current?.abort();
    restAbort.current = null;
    setRestStops(null);
    setRestStopsLoading(false);
    setSelectedRestStop(null);
  }, []);

  useEffect(() => () => restAbort.current?.abort(), []);

  const closeAside = useCallback(() => {
    if (asideRef.current === null) return;
    setAside(null);
    setPin(null);
    setPinAddress(null);
    hideRestStops();
    perform("closeAside");
  }, [hideRestStops, perform]);

  const chooseHeadingOnMap = useCallback(() => {
    const seed = device ?? FALLBACK_POINT;
    asideRef.current = "heading_pin";
    setPin(seed);
    setPinAddress(null);
    setPinLocating(true);
    setRecenterAt(Date.now());
    setAside("heading_pin");
    perform("chooseHeadingOnMap");
  }, [device, perform]);

  const backFromHeadingPin = useCallback(() => {
    asideRef.current = "heading";
    setPin(null);
    setPinAddress(null);
    hideRestStops();
    setAside("heading");
    perform("closeHeadingPin");
  }, [hideRestStops, perform]);

  useEffect(() => {
    if (!pinning || !pin) return;
    let cancelled = false;
    setPinLocating(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const resolved = await fetchReverseGeocode(
            pin.latitude,
            pin.longitude,
          ).catch(() => placesAdapter.reverse?.(pin.latitude, pin.longitude));
          if (!cancelled) {
            setPinAddress(resolved?.address ?? "Pinned location");
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

  const restStopPoints = useMemo<MapPoint[]>(
    () =>
      (restStops ?? []).flatMap((stop) => {
        if (stop.latitude === undefined || stop.longitude === undefined) {
          return [];
        }
        return [
          {
            latitude: stop.latitude,
            longitude: stop.longitude,
            kind: "poi" as const,
            label: stop.shortName ?? splitAddress(stop.address).line,
            selected: stop === selectedRestStop,
            category: stop.category,
          },
        ];
      }),
    [restStops, selectedRestStop],
  );

  const restStopsOn = restStops !== null || restStopsLoading;

  const toggleRestStops = useCallback(() => {
    if (restStopsOn) {
      hideRestStops();
      return;
    }
    const origin = pin ?? device ?? FALLBACK_POINT;
    const ac = new AbortController();
    restAbort.current = ac;
    setRestStopsLoading(true);
    void fetchNearbyRestStops(
      {
        address: pinAddress ?? "Current location",
        latitude: origin.latitude,
        longitude: origin.longitude,
      },
      ac.signal,
    )
      .then((stops) => {
        if (!ac.signal.aborted) setRestStops(stops);
      })
      .catch(() => {
        if (!ac.signal.aborted) setRestStops([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setRestStopsLoading(false);
      });
  }, [device, hideRestStops, pin, pinAddress, restStopsOn]);

  const chooseRestStop = useCallback(
    (point: MapPoint) => {
      const stop = restStops?.find(
        (place) =>
          place.latitude === point.latitude &&
          place.longitude === point.longitude,
      );
      if (!stop) return;
      setSelectedRestStop(stop);
    },
    [restStops],
  );

  /**
   * The idle panels. Every one of these is a single named action: nothing in
   * this file sets a drawer, a map posture, and a layout by hand and then
   * guesses at the order.
   */
  const expandIdleMap = useCallback(() => {
    perform("expandIdleMap");
  }, [perform]);

  const collapseIdleMap = useCallback(() => {
    setFocus(null);
    setCamera(null);
    setRecenterAt(Date.now());
    perform("collapseIdleMap");
  }, [perform]);

  const openRecommended = useCallback(() => {
    setPanel("recommended");
    perform("openRecommended");
  }, [perform]);

  const closeRecommended = useCallback(() => {
    setPanel(null);
    perform("closeRecommended");
  }, [perform]);

  const openTrends = useCallback(() => {
    // From Recommended, trends replaces it rather than stacking on it.
    if (panelRef.current === "recommended") perform("closeRecommended");
    setPanel("trends");
    perform("openTrends");
  }, [perform]);

  const closeTrends = useCallback(() => {
    setPanel(null);
    setFocus(null);
    perform("closeTrends");
  }, [perform]);

  /**
   * Trends read as a map, or as a list. Overlay is the list — a swipe to the
   * top snap, or "See charts", is the same action.
   */
  const chartsOpen =
    panel === "trends" && surfaces.layout.primary?.presentation === "overlay";
  const seeCharts = useCallback(() => {
    perform(chartsOpen ? "closeTrendCharts" : "openTrendCharts");
  }, [chartsOpen, perform]);

  const finishFare = useCallback(() => {
    setFinished(null);
    const next = currentJob(liveJobs);
    if (next) {
      setFocusTripId(next.id);
      const nextScene = driverSceneForTripStatus(next.status);
      if (nextScene) {
        setScene(nextScene);
        return;
      }
    }
    go("done");
    perform("resumeIdle");
  }, [go, liveJobs, perform]);

  /**
   * Coming back to the idle canvas re-frames it. An offer and a job hand the
   * camera to the follow-cam at street zoom; without this the driver lands
   * back on the hunting map staring at the inside of one cell.
   */
  useEffect(() => {
    if (mapPosture === "idle") setRecenterAt(Date.now());
  }, [mapPosture]);

  const recenter = useCallback(() => {
    setFocus(null);
    setCamera(null);
    setRecenterAt(Date.now());
  }, []);

  const focusCell = useCallback((cell: TrendCell) => {
    setFocus({ latitude: cell.latitude, longitude: cell.longitude });
    setRecenterAt(Date.now());
  }, []);

  /**
   * The Trends *tab* is a deep link, not a route: `/driver?trends=1` from the
   * account pages lands on the duty map with the aside already up.
   */
  // Read once, at mount: the query is cleaned off the URL immediately, so the
  // request has to outlive it.
  const trendsAsked = useRef(
    typeof window === "undefined"
      ? false
      : new URLSearchParams(window.location.search).has("trends"),
  );
  useEffect(() => {
    if (!trendsAsked.current) return;
    window.history.replaceState(null, "", "/driver");
    openTrends();
  }, [openTrends]);

  /**
   * Off duty the driver is in a *home*: a page with a live map card in it.
   * On duty the map is the app. That is the only layout switch in this file,
   * and the same Mapbox instance survives it — going online must not blink.
   */
  const homeLayout = surfaces.layout.primary?.presentation === "launcher";
  const driving = isDriving(scene) || scene === "complete";
  const trendsUp = panel === "trends";
  const preferences = "/driver/profile/preferences";

  return (
    <div
      style={
        {
          // The tab bar is chrome under the shell, and only off duty: a dash
          // does not get one.
          "--service-app-chrome": homeLayout ? DRIVER_TAB_HEIGHT : "0rem",
          "--nav-pill-clear": "1.5rem",
        } as React.CSSProperties
      }
    >
      <ServiceAppShell
        layout={homeLayout ? "home" : "task"}
        mapPressLabel="Open the map"
        onMapPress={expandIdleMap}
        header={
          homeLayout ? (
            <DriverOfflineHeadline
              onOpenSafety={() => openAside("safety")}
              onOpenPreferences={() => router.push(preferences)}
            />
          ) : undefined
        }
        map={
          <ManagedSurface<DriverSurfaceId> id="map">
            <div className="relative size-full">
              <ServiceMap
                adapter={mapAdapter}
                mode={DRIVER_MAP_MODE[mapPosture] ?? "home"}
                center={
                  pinning
                    ? (pin ?? driverPoint)
                    : (focus ??
                      (scene === "complete"
                        ? (target ?? driverPoint)
                        : driverPoint))
                }
                interactive={surfaces.layout.map?.interaction === "active"}
                // A res-8 cell is ~460 m across: at the shared home zoom one
                // hex fills a phone and the lattice stops being a lattice.
                zoom={idleMap && !pinning ? 12.5 : undefined}
                recenterAt={recenterAt}
                onCameraChange={pinning ? setPin : setCamera}
                onSelectPoint={pinning ? chooseRestStop : undefined}
                points={pinning ? restStopPoints : points}
                route={pinning ? undefined : (route ?? undefined)}
                coverage={showDemand ? coverage : undefined}
                pinLabel={
                  pinning
                    ? pinAddress
                      ? splitAddress(pinAddress).line
                      : null
                    : undefined
                }
                pinLocating={pinning && pinLocating}
              />

              {/* Canvas controls. Which ones exist is the posture, not a pile
                  of booleans: a job keeps the chrome it always had, and the
                  idle canvas gets the controls that belong to looking. */}
              {pinning ? (
                <div className="pointer-events-none absolute inset-x-3 bottom-[calc(var(--sheet-snap,0)*100dvh_+_0.75rem)] z-10 flex items-end justify-end">
                  <MapControl
                    label={
                      restStopsLoading
                        ? "Looking for rest stops"
                        : restStopsOn
                          ? "Hide nearby rest stops"
                          : "Show nearby rest stops"
                    }
                    busy={restStopsLoading}
                    onPress={toggleRestStops}
                    className={
                      restStopsOn
                        ? "bg-lime pointer-events-auto"
                        : "pointer-events-auto"
                    }
                  >
                    <Icon
                      icon={restStopsLoading ? Loading03Icon : Coffee01Icon}
                      size={20}
                      className={
                        restStopsLoading
                          ? "motion-safe:animate-spin"
                          : undefined
                      }
                      aria-hidden="true"
                    />
                  </MapControl>
                </div>
              ) : driving || offer ? (
                <>
                  <div className="absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex items-start justify-between gap-3">
                    <Link
                      href="/driver/profile"
                      aria-label="Your profile"
                      className="bg-card ring-border focus-visible:ring-ring flex size-11 items-center justify-center rounded-full text-[17px] font-semibold tracking-tight shadow-[0_4px_16px_rgba(26,24,20,0.12)] ring-1 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {driverInitial}
                    </Link>
                    <div className="flex gap-2">
                      <SafetyControl
                        recording={dashcam.recording}
                        onPress={() => openAside("safety")}
                      />
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
                      {/* A visit stays at one address; an arrow back to it
                          would read as a second leg. */}
                      {isHelpProduct(jobChip.productId) ? null : (
                        <>
                          <span className="text-muted-foreground"> → </span>
                          {splitAddress(jobChip.destinationAddress).line}
                        </>
                      )}
                    </p>
                  ) : null}
                </>
              ) : homeLayout ? (
                // Inside the card, so it reads as "open this map" and not as
                // a control over the page.
                <MapControl
                  label="Open the map"
                  onPress={expandIdleMap}
                  className="absolute top-3 right-3 z-10"
                >
                  <Icon icon={ArrowExpand01Icon} size={18} aria-hidden="true" />
                </MapControl>
              ) : (
                <>
                  <div className="absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex items-start justify-between gap-3">
                    {trendsUp ? (
                      <MapControl label="Back" onPress={closeTrends}>
                        <Icon
                          icon={ArrowLeft01Icon}
                          size={20}
                          aria-hidden="true"
                        />
                      </MapControl>
                    ) : scene === "offline" ? (
                      // Off duty and looking around: the house is the way back
                      // to the page. It is not a duty control.
                      <MapControl
                        label="Back to home"
                        onPress={collapseIdleMap}
                      >
                        <Icon icon={Home01Icon} size={20} aria-hidden="true" />
                      </MapControl>
                    ) : (
                      <MapControl label="Recenter the map" onPress={recenter}>
                        <Icon icon={Home01Icon} size={20} aria-hidden="true" />
                      </MapControl>
                    )}

                    {/* The number a driver optimises for, on every idle frame. */}
                    {scene === "online" && !trendsUp ? (
                      <Link
                        href="/driver/profile/earnings"
                        className="bg-foreground text-background focus-visible:ring-ring flex h-11 items-center gap-1.5 rounded-full px-4 text-[19px] font-semibold tracking-[-0.02em] tabular-nums shadow-[0_4px_16px_rgba(26,24,20,0.2)] focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <span className="text-lime">
                          {formatMoney(todayCents)}
                        </span>
                        <Icon
                          icon={ArrowRight01Icon}
                          size={16}
                          aria-hidden="true"
                        />
                      </Link>
                    ) : null}

                    {trendsUp ? (
                      <button
                        type="button"
                        onClick={seeCharts}
                        className="bg-card ring-border focus-visible:ring-ring flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold tracking-tight shadow-[0_4px_16px_rgba(26,24,20,0.12)] ring-1 focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <Icon
                          icon={Analytics01Icon}
                          size={18}
                          aria-hidden="true"
                        />
                        {chartsOpen ? "See map" : "See charts"}
                      </button>
                    ) : (
                      <span aria-hidden="true" />
                    )}
                  </div>

                  {/* Above whatever rung the sheet is on: `--sheet-snap` is
                      the fraction the sheet publishes, so these ride up with
                      it instead of hiding behind it. */}
                  <div className="pointer-events-none absolute inset-x-3 bottom-[calc(var(--sheet-snap,0)*100dvh_+_0.75rem)] z-10 flex items-end justify-between gap-3">
                    {scene === "online" && !trendsUp ? (
                      <SafetyControl
                        recording={dashcam.recording}
                        onPress={() => openAside("safety")}
                        className="pointer-events-auto"
                      />
                    ) : (
                      <span aria-hidden="true" />
                    )}
                    {trendsUp ? (
                      <MapControl
                        label="Recenter the map"
                        onPress={recenter}
                        className="pointer-events-auto"
                      >
                        <Icon
                          icon={GpsSignal01Icon}
                          size={20}
                          aria-hidden="true"
                        />
                      </MapControl>
                    ) : scene === "online" ? (
                      <MapControl
                        label="Earnings trends"
                        onPress={openTrends}
                        className="pointer-events-auto"
                      >
                        <Icon
                          icon={Analytics01Icon}
                          size={20}
                          aria-hidden="true"
                        />
                      </MapControl>
                    ) : (
                      <span aria-hidden="true" />
                    )}
                  </div>
                </>
              )}
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
          areaLabel={areaLabel}
          headingAddress={headingAddress}
          loading={!inbox.data}
          aside={aside}
          panel={panel}
          trendCells={trendCells}
          trendDay={trendDay}
          onTrendDay={setTrendDay}
          chartsOpen={chartsOpen}
          onSeeCharts={seeCharts}
          onFocusCell={focusCell}
          dashcam={dashcam}
          onOpenChat={() => openAside("chat")}
          onOpenHeading={() => openAside("heading")}
          onChooseHeadingOnMap={chooseHeadingOnMap}
          onBackFromHeadingPin={backFromHeadingPin}
          pinAddress={pinAddress}
          pinLocating={pinning && pinLocating}
          pinActivity={pinActivity}
          pin={pin}
          selectedRestStop={selectedRestStop}
          restStopsEmpty={restStops?.length === 0}
          onClearRestStop={() => setSelectedRestStop(null)}
          onCloseAside={closeAside}
          onOpenRecommended={openRecommended}
          onCloseRecommended={closeRecommended}
          onOpenTrends={openTrends}
          onOpenPreferences={() => router.push(preferences)}
          onDismissOffer={dismissOffer}
          onFocusOffer={setOfferedId}
          offerStack={candidate}
          queued={queuedJobs.map(toJobTrip)}
          onOfferTaken={clearOffer}
          onFirstAccept={setFocusTripId}
          onFinished={setFinished}
          onResumed={finishFare}
          refresh={inbox.refetch}
        />
      </ServiceAppShell>

      {homeLayout ? <DriverTabBar active="home" onTrends={openTrends} /> : null}
    </div>
  );
}

/** Shield, with the dashcam's own state on it. Same control everywhere. */
function SafetyControl({
  recording,
  onPress,
  className,
}: {
  recording: boolean;
  onPress: () => void;
  className?: string;
}) {
  return (
    <MapControl
      label={recording ? "Safety toolkit, dashcam recording" : "Safety toolkit"}
      onPress={onPress}
      className={className}
    >
      <Icon icon={Shield01Icon} size={20} aria-hidden="true" />
      {recording ? (
        <span
          className="bg-destructive absolute top-1 right-1 size-2.5 rounded-full motion-safe:animate-pulse"
          aria-hidden="true"
        />
      ) : null}
    </MapControl>
  );
}

/* ------------------------------------------------------------- surfaces */

function DriverSurfaces({
  scene,
  go,
  offer,
  job,
  todayCents,
  areaLabel,
  headingAddress,
  loading,
  aside,
  panel,
  trendCells,
  trendDay,
  onTrendDay,
  chartsOpen,
  onSeeCharts,
  onFocusCell,
  dashcam,
  onOpenChat,
  onOpenHeading,
  onChooseHeadingOnMap,
  onBackFromHeadingPin,
  pinAddress,
  pinLocating,
  pinActivity,
  pin,
  selectedRestStop,
  restStopsEmpty,
  onClearRestStop,
  onCloseAside,
  onOpenRecommended,
  onCloseRecommended,
  onOpenTrends,
  onOpenPreferences,
  onDismissOffer,
  onFocusOffer,
  offerStack,
  queued,
  onOfferTaken,
  onFirstAccept,
  onFinished,
  onResumed,
  refresh,
}: {
  scene: DriverAppState;
  go: (event: DriverAppEvent) => void;
  offer: OfferTrip | null;
  job: JobTrip | null;
  todayCents: number;
  areaLabel: string | null;
  headingAddress: string | null;
  loading: boolean;
  aside: DriverAside;
  panel: "recommended" | "trends" | null;
  trendCells: TrendCell[];
  trendDay: number;
  onTrendDay: (day: number) => void;
  chartsOpen: boolean;
  onSeeCharts: () => void;
  onFocusCell: (cell: TrendCell) => void;
  dashcam: Dashcam;
  onOpenChat: () => void;
  onOpenHeading: () => void;
  onChooseHeadingOnMap: () => void;
  onBackFromHeadingPin: () => void;
  pinAddress: string | null;
  pinLocating: boolean;
  pinActivity: string | null;
  pin: MapPoint | null;
  selectedRestStop: RestStop | null;
  restStopsEmpty: boolean;
  onClearRestStop: () => void;
  onCloseAside: () => void;
  onOpenRecommended: () => void;
  onCloseRecommended: () => void;
  onOpenTrends: () => void;
  onOpenPreferences: () => void;
  onDismissOffer: (tripId: string) => void;
  onFocusOffer: (tripId: string) => void;
  offerStack: OfferTrip[];
  queued: JobTrip[];
  onOfferTaken: () => void;
  onFirstAccept: (tripId: string) => void;
  onFinished: (trip: JobTrip) => void;
  onResumed: () => void;
  refresh: () => Promise<unknown>;
}) {
  const surface = useAdaptiveSurface();
  const surfaces = useSurfaceManager<DriverSurfaceId, DriverSurfaceAction>();
  const [pickupCode, setPickupCode] = useState("");
  const [deliveryCode, setDeliveryCode] = useState("");
  const [left, setLeft] = useState(OFFER_SECONDS);
  /**
   * The last refusal, owned here rather than read off the progress machine:
   * its `error` survives until the next transition starts, and a stale
   * "no longer available" on the *next* ride's card would be a lie.
   */
  const [failure, setFailure] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  /** Interrupt, not a scene: "cancel this job?" sits over the live sheet. */
  const [cancelAsk, setCancelAsk] = useState(false);
  const cancelAskRef = useRef(false);

  const setAvailable = api.driver.setAvailable.useMutation();
  const setHeading = api.driver.setHeading.useMutation();
  // The driver's own places, loaded only when they open the question.
  const savedPlaces = api.places.list.useQuery(undefined, {
    enabled: aside === "heading",
  });
  const headingPlaces = useMemo(() => {
    const list = savedPlaces.data;
    if (!list) return [];
    return [list.home, list.work, ...list.custom].flatMap((place) =>
      place ? [place] : [],
    );
  }, [savedPlaces.data]);

  const chooseHeading = (place: {
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  }) => {
    setSearchError(null);
    setHeading.mutate(place, {
      onSettled: () => {
        void refresh();
        onCloseAside();
      },
    });
  };
  const accept = api.driver.accept.useMutation();
  const advance = api.driver.advance.useMutation();

  // Job kind, derived from the row: a courier trip carrying a list is Shop.
  // The duty machine does not grow a member for either.
  const kind = driverJobKind(job);
  const courier = kind === "courier" || kind === "shop";
  const shop = kind === "shop";
  const helpJob = kind === "help";

  /* ---- duty ------------------------------------------------------------ */

  const setDuty = (next: boolean) => {
    if (surface.progress.locked) return;
    setFailure(null);
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
        () => {
          surfaces.perform(next ? "goOnline" : "goOffline");
          go(next ? "go_online" : "go_offline");
        },
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
    const queueing = isDriving(scene);
    setFailure(null);
    const take = async () => {
      await accept.mutateAsync({ tripId });
      await refresh();
    };
    const succeed = () => {
      onOfferTaken();
      if (queueing) return;
      onFirstAccept(tripId);
      surfaces.perform("accepted");
      go("accepted");
    };
    const fail = (reason: unknown) => {
      setFailure(errorMessage(reason));
      onDismissOffer(tripId);
    };
    if (queueing) {
      void take().then(succeed, fail);
      return;
    }
    void surface
      .transition({
        intent: "progress",
        from: "online",
        to: "to_pickup",
        interim: "map",
        task: take,
      })
      .then(succeed, fail);
  };

  /* ---- the job --------------------------------------------------------- */

  const action = advanceActionFor(scene);

  const runAdvance = () => {
    if (!job || !action || surface.progress.locked) return;
    // PIN is a question *about* starting, not a hint on the way to the curb.
    if (
      action === "start" &&
      ridePinBlocksStart(scene, job.pinRequired) &&
      surfaces.layout.primary?.presentation !== "overlay"
    ) {
      setFailure(null);
      surfaces.perform("openPickupPin");
      return;
    }
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
            ...((shop || helpJob ? false : courier || job.pinRequired) &&
            action === "start"
              ? { pickupCode }
              : {}),
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
    onResumed();
  }, [onResumed]);

  const jobNoun = helpJob ? "visit" : courier ? "delivery" : "ride";

  const askCancelJob = () => {
    if (!job || scene === "on_trip" || surface.progress.locked) return;
    setFailure(null);
    cancelAskRef.current = true;
    surfaces.perform("askCancelJob");
    setCancelAsk(true);
  };

  const dismissCancelJob = () => {
    if (!cancelAskRef.current) return;
    cancelAskRef.current = false;
    setCancelAsk(false);
    surfaces.perform("dismissCancelJob");
  };

  const confirmCancelJob = async () => {
    if (!job || surface.progress.locked) return;
    const tripId = job.id;
    const keepQueue = queued.length > 0;
    await advance.mutateAsync({ tripId, action: "cancel" });
    await refresh();
    cancelAskRef.current = false;
    setCancelAsk(false);
    if (keepQueue) {
      surfaces.perform("dismissCancelJob");
      return;
    }
    surfaces.perform("jobReleased");
    go("released");
  };

  useEffect(() => {
    if (!cancelAsk) return;
    if (scene === "to_pickup" || scene === "at_pickup") return;
    cancelAskRef.current = false;
    setCancelAsk(false);
  }, [cancelAsk, scene]);

  useEffect(() => {
    if (scene !== "complete") return;
    const id = window.setTimeout(resumeIdle, FARE_SPLASH_MS);
    return () => window.clearTimeout(id);
  }, [resumeIdle, scene]);

  // Mid-transition the sheet shows the scene the choreography is on, not the
  // one the app has already moved to.
  const visible =
    surface.progress.phase === "idle"
      ? scene
      : ((surface.progress.content as DriverAppState | null) ?? scene);
  const question = driverAppQuestion(visible, kind);

  /**
   * The rung the primary surface is on. It comes from the layout, not from a
   * local boolean — "launcher" is the off-duty page, `null` is the opened-out
   * idle map with no sheet over it at all.
   */
  const posture = (() => {
    const state = surfaces.layout.primary;
    if (!state || state.emphasis === "hidden") return null;
    const value = state.presentation;
    return value === "launcher" ||
      value === "peek" ||
      value === "sheet" ||
      value === "expanded" ||
      value === "overlay"
      ? value
      : "sheet";
  })();

  const pinOverlay =
    scene === "at_pickup" && posture === "overlay" && Boolean(job?.pinRequired);

  return (
    <>
      <div className="sr-only" aria-live="polite">
        {pinOverlay
          ? "Ask the rider for their security PIN. Start ride."
          : `${question.question} ${question.action}.`}
      </div>

      <ManagedSurface<DriverSurfaceId> id="primary">
        {/* Off duty there is no drawer at all: the page *is* the surface.
            On duty the same content ladder runs peek → expanded. */}
        {posture === "launcher" ? (
          loading ? (
            <SurfaceSkeleton lines={2} />
          ) : (
            <DriverOfflineHome
              areaLabel={areaLabel}
              busy={surface.progress.locked}
              error={failure}
              onGoOnline={() => setDuty(true)}
              onOpenTrends={onOpenTrends}
            />
          )
        ) : posture === null ? null : (
          <ServiceSheet
            label={
              aside === "heading_pin"
                ? "Heading"
                : pinOverlay
                  ? "Security PIN"
                  : panel === "trends"
                    ? "Earnings trends"
                    : panel === "recommended"
                      ? "Recommended for you"
                      : "Your duty session"
            }
            presentation={posture}
            overlaySnap={
              panel === "trends" || panel === "recommended" || pinOverlay
            }
            onSnapChange={
              pinOverlay
                ? (snap) => {
                    if (snap < SHEET_OVERLAY_SNAP) {
                      surfaces.perform("closePickupPin");
                    }
                  }
                : panel === "trends" || panel === "recommended"
                  ? (snap) => {
                      const overlay =
                        surfaces.layout.primary?.presentation === "overlay";
                      if (snap >= SHEET_OVERLAY_SNAP) {
                        surfaces.perform(
                          panel === "trends"
                            ? "openTrendCharts"
                            : "expandRecommended",
                        );
                        return;
                      }
                      if (
                        panel === "recommended" &&
                        snap < SHEET_EXPANDED_SNAP
                      ) {
                        onCloseRecommended();
                        return;
                      }
                      if (overlay) {
                        surfaces.perform(
                          panel === "trends"
                            ? "closeTrendCharts"
                            : "collapseRecommended",
                        );
                      }
                    }
                  : undefined
            }
          >
            {loading ? <SurfaceSkeleton lines={2} /> : null}

            {!loading && aside === "heading_pin" ? (
              <>
                <Button
                  variant="ghost"
                  className="text-muted-foreground mb-2 -ml-2 h-11 justify-start px-2"
                  onClick={
                    selectedRestStop ? onClearRestStop : onBackFromHeadingPin
                  }
                >
                  Back
                </Button>
                {selectedRestStop ? (
                  <RestStopScene stop={selectedRestStop} />
                ) : (
                  <LocationPinScene
                    title="Where are you heading?"
                    address={pinAddress}
                    locating={pinLocating}
                    confirmLabel="Set heading"
                    secondary={
                      pinActivity || restStopsEmpty ? (
                        <>
                          {pinActivity ? (
                            <p className="text-muted-foreground text-sm leading-snug">
                              {pinActivity}
                            </p>
                          ) : null}
                          {restStopsEmpty ? (
                            <p className="text-muted-foreground text-sm leading-snug">
                              No rest stops nearby.
                            </p>
                          ) : null}
                        </>
                      ) : undefined
                    }
                    onConfirm={() => {
                      if (!pin || !pinAddress) return;
                      chooseHeading({
                        address: pinAddress,
                        latitude: pin.latitude,
                        longitude: pin.longitude,
                      });
                    }}
                  />
                )}
              </>
            ) : null}

            {!loading && aside !== "heading_pin" && panel === "trends" ? (
              <DriverTrendsScene
                cells={trendCells}
                day={trendDay}
                onDay={onTrendDay}
                expanded={chartsOpen}
                onSeeCharts={onSeeCharts}
                onFocusCell={onFocusCell}
                onGoOnline={() => setDuty(true)}
                offline={visible === "offline"}
                busy={surface.progress.locked}
              />
            ) : null}

            {!loading && aside !== "heading_pin" && panel === "recommended" ? (
              <DriverRecommendedScene
                busy={surface.progress.locked}
                error={failure}
                headingAddress={headingAddress}
                onClose={onCloseRecommended}
                onOpenHeading={onOpenHeading}
                onOpenTrends={onOpenTrends}
                onOpenPreferences={onOpenPreferences}
                onGoOffline={() => setDuty(false)}
              />
            ) : null}

            {!loading &&
            aside !== "heading_pin" &&
            panel === null &&
            visible === "online" ? (
              <DriverHuntingPeek
                onOpenPreferences={onOpenPreferences}
                onOpenRecommended={onOpenRecommended}
              />
            ) : null}

            {/* Nothing about a job is asserted until the server has confirmed
                one: no address, no rider, no PIN before the row exists. */}
            {!loading && aside !== "heading_pin" && isDriving(visible) ? (
              job ? (
                pinOverlay ? (
                  <DriverPickupPinScene
                    riderName={job.riderName}
                    value={pickupCode}
                    onChange={setPickupCode}
                    busy={surface.progress.locked}
                    error={failure}
                    onBack={() => surfaces.perform("closePickupPin")}
                    onConfirm={runAdvance}
                  />
                ) : (
                  <DriverJobScene
                    scene={visible as "to_pickup" | "at_pickup" | "on_trip"}
                    trip={job}
                    queued={queued}
                    kind={kind}
                    pickupCode={pickupCode}
                    onPickupCode={setPickupCode}
                    deliveryCode={deliveryCode}
                    onDeliveryCode={setDeliveryCode}
                    busy={surface.progress.locked}
                    error={failure}
                    onAdvance={runAdvance}
                    onMessage={onOpenChat}
                    onCancel={
                      visible === "to_pickup" || visible === "at_pickup"
                        ? askCancelJob
                        : undefined
                    }
                  />
                )
              ) : (
                <SurfaceSkeleton lines={3} />
              )
            ) : null}

            {!loading &&
            aside !== "heading_pin" &&
            visible === "complete" &&
            job ? (
              <DriverCompleteScene
                trip={job}
                todayCents={todayCents}
                onDone={resumeIdle}
              />
            ) : null}
          </ServiceSheet>
        )}
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
        label={
          offer && isHelpProduct(offer.productId)
            ? "Visit offer"
            : offer && isCourierProduct(offer.productId)
              ? "Delivery offer"
              : "Ride offer"
        }
      >
        {offer ? (
          <DriverOfferScene
            trip={offer}
            stack={offerStack}
            onFocus={onFocusOffer}
            secondsLeft={left}
            totalSeconds={OFFER_SECONDS}
            busy={surface.progress.locked}
            onAccept={acceptOffer}
            onDecline={() => onDismissOffer(offer.id)}
          />
        ) : null}
      </AdaptiveSurface.Interrupt>

      <ConfirmActionSurface
        open={cancelAsk}
        onOpenChange={(open) => {
          if (!open) dismissCancelJob();
        }}
        id="cancel-job"
        intent="destructive"
        title={`Cancel this ${jobNoun}?`}
        description={
          queued.length > 0
            ? `This ${jobNoun} ends. The next job stays on your list.`
            : `You’ll go back to looking for work. The rider is released.`
        }
        confirmLabel={`Cancel ${jobNoun}`}
        cancelLabel={`Keep ${jobNoun}`}
        onConfirm={confirmCancelJob}
        onCancel={dismissCancelJob}
      />

      <AdaptiveSurface.Interrupt
        id="interrupt"
        open={aside === "heading" || aside === "safety" || aside === "chat"}
        onOpenChange={(next) => {
          if (
            !next &&
            (aside === "heading" || aside === "safety" || aside === "chat")
          ) {
            onCloseAside();
          }
        }}
        label={
          aside === "safety"
            ? "Safety"
            : aside === "chat"
              ? `Message ${job?.riderName ?? "the rider"}`
              : "Where are you heading?"
        }
        description={
          aside === "heading"
            ? "You’ll only be offered rides that end up that way."
            : undefined
        }
      >
        {aside === "heading" ? (
          <LocationSearchScene
            framed={false}
            open
            adapter={placesAdapter}
            places={headingPlaces}
            title="Where are you heading?"
            placeholder="Where are you heading?"
            onSelect={(result) => {
              if (result.latitude == null || result.longitude == null) {
                setSearchError(
                  "Pick a place from the list or set a pin on the map.",
                );
                return;
              }
              chooseHeading({
                address: result.address,
                latitude: result.latitude,
                longitude: result.longitude,
              });
            }}
            onChooseOnMap={onChooseHeadingOnMap}
            onDismiss={onCloseAside}
            error={searchError}
            onError={setSearchError}
            footer={
              headingAddress ? (
                <button
                  type="button"
                  onClick={() =>
                    chooseHeading({
                      address: null,
                      latitude: null,
                      longitude: null,
                    })
                  }
                  disabled={setHeading.isPending}
                  className="text-muted-foreground hover:bg-accent focus-visible:ring-ring mt-4 flex min-h-12 w-full items-center rounded-2xl px-2 text-left text-[15px] focus-visible:ring-2 focus-visible:outline-none"
                >
                  Anywhere
                </button>
              ) : null
            }
          />
        ) : null}
        {aside === "safety" ? <DriverSafetyToolkit dashcam={dashcam} /> : null}
        {aside === "chat" && job ? (
          <TripChatThread
            tripId={job.id}
            fallbackName={job.riderName ?? "the rider"}
          />
        ) : null}
      </AdaptiveSurface.Interrupt>
    </>
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
    itemList: trip.itemList,
    scheduledAt: trip.scheduledAt,
    pinRequired: trip.pinRequired,
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
