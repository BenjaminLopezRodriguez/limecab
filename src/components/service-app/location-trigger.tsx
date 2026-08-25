"use client";

import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Looks like a field. Is a button.
 *
 * Tapping it opens the prepared search scene rather than putting a keyboard
 * on top of the home surface. Home asks *what and where*; search is its own
 * question, with its own scene.
 */
export function LocationTrigger({
  label,
  hint = "Where to?",
  onPress,
  className,
}: {
  /** The chosen address, or empty to show the hint. */
  label?: string;
  hint?: string;
  onPress: () => void;
  className?: string;
}) {
  const empty = !label;

  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        "bg-card ring-border flex h-12 w-full items-center gap-3 rounded-full px-4 text-left text-[15px] ring-1",
        "hover:ring-ring/40",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        "touch-manipulation",
        className,
      )}
    >
      <Search
        className="text-muted-foreground size-4 shrink-0"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <span className={cn("truncate", empty && "text-muted-foreground")}>
        {empty ? hint : label}
      </span>
    </button>
  );
}
