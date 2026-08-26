"use client";

import { cn } from "@/lib/utils";

/**
 * Centered map pin: a lime pill of the nearest short name, with a stem
 * that sits on the point being chosen.
 */
export function LocationPinMarker({
  name,
  locating = false,
}: {
  name: string | null;
  locating?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <span className="-translate-y-[calc(50%+6px)] flex flex-col items-center">
        <span
          className={cn(
            "bg-lime text-lime-foreground max-w-[min(70vw,16rem)] truncate rounded-full px-3 py-1.5 text-[13px] font-semibold shadow-md",
            locating && "opacity-80",
          )}
        >
          {name?.trim() ? name.trim() : "…"}
        </span>
        <span className="bg-lime mt-[-3px] size-2.5 rotate-45" />
      </span>
    </span>
  );
}
