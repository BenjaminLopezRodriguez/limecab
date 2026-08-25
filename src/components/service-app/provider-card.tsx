"use client";

import type { ReactNode } from "react";
import { Star, User } from "lucide-react";

import type { Provider } from "@/lib/service-app/services";
import { cn } from "@/lib/utils";

/**
 * ProviderCard — who is doing the work.
 *
 * A driver, a courier, a technician, a guard, a carrier. The component takes
 * a `Provider` and slots; it never inspects an id and never names a vertical.
 * `detail` is whatever identifies them in this product — a plate, a
 * certification level, a vehicle.
 */
export function ProviderCard({
  provider,
  eta,
  actions,
  compact = false,
  className,
}: {
  provider: Provider;
  /** Short status line, e.g. an ETA phrase supplied by the app. */
  eta?: string | null;
  /** Contact affordances: call, message, share. */
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card ring-border flex items-center gap-3 rounded-2xl ring-1",
        compact ? "p-3" : "p-4",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "bg-accent text-muted-foreground flex shrink-0 items-center justify-center overflow-hidden rounded-full",
          compact ? "size-10" : "size-12",
        )}
      >
        {provider.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={provider.avatarUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <User className="size-5" strokeWidth={1.7} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium tracking-tight">
          {provider.name}
        </p>
        {provider.detail ? (
          <p className="text-muted-foreground truncate text-sm">
            {provider.detail}
          </p>
        ) : null}
        {eta ? (
          <p className="text-muted-foreground mt-0.5 text-sm tabular-nums">
            {eta}
          </p>
        ) : null}
      </div>

      {typeof provider.rating === "number" ? (
        <span
          className="text-muted-foreground flex shrink-0 items-center gap-1 text-sm tabular-nums"
          aria-label={`Rated ${provider.rating.toFixed(1)} out of 5`}
        >
          <Star className="size-3.5" strokeWidth={2} aria-hidden="true" />
          {provider.rating.toFixed(1)}
        </span>
      ) : null}

      {actions ? <div className="flex shrink-0 gap-1">{actions}</div> : null}
    </div>
  );
}
