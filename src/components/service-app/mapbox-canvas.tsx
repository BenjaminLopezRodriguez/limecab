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
import { SpatialEtaMarker } from "@/components/service-app/spatial-eta-marker";
import { zoomForMode, type MapViewProps } from "@/lib/service-app/map-adapter";
import { cn } from "@/lib/utils";

const ROUTE_LIME = "#c8f031";

const routeLayer = {
  id: "limecab-route",
  type: "line" as const,
  layout: { "line-join": "round" as const, "line-cap": "round" as const },
  paint: {
    "line-color": ROUTE_LIME,
    "line-width": 5,
    "line-opacity": 0.9,
  },
};

const mutedRouteLayer = {
  ...routeLayer,
  id: "limecab-route-muted",
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const enteredPin = interactive && !wasInteractive.current;
    wasInteractive.current = interactive;

    if (interactive) {
      if (enteredPin) {
        map.easeTo({
          center: [start.longitude, start.latitude],
          zoom: resolvedZoom,
          duration: 300,
        });
      }
      return;
    }

    if (route.length > 1) {
      const lats = route.map((point) => point.latitude);
      const lngs = route.map((point) => point.longitude);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        {
          padding: { top: 48, bottom: 200, left: 48, right: 48 },
          duration: 500,
          maxZoom: 15,
        },
      );
      return;
    }
    map.easeTo({
      center: [start.longitude, start.latitude],
      zoom: resolvedZoom,
      duration: 400,
    });
  }, [interactive, ready, resolvedZoom, route, start.latitude, start.longitude]);

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
        }}
        style={{ width: "100%", height: "100%" }}
        dragPan={interactive}
        dragRotate={false}
        scrollZoom={interactive}
        doubleClickZoom={interactive}
        touchPitch={false}
        touchZoomRotate={interactive}
        keyboard={interactive}
        attributionControl
        onLoad={() => setReady(true)}
        onMoveEnd={
          interactive && onCameraChange
            ? (event) =>
                onCameraChange({
                  latitude: event.viewState.latitude,
                  longitude: event.viewState.longitude,
                })
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
          >
            <span
              className={cn(
                "block size-3 rounded-full ring-2 ring-black/40",
                point.kind === "provider"
                  ? "bg-lime size-3.5"
                  : point.kind === "destination"
                    ? "bg-foreground rounded-[3px]"
                    : "bg-lime",
              )}
            />
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
