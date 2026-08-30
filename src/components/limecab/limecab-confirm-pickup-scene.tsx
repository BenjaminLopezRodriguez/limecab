"use client";

import { Search01Icon } from "@hugeicons/core-free-icons";

import { LiveSheetHeader } from "@/components/service-app/live-sheet";
import { FixedMarker } from "@/components/service-app/map-marker";
import { PrimaryAction } from "@/components/service-app/task-scene";
import { SheetActions } from "@/components/service-app/service-sheet";
import { Icon } from "@/components/ui/icon";
import type { PickupCandidate } from "@/lib/limecab/pickup-points";
import { cn } from "@/lib/utils";

/**
 * Spatial confirmation: the map is the subject, the sheet names the curb.
 *
 * Pricing already happened on ride select. This scene only answers where
 * the car should stop — the address stays in the header, the spots of
 * that address are the list, and Search revises the place.
 */
export function LimeCabConfirmPickupScene({
  address,
  spots = [],
  selectedId,
  locating,
  busy,
  onSearch,
  onSelectSpot,
  onConfirm,
}: {
  address: string | null;
  spots?: PickupCandidate[];
  selectedId?: string | null;
  locating?: boolean;
  busy?: boolean;
  onSearch: () => void;
  onSelectSpot?: (id: string) => void;
  onConfirm: () => void;
}) {
  const line = locating ? "Finding address…" : (address ?? "Move the map");
  const rows = spots.filter(
    (spot) => spot.source !== "custom" || spot.id === selectedId,
  );

  return (
    <div className="flex min-h-full flex-col">
      <LiveSheetHeader
        instruction="Confirm pickup"
        secondary={line}
        trailing={
          <button
            type="button"
            onClick={onSearch}
            aria-label="Search pickup location"
            className="bg-muted text-foreground focus-visible:ring-ring flex size-[4.25rem] shrink-0 flex-col items-center justify-center rounded-2xl text-center touch-manipulation hover:bg-accent active:bg-accent/80 focus-visible:ring-2 focus-visible:outline-none"
          >
            <Icon icon={Search01Icon} size={22} aria-hidden="true" />
            <span className="mt-0.5 text-[11px] leading-none font-medium tracking-wide">
              Search
            </span>
          </button>
        }
      />

      {rows.length > 0 ? (
        <ul className="-mx-5 mt-4 md:-mx-6" aria-label="Pickup spots">
          {rows.map((spot) => {
            const selected = spot.id === selectedId;
            return (
              <li key={spot.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={spot.label}
                  onClick={() => onSelectSpot?.(spot.id)}
                  className={cn(
                    "relative flex w-full items-center gap-3 overflow-hidden px-5 py-3 text-left md:px-6",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
                    selected
                      ? "bg-accent before:bg-foreground before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']"
                      : "hover:bg-accent/60 active:bg-accent",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="relative flex size-11 shrink-0 items-center justify-center"
                  >
                    {selected ? (
                      <FixedMarker
                        kind="accent"
                        size="x-small-circle"
                        needle="none"
                      />
                    ) : (
                      <FixedMarker
                        kind="accent"
                        size="xx-small-circle"
                        needle="none"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-snug font-semibold tracking-tight">
                      {spot.label}
                    </span>
                    {address ? (
                      <span className="text-muted-foreground mt-0.5 block truncate text-sm">
                        {address}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <SheetActions>
        <PrimaryAction
          disabled={Boolean(busy) || Boolean(locating) || !address}
          onClick={onConfirm}
        >
          Confirm pickup
        </PrimaryAction>
      </SheetActions>
    </div>
  );
}
