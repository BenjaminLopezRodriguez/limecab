"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react";
import { LocationPinMarker } from "@/components/service-app/location-pin-marker";
import { SpatialEtaMarker } from "@/components/service-app/spatial-eta-marker";
import {
  fitMetersPerUnit,
  panCenter,
  projectPoint,
  tracksProvider,
  zoomForMode,
  type MapAdapter,
  type MapMode,
  type MapPoint,
  type MapPointKind,
  type MapViewProps,
} from "@/lib/service-app/map-adapter";
import { cn } from "@/lib/utils";

/**
 * ServiceMap — the spatial canvas.
 *
 * It knows nothing about any vendor and nothing about any product. It takes a
 * `MapMode`, some points, and an adapter. `ServiceAppShell` owns whether the
 * map is a bounded region (home) or the full canvas (task) — the map itself
 * only changes what it shows.
 */

const MapAdapterContext = createContext<MapAdapter | null>(null);

export function MapAdapterProvider({
  adapter,
  children,
}: {
  adapter: MapAdapter;
  children: ReactNode;
}) {
  return (
    <MapAdapterContext.Provider value={adapter}>
      {children}
    </MapAdapterContext.Provider>
  );
}

export function ServiceMap({
  adapter,
  className,
  ...props
}: MapViewProps & { adapter?: MapAdapter }) {
  const contextAdapter = useContext(MapAdapterContext);
  const active = adapter ?? contextAdapter ?? placeholderMapAdapter;
  return (
    <>
      {active.render({
        ...props,
        zoom: props.zoom ?? zoomForMode(props.mode),
        className: cn("size-full", className),
      })}
    </>
  );
}

const POINT_STYLE: Record<
  NonNullable<MapPoint["kind"]>,
  { fill: string; halo: boolean }
> = {
  origin: { fill: "currentColor", halo: true },
  destination: { fill: "currentColor", halo: true },
  provider: { fill: "currentColor", halo: true },
  selection: { fill: "currentColor", halo: true },
  marker: { fill: "currentColor", halo: false },
  poi: { fill: "currentColor", halo: true },
};

/**
 * How each mode treats its geometry. The placeholder is not decoration — the
 * mode is the whole point of the seam, so each one has to *look* like the
 * question it is asking.
 */
type ModeTreatment = {
  /** "none" | "muted" (settled summary) | "primary" (the subject) */
  route: "none" | "muted" | "primary";
  /** Points that get raised weight. */
  emphasis: MapPointKind[];
  /** Every other point is pushed back. */
  dimOthers: boolean;
  /** Soft wide-area disc — the ambient "we are looking" canvas. */
  coverage: boolean;
  /** Centre crosshair — the user is picking a point. */
  crosshair: boolean;
  /** Caps on the first and last route vertex. */
  routeCaps: boolean;
};

const MODE_TREATMENT: Record<MapMode, ModeTreatment> = {
  home: {
    route: "none",
    emphasis: [],
    dimOthers: false,
    coverage: false,
    crosshair: false,
    routeCaps: false,
  },
  select_location: {
    route: "none",
    emphasis: ["selection", "poi"],
    dimOthers: true,
    coverage: false,
    crosshair: true,
    routeCaps: false,
  },
  route_preview: {
    route: "primary",
    emphasis: [],
    dimOthers: true,
    coverage: false,
    crosshair: false,
    routeCaps: true,
  },
  provider_arrival: {
    route: "muted",
    emphasis: ["provider"],
    dimOthers: false,
    coverage: false,
    crosshair: false,
    routeCaps: false,
  },
  active_route: {
    route: "primary",
    emphasis: ["provider"],
    dimOthers: false,
    coverage: false,
    crosshair: false,
    routeCaps: false,
  },
  coverage: {
    route: "none",
    emphasis: [],
    dimOthers: true,
    coverage: true,
    crosshair: false,
    routeCaps: false,
  },
  results: {
    route: "muted",
    emphasis: ["origin", "destination"],
    dimOthers: true,
    coverage: false,
    crosshair: false,
    routeCaps: true,
  },
};

const FALLBACK_TREATMENT: ModeTreatment = {
  route: "primary",
  emphasis: [],
  dimOthers: false,
  coverage: false,
  crosshair: false,
  routeCaps: false,
};

const MARKER_STATUS = {
  provider_arrival: "arriving",
  active_route: "en_route",
  results: "arrived",
} as const;

/** Midpoint, so two points of interest can both stay in frame. */
function midpoint(a: MapPoint, b: MapPoint): MapPoint {
  return {
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
  };
}

