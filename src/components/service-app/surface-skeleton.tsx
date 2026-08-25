"use client";

import { cn } from "@/lib/utils";

/**
 * SurfaceSkeleton — first paint of a scene whose data has not arrived.
 *
 * Perceived performance applies to arrival, not only to transitions. A scene
 * that renders its own shape immediately reads as loaded-and-filling; a
 * spinner reads as blocked.
 *
 * The truthfulness rule from `surface-progress` holds here too: a skeleton is
 * geometry. It must never contain a plausible-looking number, price, name, or
 * ETA that the user could read as real.
 */
export function SurfaceSkeleton({
  lines = 3,
  showAction = false,
  label = "Loading",
  className,
}: {
  lines?: number;
  /** Reserve the primary action's height so nothing jumps when it arrives. */
  showAction?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn("flex flex-col gap-3", className)}
    >
      <span className="sr-only">{label}</span>
      <Bar className="h-5 w-2/5" />
      {Array.from({ length: Math.max(0, lines) }, (_, index) => (
        <Bar
          key={index}
          className={index === lines - 1 ? "h-4 w-3/5" : "h-4 w-full"}
        />
      ))}
      {showAction ? <Bar className="mt-3 h-12 w-full rounded-xl" /> : null}
    </div>
  );
}

/** Placeholder rows for a list of items, e.g. search results or services. */
export function SurfaceSkeletonList({
  rows = 3,
  label = "Loading results",
  className,
}: {
  rows?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn("flex flex-col gap-4", className)}
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: Math.max(1, rows) }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Bar className="size-10 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Bar className="h-4 w-1/2" />
            <Bar className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Bar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-accent block animate-pulse rounded-md motion-reduce:animate-none",
        className,
      )}
    />
  );
}
