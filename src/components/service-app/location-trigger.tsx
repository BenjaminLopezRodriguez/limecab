"use client";

import { Search01Icon } from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
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
  size = "md",
  className,
  end,
}: {
  /** The chosen address, or empty to show the hint. */
  label?: string;
  hint?: string;
  onPress: () => void;
  /** "lg" is the primary affordance of a launcher screen. */
  size?: "md" | "lg";
  className?: string;
  /** Trailing control (mic). Sibling of the search tap, never nested in it. */
  end?: ReactNode;
}) {
  const empty = !label;
  const large = size === "lg";

  return (
    <div
      className={cn(
        "bg-card border-border flex w-full items-center rounded-full border",
        "shadow-[0_4px_16px_rgba(26,24,20,0.12)]",
        large ? "h-14 pl-5" : "h-12 pl-4",
        end ? "pr-1.5" : large ? "pr-5" : "pr-4",
        className,
      )}
    >
      <button
        type="button"
        onClick={onPress}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 text-left",
          large ? "h-14 text-[17px] font-semibold tracking-tight" : "h-12 text-[15px]",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          "touch-manipulation",
        )}
      >
        <Icon
          icon={Search01Icon}
          size={large ? 20 : 16}
          className="text-lime shrink-0"
          aria-hidden="true"
        />
        <span className={cn("truncate", empty && "text-muted-foreground")}>
          {empty ? hint : label}
        </span>
      </button>
      {end}
    </div>
  );
}