/**
 * No-token fallback. Draws points and the route relative to `center` with a
 * treatment per `MapMode`. Not a stand-in street map — LimeCab uses Mapbox
 * when `NEXT_PUBLIC_MAPBOX_TOKEN` is set.
 */
export const placeholderMapAdapter: MapAdapter = {
  render(props) {
    return <PlaceholderCanvas {...props} />;
  },
};

/**
 * The canvas draws a square viewBox with `slice`, so a container that is not
 * square crops one axis. `visibleHalfExtent` is how many viewBox units are
 * actually on screen either side of centre — without it, "fit the route in
 * frame" fits it into a frame the user cannot see.
 */
function useVisibleHalfExtent(ref: { current: HTMLElement | null }) {
  const [half, setHalf] = useState(56);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect;
      if (!box || box.width === 0 || box.height === 0) return;
      const shortest = Math.min(box.width, box.height);
      const longest = Math.max(box.width, box.height);
      // 100 units is half the viewBox; the cropped axis keeps this fraction.
      // 14 units of padding keep the fitted points off the very edge.
      setHalf(Math.max(24, (100 * shortest) / longest - 14));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return half;
}

function metersForZoom(zoom: number) {
  return Math.max(1.5, 6 * 2 ** (16 - zoom));
}

function pinchDistance(
  pointers: Map<number, { x: number; y: number }>,
): number {
  const [a, b] = [...pointers.values()];
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function PlaceholderCanvas({
  mode,
  center,
  points = [],
  route = [],
  callout,
  label,
  pinLabel,
  pinLocating = false,
  zoom,
  interactive = false,
  onCameraChange,
  className,
}: MapViewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const halfExtent = useVisibleHalfExtent(frameRef);
  const resolvedZoom = zoom ?? zoomForMode(mode);
  const { frame: camera, meters: liveMeters, handlers } = useMapGestures({
    enabled: interactive,
    center,
    zoom: resolvedZoom,
    onCameraChange,
  });

  {
    const treatment = MODE_TREATMENT[mode] ?? FALLBACK_TREATMENT;

    const providerPoint = points.find((point) => point.kind === "provider");
    const originPoint = points.find((point) => point.kind === "origin");
    const destinationPoint = points.find(
      (point) => point.kind === "destination",
    );
    const following = tracksProvider(mode) && providerPoint;

    // Follow-cam keeps the vehicle on the same pixel; preview and receipt
    // still fit both ends of the trip so the itinerary is readable.
    const frame =
      interactive && camera
        ? camera
        : following
          ? providerPoint
          : (mode === "route_preview" || mode === "results") &&
              originPoint &&
              destinationPoint
            ? midpoint(originPoint, destinationPoint)
            : (camera ?? center ?? null);

    // One scale for points and route, fitted to whatever is on screen — a
    // preview that crops the destination is not a preview. While the user is
    // placing a pin the scale is theirs to pinch, not fitted to other points.
    // Follow-cam uses a street-level scale so the path can slide off-frame.
    const framed = frame
      ? following && providerPoint
        ? [providerPoint]
        : [...points, ...(treatment.route !== "none" ? route : [])]
      : [];
    const metersPerUnit = interactive
      ? liveMeters
      : frame
        ? fitMetersPerUnit(frame, framed, { margin: halfExtent })
        : 6;

    const projected = frame
      ? points.map((point) => ({
          point,
          at: projectPoint(frame, point, metersPerUnit, !following),
        }))
      : [];
    const path =
      frame && treatment.route !== "none"
        ? route.map((point) =>
            projectPoint(frame, point, metersPerUnit, !following),
          )
        : [];

    const providerAt = projected.find(
      (entry) => entry.point.kind === "provider",
    )?.at;
    const routeStart = path[0];
    const routeEnd = path[path.length - 1];

    const markerStatus =
      mode === "provider_arrival" || mode === "active_route" || mode === "results"
        ? MARKER_STATUS[mode]
        : "waiting";

    const calloutOverProvider =
      (mode === "provider_arrival" || mode === "active_route") &&
      providerAt !== undefined;

    return (
      <div
        ref={frameRef}
        {...handlers}
        role={interactive ? "application" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={
          interactive
            ? "Map. Drag or use arrow keys to move the pin."
            : undefined
        }
        className={cn(
          "bg-muted text-foreground relative overflow-hidden",
          interactive &&
            "cursor-grab touch-none focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing",
          className,
        )}
      >
        <svg
          viewBox="0 0 200 200"
          className="h-full w-full"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="service-map-coverage">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
              <stop offset="60%" stopColor="currentColor" stopOpacity="0.08" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </defs>

          <g stroke="currentColor" strokeOpacity="0.07" strokeWidth="0.6" fill="none">
            {[20, 60, 100, 140, 180].map((x) => (
              <line key={`v${x}`} x1={x} y1="0" x2={x} y2="200" />
            ))}
            {[24, 68, 112, 156].map((y) => (
              <line key={`h${y}`} x1="0" y1={y} x2="200" y2={y} />
            ))}
          </g>
          <g fill="currentColor" fillOpacity="0.04">
            <rect x="24" y="28" width="32" height="36" rx="3" />
            <rect x="64" y="28" width="32" height="36" rx="3" />
            <rect x="116" y="60" width="32" height="36" rx="3" />
            <rect x="140" y="128" width="32" height="36" rx="3" />
            <rect x="24" y="116" width="32" height="36" rx="3" />
          </g>
          <path
            d="M0 96 L200 84"
            stroke="currentColor"
            strokeOpacity="0.1"
            strokeWidth="5"
            fill="none"
          />

          {treatment.coverage ? (
            <g>
              <circle cx="100" cy="100" r="92" fill="url(#service-map-coverage)" />
              <circle
                cx="100"
                cy="100"
                r="74"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.16"
                strokeWidth="1"
                strokeDasharray="3 7"
              />
              <circle
                cx="100"
                cy="100"
                r="44"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.12"
                strokeWidth="1"
                strokeDasharray="3 7"
              />
              <circle cx="100" cy="100" r="3.5" fill="currentColor" fillOpacity="0.5" />
            </g>
          ) : null}

          {path.length > 1 ? (
            <polyline
              points={path.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeOpacity={treatment.route === "primary" ? "0.75" : "0.28"}
              strokeWidth={treatment.route === "primary" ? "3" : "2"}
              strokeDasharray={treatment.route === "muted" ? "5 5" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {treatment.routeCaps && routeStart && routeEnd && path.length > 1 ? (
            <g fill="currentColor">
              <circle cx={routeStart.x} cy={routeStart.y} r="3.4" />
              <circle cx={routeEnd.x} cy={routeEnd.y} r="3.4" />
            </g>
          ) : null}

          {treatment.crosshair && !interactive ? (
            <g stroke="currentColor" strokeOpacity="0.35" strokeWidth="1">
              <line x1="100" y1="72" x2="100" y2="90" />
              <line x1="100" y1="110" x2="100" y2="128" />
              <line x1="72" y1="100" x2="90" y2="100" />
              <line x1="110" y1="100" x2="128" y2="100" />
              <circle cx="100" cy="100" r="17" fill="none" strokeOpacity="0.25" />
            </g>
          ) : null}

          {projected.map(({ point, at }, index) => {
            const kind = point.kind ?? "marker";
            const style = POINT_STYLE[kind] ?? POINT_STYLE.marker;
            const emphasised = treatment.emphasis.includes(kind);
            const dimmed = treatment.dimOthers && !emphasised;
            const car = kind === "provider" || kind === "marker";
            const heading = point.heading ?? 0;
            const carW = kind === "provider" ? 7 : 5;
            const carH = kind === "provider" ? 12 : 8;
            return (
              <g
                key={`${point.latitude},${point.longitude},${index}`}
                opacity={dimmed ? 0.45 : 1}
              >
                {car ? (
                  <g transform={`rotate(${heading} ${at.x} ${at.y})`}>
                    <rect
                      x={at.x - carW / 2}
                      y={at.y - carH / 2}
                      width={carW}
                      height={carH}
                      rx={carW / 2.4}
                      fill={style.fill}
                    />
                    <rect
                      x={at.x - carW / 3.2}
                      y={at.y - carH / 3.4}
                      width={carW / 1.6}
                      height={carH / 3.4}
                      rx={1}
                      className="fill-background"
                      fillOpacity="0.45"
                    />
                  </g>
                ) : (
                  <>
                    {style.halo && !dimmed ? (
                      <circle
                        cx={at.x}
                        cy={at.y}
                        r={emphasised ? 14 : 11}
                        fill={style.fill}
                        fillOpacity={emphasised ? 0.16 : 0.12}
                      />
                    ) : null}
                    <circle
                      cx={at.x}
                      cy={at.y}
                      r={emphasised ? 6.4 : dimmed ? 3.8 : 5}
                      fill={style.fill}
                    />
                    <circle
                      cx={at.x}
                      cy={at.y}
                      r={emphasised ? 2.4 : 1.9}
                      className="fill-background"
                    />
                  </>
                )}
              </g>
            );
          })}

          {frame && projected.length === 0 && !treatment.coverage && !treatment.crosshair ? (
            <g>
              <circle cx="100" cy="100" r="20" fill="currentColor" fillOpacity="0.1" />
              <circle cx="100" cy="100" r="5.5" fill="currentColor" />
              <circle cx="100" cy="100" r="2" className="fill-background" />
            </g>
          ) : null}
        </svg>

        {treatment.crosshair && interactive ? (
          <LocationPinMarker name={pinLabel ?? null} locating={pinLocating} />
        ) : null}

        {label ? (
          <p className="bg-background/80 text-muted-foreground absolute top-3 left-4 max-w-[70%] truncate rounded-full px-2 py-0.5 text-xs">
            {label}
          </p>
        ) : null}
        {callout ? (
          calloutOverProvider && providerAt ? (
            <span
              className="absolute -translate-x-1/2 -translate-y-full"
              style={{
                left: `${(providerAt.x / 200) * 100}%`,
                top: `${(providerAt.y / 200) * 100}%`,
              }}
            >
              <SpatialEtaMarker label={callout} status={markerStatus} selected />
            </span>
          ) : (
            <SpatialEtaMarker
              label={callout}
              status={markerStatus}
              className="absolute top-[26%] left-1/2 -translate-x-1/2"
            />
          )
        ) : null}
      </div>
    );
  }
}

function useMapGestures({
  enabled,
  center,
  zoom,
  onCameraChange,
}: {
  enabled: boolean;
  center: MapPoint | null | undefined;
  zoom: number;
  onCameraChange?: (center: MapPoint) => void;
}) {
  const [camera, setCamera] = useState<MapPoint | null>(center ?? null);
  const [meters, setMeters] = useState(() => metersForZoom(zoom));
  const cameraRef = useRef(camera);
  const metersRef = useRef(meters);
  cameraRef.current = camera;
  metersRef.current = meters;

  const dragging = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    camera: MapPoint;
    meters: number;
    origin: { x: number; y: number };
    pinch: number | null;
  } | null>(null);

  useEffect(() => {
    if (!dragging.current && center) setCamera(center);
  }, [center]);

  useEffect(() => {
    if (!dragging.current) setMeters(metersForZoom(zoom));
  }, [zoom]);

  const frame = camera ?? center ?? null;
  if (!enabled) {
    return { frame: center ?? null, meters: metersForZoom(zoom), handlers: {} };
  }

  const finish = () => {
    dragging.current = false;
    gesture.current = null;
    const next = cameraRef.current;
    if (next) onCameraChange?.(next);
  };

  const handlers = {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      event.currentTarget.setPointerCapture(event.pointerId);
      pointers.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      const origin = pointers.current.values().next().value;
      const here = cameraRef.current;
      if (!origin || !here) return;
      dragging.current = true;
      gesture.current = {
        camera: here,
        meters: metersRef.current,
        origin,
        pinch:
          pointers.current.size === 2
            ? pinchDistance(pointers.current)
            : null,
      };
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (!dragging.current || !gesture.current) return;
      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      const box = event.currentTarget.getBoundingClientRect();
      const scale = Math.max(box.width / 200, box.height / 200);

      if (pointers.current.size >= 2) {
        const dist = pinchDistance(pointers.current);
        const start = gesture.current.pinch ?? dist;
        if (start > 0) {
          setMeters(
            Math.min(80, Math.max(1.5, gesture.current.meters / (dist / start))),
          );
        }
        return;
      }

      const { origin } = gesture.current;
      setCamera(
        panCenter(
          gesture.current.camera,
          (event.clientX - origin.x) / scale,
          (event.clientY - origin.y) / scale,
          gesture.current.meters,
        ),
      );
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      pointers.current.delete(event.pointerId);
      if (pointers.current.size > 0) {
        const remaining = pointers.current.values().next().value;
        const here = cameraRef.current;
        if (remaining && here) {
          gesture.current = {
            camera: here,
            meters: metersRef.current,
            origin: remaining,
            pinch: null,
          };
        }
        return;
      }
      finish();
    },
    onPointerCancel: (event: PointerEvent<HTMLDivElement>) => {
      pointers.current.delete(event.pointerId);
      if (pointers.current.size === 0) finish();
    },
    onWheel: (event: WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 1.12 : 1 / 1.12;
      setMeters((current) => Math.min(80, Math.max(1.5, current * factor)));
    },
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      const here = cameraRef.current;
      if (!here) return;
      const step = 14;
      const move: Record<string, [number, number]> = {
        ArrowLeft: [step, 0],
        ArrowRight: [-step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      };
      const delta = move[event.key];
      if (!delta) return;
      event.preventDefault();
      const next = panCenter(here, delta[0], delta[1], metersRef.current);
      setCamera(next);
      onCameraChange?.(next);
    },
  };

  return { frame, meters, handlers };
}
