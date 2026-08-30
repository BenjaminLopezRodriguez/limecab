"use client";

import { SheetActions } from "@/components/service-app/service-sheet";
import { PrimaryAction } from "@/components/service-app/task-scene";
import {
  STATION_DURATIONS,
  type StationDurationId,
} from "@/lib/limecab/station";
import { cn } from "@/lib/utils";

/**
 * Lime Station — "How long?"
 *
 * Four chips, not a picker. Parking is bought in blunt blocks and a rider
 * standing on a kerb is not going to scroll a time wheel; the exact minute
 * they leave is not a question this product can answer honestly anyway.
 */
export function LimeCabStationDurationScene({
  duration,
  onSelect,
  onContinue,
}: {
  duration: StationDurationId | null;
  onSelect: (next: StationDurationId) => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <h2 className="font-heading text-[22px] font-semibold tracking-[-0.02em]">
        How long?
      </h2>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        You can stay longer — the lot bills the difference, not Lime.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {STATION_DURATIONS.map((option) => {
          const selected = option.id === duration;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(option.id)}
              className={cn(
                "focus-visible:ring-ring min-h-12 rounded-2xl px-5 text-[17px] font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none",
                selected
                  ? "bg-foreground text-background"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {duration ? (
        <SheetActions>
          <PrimaryAction onClick={onContinue}>See parking</PrimaryAction>
        </SheetActions>
      ) : null}
    </div>
  );
}
