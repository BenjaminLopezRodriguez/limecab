"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * SpatialEtaMarker — a time-to-service badge attached to a point in space.
 *
 * Purely presentational: a compact pill with a pointer and an anchor dot
 * beneath it, so it reads as belonging to whatever it sits over.
 *
 *     [ 4 MIN ]
 *         ●
 *
 * It knows nothing about any map vendor and nothing about what the entity is.
 * Whoever owns the canvas positions it — usually absolutely, over a projected
 * point. Rendered standalone it simply lays out in normal flow.
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
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] leading-none font-medium tracking-wide tabular-nums shadow-md",
          selected
            ? "bg-foreground text-background"
            : "bg-popover text-foreground ring-border ring-1",
        )}
      >
        {icon ? (
          <span className="flex size-3 items-center justify-center [&_svg]:size-3">
            {icon}
          </span>
        ) : null}
        <span className="whitespace-nowrap uppercase">{text}</span>
      </div>
      <span
        aria-hidden="true"
        className={cn(
          "-mt-[3px] size-2 rotate-45 rounded-[1px]",
          selected ? "bg-foreground" : "bg-popover ring-border ring-1",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "mt-1 size-2.5 rounded-full ring-2",
          selected
            ? "bg-foreground ring-background"
            : "bg-foreground/70 ring-background",
        )}
      />
    </div>
  );
}
