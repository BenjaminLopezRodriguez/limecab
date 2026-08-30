"use client";

import { SheetActions } from "@/components/service-app/service-sheet";
import { PrimaryAction } from "@/components/service-app/task-scene";
import { SPACE_KINDS, type SpaceKind } from "@/lib/limecab/spaces";
import { cn } from "@/lib/utils";

/**
 * Lime Spaces — "What kind of space?"
 *
 * Three tiles rather than the comparison list, for the same reason Help uses
 * tiles: a meeting room, a venue and a bed are different things with
 * different rates and different questions behind them, and that difference
 * is this whole scene. Comparing actual rooms is the next one.
 */

const BLURB: Record<SpaceKind, string> = {
  meeting: "A room for a few hours. Desks, a screen, a door that shuts.",
  venue: "A larger space for an event, priced by the hour.",
  stay: "A bed for the night, priced per night.",
};

export function LimeCabSpacesKindScene({
  kind,
  onSelect,
  onContinue,
}: {
  kind: SpaceKind | null;
  onSelect: (next: SpaceKind) => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <h2 className="font-heading text-[22px] font-semibold tracking-[-0.02em]">
        What kind of space?
      </h2>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        Lime books it with the partner. You pay when you confirm.
      </p>

      <div className="mt-5 flex flex-col gap-2">
        {SPACE_KINDS.map((option) => {
          const selected = option.id === kind;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(option.id)}
              className={cn(
                "focus-visible:ring-ring rounded-2xl px-4 py-3.5 text-left ring-1 focus-visible:ring-2 focus-visible:outline-none",
                selected ? "ring-foreground ring-2" : "ring-border",
              )}
            >
              <p className="text-[17px] font-semibold tracking-tight">
                {option.label}
              </p>
              <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                {BLURB[option.id]}
              </p>
            </button>
          );
        })}
      </div>

      {/* Disclosed only once the question is answered: there is nothing to
          continue to until a kind is picked. */}
      {kind ? (
        <SheetActions>
          <PrimaryAction onClick={onContinue}>See spaces</PrimaryAction>
        </SheetActions>
      ) : null}
    </div>
  );
}
