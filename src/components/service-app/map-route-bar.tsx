"use client";

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * Compact itinerary over the canvas. Origin → destination is a summary of a
 * decision already made; tapping it returns to the search scene to revise.
 */
export function MapRouteBar({
  origin,
  destination,
  onBack,
  onEdit,
  className,
}: {
  origin: string;
  destination: string;
  onBack?: () => void;
  onEdit?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card ring-border absolute top-3 right-3 left-3 z-10 flex h-11 items-center rounded-full shadow-[0_4px_16px_rgba(26,24,20,0.12)] ring-1",
        onBack ? "pr-3 pl-0.5" : "px-3",
        className,
      )}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="hover:bg-accent/50 active:bg-accent focus-visible:ring-ring inline-flex size-11 shrink-0 items-center justify-center rounded-full touch-manipulation focus-visible:ring-2 focus-visible:outline-none"
        >
          <Icon icon={ArrowLeft01Icon} size={20} />
          <span className="sr-only">Back</span>
        </button>
      ) : null}

      <RouteSummary
        origin={origin}
        destination={destination}
        onEdit={onEdit}
      />
    </div>
  );
}

function RouteSummary({
  origin,
  destination,
  onEdit,
}: {
  origin: string;
  destination: string;
  onEdit?: () => void;
}) {
  const body = (
    <>
      <span className="text-muted-foreground min-w-0 max-w-[46%] truncate">
        {origin}
      </span>
      <Icon
        icon={ArrowRight01Icon}
        size={14}
        className="text-muted-foreground shrink-0"
        aria-hidden="true"
      />
      <span className="min-w-0 max-w-[46%] truncate font-medium">
        {destination}
      </span>
    </>
  );

  if (!onEdit) {
    return (
      <p className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-1 text-sm">
        {body}
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Route: ${origin} to ${destination}. Edit`}
      className="hover:bg-accent/50 active:bg-accent focus-visible:ring-ring flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-1 text-sm touch-manipulation focus-visible:ring-2 focus-visible:outline-none"
    >
      {body}
    </button>
  );
}
