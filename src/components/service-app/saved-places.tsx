"use client";

import type { ReactNode } from "react";
import { MapPin } from "lucide-react";

import { splitAddress, type Place } from "@/lib/service-app/services";
import { cn } from "@/lib/utils";

/**
 * Saved and recent places.
 *
 * No labels are hard-coded — "Home", "Work", a job number, or a street line
 * are all just `place.label`. Works for rideshare, delivery, field service,
 * and inspections without changes.
 *
 * Two presentations: `chips` is the one-tap shortcut rail for a handful of
 * saved places; `rows` is the scannable list a history needs, where the
 * address is as load-bearing as the name.
 */
export function SavedPlaces({
  places,
  onSelect,
  title = "Places",
  variant = "chips",
  iconFor,
  className,
}: {
  places: Place[];
  onSelect: (place: Place) => void;
  title?: string;
  variant?: "chips" | "rows";
  /** Per-place glyph. The kit never infers meaning from a label. */
  iconFor?: (place: Place) => ReactNode;
  className?: string;
}) {
  if (places.length === 0) return null;

  const icon = (place: Place) =>
    iconFor?.(place) ?? <MapPin strokeWidth={1.75} />;

  if (variant === "rows") {
    return (
      <section aria-label={title} className={className}>
        <p className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">
          {title}
        </p>
        <ul className="-mx-2 mt-1">
          {places.map((place) => {
            // The street line, not the locality: the name already carries the
            // area, so repeating it says nothing the row did not already say.
            const { line } = splitAddress(place.address);
            return (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => onSelect(place)}
                  aria-label={`${place.label}. ${place.address}${place.hint ? `. ${place.hint}` : ""}`}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 text-left",
                    "hover:bg-accent active:bg-accent",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-[18px]"
                  >
                    {icon(place)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium tracking-tight">
                      {place.label}
                    </span>
                    <span className="text-muted-foreground block truncate text-sm">
                      {line}
                    </span>
                  </span>
                  {place.hint ? (
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {place.hint}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <section aria-label={title} className={className}>
      <ul className="-mx-1 flex [scrollbar-width:none] gap-2 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden">
        {places.map((place) => (
          <li key={place.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onSelect(place)}
              aria-label={`${place.label}. ${place.address}`}
              className={cn(
                "bg-card ring-border flex min-h-12 max-w-[11rem] items-center gap-2 rounded-full px-4 ring-1",
                "hover:ring-ring/40 active:bg-accent",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              )}
            >
              <span
                aria-hidden="true"
                className="text-muted-foreground shrink-0 [&_svg]:size-4"
              >
                {icon(place)}
              </span>
              <span className="min-w-0 truncate text-sm font-medium tracking-tight">
                {place.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
