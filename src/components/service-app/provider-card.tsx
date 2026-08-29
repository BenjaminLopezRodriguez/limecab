"use client";

import type { ReactNode } from "react";
import { StarIcon } from "@hugeicons/core-free-icons";

import { Icon } from "@/components/ui/icon";
import type { Provider } from "@/lib/service-app/services";
import { cn } from "@/lib/utils";

/**
 * ProviderCard — who is doing the work.
 *
 * A driver, a courier, a technician, a guard, a carrier. The component takes
 * a `Provider` and slots; it never inspects an id and never names a vertical.
 * `detail` is whatever identifies them in this product — a plate, a
 * certification level, a vehicle. `badge` is the single hardest-working
 * identifier, sized to be read at arm's length: a plate, a unit number.
 *
 * No avatar image is required — initials are composed, never downloaded.
 */
export function ProviderCard({
  provider,
  eta,
  badge,
  actions,
  compact = false,
  prominent = false,
  className,
}: {
  provider: Provider;
  /** Short status line, e.g. an ETA phrase supplied by the app. */
  eta?: string | null;
  /** The glanceable identifier, rendered large beneath the detail line. */
  badge?: ReactNode;
  /** Contact affordances: call, message, share. */
  actions?: ReactNode;
  compact?: boolean;
  /** In-car: the driver is the subject, not a footnote under status copy. */
  prominent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card ring-border rounded-2xl ring-1",
        compact ? "p-3" : prominent ? "p-5" : "p-4",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "bg-accent text-accent-foreground flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold tracking-tight",
            compact
              ? "size-10 text-sm"
              : prominent
                ? "size-16 text-[22px]"
                : "size-12 text-[17px]",
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
            initials(provider.name)
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate leading-tight font-semibold tracking-tight",
              prominent ? "text-[19px]" : "text-[17px]",
            )}
          >
            {provider.name}
          </p>
          {typeof provider.rating === "number" ? (
            <span
              className="text-muted-foreground mt-0.5 flex items-center gap-1 text-sm tabular-nums"
              aria-label={`Rated ${provider.rating.toFixed(1)} out of 5`}
            >
              <Icon
                icon={StarIcon}
                size={14}
                className="text-lime"
                aria-hidden="true"
              />
              {provider.rating.toFixed(1)}
            </span>
          ) : null}
          {eta ? (
            <p className="text-muted-foreground mt-0.5 text-sm tabular-nums">
              {eta}
            </p>
          ) : null}
        </div>

        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </div>

      {provider.detail || badge ? (
        <div className="border-border mt-3 flex items-center justify-between gap-3 border-t pt-3">
          {provider.detail ? (
            <p className="min-w-0 flex-1 truncate text-[15px] leading-tight font-medium tracking-tight">
              {provider.detail}
            </p>
          ) : (
            <span />
          )}
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Up to two initials from a display name. */
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
