"use client";

import { FixedMarker } from "@/components/service-app/map-marker";
import { cn } from "@/lib/utils";

/**
 * Confirm-pickup curb. Selected is a FixedMarker (spot name + needle);
 * the street sits in the label enhancer when it differs. Alternates stay
 * as xx-small dots so the rider can tap another.
 */
export function PickupPointMarker({
  label,
  detail,
  selected = false,
  onSelect,
}: {
  label: string;
  detail?: string;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const street =
    detail && detail.trim() !== label.trim() ? detail.trim() : undefined;
  const inner = selected ? (
    <FixedMarker
      label={label}
      labelEnhancerContent={street}
      labelEnhancerPosition="top"
      kind="accent"
      size="medium"
      needle="medium"
    />
  ) : (
    <FixedMarker kind="accent" size="xx-small-circle" needle="none" />
  );

  const className = cn(
    "relative overflow-visible",
    selected
      ? "inline-flex flex-col items-center px-3 pt-3"
      : "flex size-11 items-center justify-center",
    onSelect &&
      "focus-visible:ring-ring cursor-pointer rounded-full touch-manipulation focus-visible:ring-2 focus-visible:outline-none",
  );

  if (onSelect) {
    return (
      <button
        type="button"
        aria-label={street ? `${label}, ${street}` : label}
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
    <span
      role="img"
      aria-label={street ? `${label}, ${street}` : label}
      className={className}
    >
      {inner}
    </span>
  );
}
