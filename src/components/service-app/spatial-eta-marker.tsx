"use client";

import type { ReactNode } from "react";

import { FloatingRouteMarker } from "@/components/service-app/map-marker";
import { cn } from "@/lib/utils";

/**
 * SpatialEtaMarker — a time-to-service badge attached to a point in space.
 * FloatingRouteMarker (selected vs unselected) sits on the route or provider.
 */

export type SpatialEtaStatus = "en_route" | "arriving" | "arrived" | "waiting";

const STATUS_WORD: Record<SpatialEtaStatus, string> = {
  en_route: "ON THE WAY",
  arriving: "ARRIVING",
  arrived: "ARRIVED",
  waiting: "WAITING",
};

/** Compact, glanceable time. Under a minute is "NOW"; otherwise ceil minutes. */
function formatEta(etaSeconds: number): string {
  if (etaSeconds < 60) return "NOW";
  return `${Math.ceil(etaSeconds / 60)} MIN`;
}

export function SpatialEtaMarker({
  etaSeconds,
  status,
  icon,
  selected = false,
  label,
  className,
}: {
  /** Seconds until service. Null or absent falls back to the status word. */
  etaSeconds?: number | null;
  status: SpatialEtaStatus;
  /** Optional glyph inside the pill, left of the text. */
  icon?: ReactNode;
  /** Raises contrast — use for the entity currently under attention. */
  selected?: boolean;
  /** Overrides the computed text entirely. */
  label?: string;
  className?: string;
}) {
  const word = STATUS_WORD[status] ?? STATUS_WORD.waiting;
  const text =
    label ??
    (status === "arrived"
      ? word
      : etaSeconds === null || etaSeconds === undefined
        ? word
        : formatEta(etaSeconds));

  return (
    <div
      className={cn(
        "pointer-events-none flex flex-col items-center",
        className,
      )}
    >
      <FloatingRouteMarker
        label={text}
        selected={selected}
        startEnhancer={icon}
        anchor="bottom-center"
      />
    </div>
  );
}
