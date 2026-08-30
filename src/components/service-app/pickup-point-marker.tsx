"use client";

import { FixedMarker } from "@/components/service-app/map-marker";
import { cn } from "@/lib/utils";

/**
 * Confirm-pickup curb. Selected is a FixedMarker (label + needle);
 * alternates stay as xx-small dots so the rider can tap another.
 */
export function PickupPointMarker({
  label,
  selected = false,
  onSelect,
}: {
  label: string;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const inner = selected ? (
    <FixedMarker label={label} kind="accent" size="medium" needle="medium" />
  ) : (
    <FixedMarker kind="accent" size="xx-small-circle" needle="none" />
  );

  const className = cn(
    "relative flex size-11 items-center justify-center overflow-visible",
    onSelect &&
      "focus-visible:ring-ring cursor-pointer rounded-full touch-manipulation focus-visible:ring-2 focus-visible:outline-none",
  );

  if (onSelect) {
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        onClick={onSelect}
        onPointerDown={(event) => event.stopPropagation()}
        className={className}
      >
        {inner}
      </button>
    );
  }

  return (
    <span role="img" aria-label={label} className={className}>
      {inner}
    </span>
  );
}
