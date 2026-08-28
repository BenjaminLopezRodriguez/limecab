"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  Marker,
  Source,
  type MapRef,
} from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

import { LocationPinMarker } from "@/components/service-app/location-pin-marker";
import { CarMarker } from "@/components/service-app/car-marker";
import {
  onOverlayChange,
  readMapPadding,
} from "@/components/service-app/map-overlay";
import { SpatialEtaMarker } from "@/components/service-app/spatial-eta-marker";
import {
  tracksProvider,
  zoomForMode,
  type MapViewProps,
} from "@/lib/service-app/map-adapter";
import { cn } from "@/lib/utils";

const ROUTE_LIME = "#c8f031";

/**
 * One layer id, two paint states.
 *
 * These used to be two ids on a single `<Source>`; swapping between them made
 * react-map-gl tear the layer down and rebuild it ("layer id changed"), which
 * is a remount of the route line every time the map went muted — a driver
 * sees it on every leg. Same id means the SDK diffs paint instead.
 *
 * Both states declare the *same* paint keys for that diff to be complete: a
 * key present only on the muted state would survive the switch back.
 * `[1, 0]` is dash-1/gap-0, i.e. solid.
 */
const routeLayer = {
  id: "limecab-route",
  type: "line" as const,
  layout: { "line-join": "round" as const, "line-cap": "round" as const },
  paint: {
    "line-color": ROUTE_LIME,
    "line-width": 5,
    "line-opacity": 0.9,
    "line-dasharray": [1, 0],
  },
};

const mutedRouteLayer = {
  ...routeLayer,
  paint: {
    "line-color": ROUTE_LIME,
    "line-width": 4,
    "line-opacity": 0.45,
    "line-dasharray": [2, 2],
  },
};

/**
 * Mapbox GL canvas. Pan, pinch, and the street tiles come from the SDK —
 * this component only places the ride's markers, the driving line, and the
 * pin overlay when the rider is choosing a point.
 */
export function MapboxCanvas({
  token,
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
}: MapViewProps & { token: string }) {
  const mapRef = useRef<MapRef>(null);
  const [ready, setReady] = useState(false);
  const resolvedZoom = zoom ?? zoomForMode(mode);
  const start = center ?? points[0] ?? { latitude: 34.05, longitude: -118.25 };

  const routeData = useMemo(
    () => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: route.map((point) => [point.longitude, point.latitude]),
      },
    }),
    [route],
  );

  const muted = mode === "provider_arrival" || mode === "results";
  const wasInteractive = useRef(false);
  const tracking = tracksProvider(mode);
  const follow = tracking
    ? points.find((point) => point.kind === "provider")
    : undefined;
  const followLat = follow?.latitude;
  const followLng = follow?.longitude;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const enteredPin = interactive && !wasInteractive.current;
    wasInteractive.current = interactive;
    let pinJustEntered = enteredPin;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const frame = () => {
      map.resize();
      const padding = readMapPadding();
      map.getMap().setPadding(padding);
      const duration = reduce ? 0 : pinJustEntered ? 300 : 500;

      if (interactive) {
        if (pinJustEntered) {
          pinJustEntered = false;
          map.easeTo({
            center: [start.longitude, start.latitude],
            zoom: resolvedZoom,
            duration,
            padding,
          });
        }
        return;
      }

      // Follow-cam owns the camera while a vehicle is live.
      if (tracking) return;

      if (route.length > 1) {
        const lats = route.map((point) => point.latitude);
        const lngs = route.map((point) => point.longitude);
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding, duration, maxZoom: 15 },
        );
        return;
      }

      map.easeTo({
        center: [start.longitude, start.latitude],
        zoom: resolvedZoom,
        duration: reduce ? 0 : 400,
        padding,
      });
    };

    frame();
    const observer = new ResizeObserver(frame);
    observer.observe(map.getContainer());
    const stopOverlay = onOverlayChange(frame);
    return () => {
      observer.disconnect();
      stopOverlay();
    };
  }, [
    interactive,
    ready,
    resolvedZoom,
    route,
    start.latitude,
    start.longitude,
    tracking,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (
      !map ||
      !ready ||
      interactive ||
      followLat === undefined ||
      followLng === undefined
    ) {
      return;
    }
    const gl = map.getMap();
    gl.setPadding(readMapPadding());
    gl.setCenter([followLng, followLat]);
    if (Math.abs(gl.getZoom() - resolvedZoom) > 0.08) {
      gl.setZoom(resolvedZoom);
    }
  }, [followLat, followLng, interactive, ready, resolvedZoom]);

  return (
    <div className={cn("bg-muted relative size-full overflow-hidden", className)}>
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        initialViewState={{
          longitude: start.longitude,
          latitude: start.latitude,
          zoom: resolvedZoom,
          pitch: 0,
          bearing: 0,
        }}
        projection="mercator"
        pitch={0}
        maxPitch={0}
        style={{ width: "100%", height: "100%" }}
        dragPan={interactive}
        dragRotate={false}
        scrollZoom={interactive}
        doubleClickZoom={interactive}
        touchPitch={false}
        touchZoomRotate={interactive}
        keyboard={interactive}
        attributionControl
        onLoad={() => {
          mapRef.current?.getMap().setProjection("mercator");
          setReady(true);
        }}
        onMoveEnd={
          interactive && onCameraChange
            ? (event) => {
                // Only a real gesture moves the pin. `setPadding` and `easeTo`
                // fire `moveend` too, and reporting those back as a camera
                // change is a loop: state moves the camera, the camera moves
                // state. Mapbox marks user input with `originalEvent`.
                // `originalEvent` is present on gesture-driven camera events
                // and absent on programmatic ones. react-map-gl does not
                // declare it on ViewStateChangeEvent, hence the narrow read.
                const gesture = (event as { originalEvent?: unknown })
                  .originalEvent;
                if (!gesture) return;
                onCameraChange({
                  latitude: event.viewState.latitude,
                  longitude: event.viewState.longitude,
                });
              }
            : undefined
        }
      >
        {route.length > 1 ? (
          <Source id="limecab-route" type="geojson" data={routeData}>
            <Layer {...(muted ? mutedRouteLayer : routeLayer)} />
          </Source>
        ) : null}

        {points.map((point, index) => (
          <Marker
            key={`${point.kind ?? "marker"}-${index}`}
            longitude={point.longitude}
            latitude={point.latitude}
            anchor="center"
            rotationAlignment="map"
          >
            {point.kind === "provider" || point.kind === "marker" ? (
              <CarMarker
                heading={point.heading ?? 0}
                size={point.kind === "provider" ? "md" : "sm"}
              />
            ) : (
              <span
                className={cn(
                  "block size-3 rounded-full ring-2 ring-black/40",
                  point.kind === "destination"
                    ? "bg-foreground rounded-[3px]"
                    : "bg-lime",
                )}
              />
            )}
          </Marker>
        ))}
      </Map>

      {interactive ? (
        <LocationPinMarker name={pinLabel ?? null} locating={pinLocating} />
      ) : null}

      {label ? (
        <p className="bg-background/80 text-muted-foreground absolute top-3 left-4 z-10 max-w-[70%] truncate rounded-full px-2 py-0.5 text-xs">
          {label}
        </p>
      ) : null}

      {callout && !interactive ? (
        <SpatialEtaMarker
          label={callout}
          status={
            mode === "provider_arrival"
              ? "arriving"
              : mode === "active_route"
                ? "en_route"
                : mode === "results"
                  ? "arrived"
                  : "waiting"
          }
          className="absolute top-[22%] left-1/2 z-10 -translate-x-1/2"
        />
      ) : null}
    </div>
  );
}
