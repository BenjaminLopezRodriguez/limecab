"use client";

import { useMemo, useState } from "react";

import { SheetActions } from "@/components/service-app/service-sheet";
import { PrimaryAction } from "@/components/service-app/task-scene";
import {
  formatPickupClock,
  upcomingHalfHours,
} from "@/lib/limecab/reserve";
import { cn } from "@/lib/utils";

/**
 * One question: when?
 *
 * Reserve asks it about a pickup, Lime Help about a visit. Same clock — the
 * copy and the list of legal times come in, so there is one half-hour picker
 * and not two.
 */
export function LimeCabWhenScene({
  value,
  onChange,
  onContinue,
  title = "When do you want to be picked up?",
  description = "Today or tomorrow, next half-hours. Not a calendar.",
  action = "See price",
  slotsFor = (day) => upcomingHalfHours(day),
  emptyDayNote = "No times left today. Try tomorrow.",
}: {
  value: Date | null;
  onChange: (next: Date) => void;
  onContinue: () => void;
  title?: string;
  description?: string;
  action?: string;
  /** Which instants this service will actually accept for that day. */
  slotsFor?: (day: "today" | "tomorrow") => Date[];
  emptyDayNote?: string;
}) {
  const [day, setDay] = useState<"today" | "tomorrow">("today");
  const slots = useMemo(() => slotsFor(day), [day, slotsFor]);

  return (
    <div className="flex min-h-full flex-col">
      <h2 className="text-[17px] font-medium tracking-tight">{title}</h2>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        {description}
      </p>

      <div className="bg-accent mt-5 flex gap-1 rounded-xl p-1" role="group">
        {(["today", "tomorrow"] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            aria-pressed={day === entry}
            onClick={() => setDay(entry)}
            className={cn(
              "focus-visible:ring-ring min-h-11 flex-1 rounded-lg text-sm font-medium capitalize",
              "focus-visible:ring-2 focus-visible:outline-none",
              day === entry
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground",
            )}
          >
            {entry}
          </button>
        ))}
      </div>

      {slots.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
          {emptyDayNote}
        </p>
      ) : null}

      <ul className="mt-3 flex flex-col gap-1">
        {slots.map((slot) => {
          const selected = value?.getTime() === slot.getTime();
          return (
            <li key={slot.toISOString()}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(slot)}
                className={cn(
                  "focus-visible:ring-ring flex min-h-12 w-full items-center rounded-xl px-4 text-left text-[15px]",
                  "focus-visible:ring-2 focus-visible:outline-none",
                  selected ? "bg-accent font-medium" : "hover:bg-accent/60",
                )}
              >
                {formatPickupClock(slot)}
              </button>
            </li>
          );
        })}
      </ul>

      {value ? (
        <SheetActions>
          <PrimaryAction onClick={onContinue}>{action}</PrimaryAction>
        </SheetActions>
      ) : (
        <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
          Pick a time to continue.
        </p>
      )}
    </div>
  );
}
