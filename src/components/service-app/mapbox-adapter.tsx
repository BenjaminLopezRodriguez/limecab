"use client";

import dynamic from "next/dynamic";

import type { MapAdapter, MapViewProps } from "@/lib/service-app/map-adapter";

const MapboxCanvas = dynamic(
  () => import("./mapbox-canvas").then((mod) => mod.MapboxCanvas),
  { ssr: false, loading: () => <div className="bg-muted size-full" /> },
);

export function createMapboxAdapter(token: string): MapAdapter {
  return {
    render(props: MapViewProps) {
      return <MapboxCanvas token={token} {...props} />;
    },
  };
}
