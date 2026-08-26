"use client";

import { Search01Icon } from "@hugeicons/core-free-icons";

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
}: {
  /** The chosen address, or empty to show the hint. */
  label?: string;
  hint?: string;
  onPress: () => void;
  /** "lg" is the primary affordance of a launcher screen. */
  size?: "md" | "lg";
  className?: string;
}) {
  const empty = !label;
  const large = size === "lg";

  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        "bg-muted flex w-full items-center gap-3 rounded-full text-left",
        large
          ? "h-14 px-5 text-[17px] font-semibold tracking-tight"
          : "h-12 px-4 text-[15px]",
        "hover:ring-ring/40",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        "touch-manipulation",
        className,
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
  );
}
