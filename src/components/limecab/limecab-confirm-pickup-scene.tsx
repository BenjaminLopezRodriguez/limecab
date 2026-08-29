"use client";

import { Search01Icon } from "@hugeicons/core-free-icons";

import { LiveSheetHeader } from "@/components/service-app/live-sheet";
import { PrimaryAction } from "@/components/service-app/task-scene";
import { SheetActions } from "@/components/service-app/service-sheet";
import { Icon } from "@/components/ui/icon";

/**
 * Spatial confirmation: the map is the subject, the sheet names the curb.
 *
 * Pricing already happened on ride select. This scene only answers where
 * the car should stop, with a search tile where the fare used to sit.
 */
export function LimeCabConfirmPickupScene({
  address,
  locating,
  busy,
  onSearch,
  onConfirm,
}: {
  address: string | null;
  locating?: boolean;
  busy?: boolean;
  onSearch: () => void;
  onConfirm: () => void;
}) {
  const line = locating ? "Finding address…" : (address ?? "Move the map");

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

      <SheetActions>
        <PrimaryAction disabled={busy || locating || !address} onClick={onConfirm}>
          Confirm pickup
        </PrimaryAction>
      </SheetActions>
    </div>
  );
}
