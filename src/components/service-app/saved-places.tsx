"use client";

import { MapPin } from "lucide-react";

import type { Place } from "@/lib/service-app/services";
import { cn } from "@/lib/utils";

/**
 * Saved and recent places.
 *
 * No labels are hard-coded — "Home", "Work", a job number, or a street line
 * are all just `place.label`. Works for rideshare, delivery, field service,
 * and inspections without changes.
 */
export function SavedPlaces({
  places,
  onSelect,
  title = "Places",
  className,
}: {
  places: Place[];
  onSelect: (place: Place) => void;
  title?: string;
  className?: string;
}) {
  if (places.length === 0) return null;

  return (
    <section aria-label={title} className={className}>
      <p className="text-muted-foreground text-xs tracking-wide uppercase">
        {title}
      </p>
      <ul className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {places.map((place) => (
          <li key={place.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onSelect(place)}
              className={cn(
                "bg-card ring-border flex min-h-11 max-w-[11rem] items-center gap-2 rounded-full px-3.5 ring-1",
                "hover:ring-ring/40 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              )}
            >
              <MapPin
                className="text-muted-foreground size-4 shrink-0"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span className="min-w-0 truncate text-sm tracking-tight">
                {place.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
