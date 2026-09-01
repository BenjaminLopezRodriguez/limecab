"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The three-band live sheet: instruction + metric, identity, thumb dock.
 *
 * After a request is committed, every sheet answers the same way a curb
 * does — what to do now, the number that matters, who to look for, then
 * the things a thumb can reach. Product copy and identifiers are slots;
 * this file does not name a vertical.
 */

/**
 * Two-digit ETA countdown only (0–99). Never a price, never a sentence,
 * never a unit inside the tile — minutes live in the aria label.
 */
export type LiveMetricValue = {
  value: string;
};

/** Band 1 — what to do, and the number that answers when. */
export function LiveSheetHeader({
  instruction,
  secondary,
  chip,
  metric,
  metricAriaLabel,
  trailing,
  className,
}: {
  instruction: string;
  secondary?: ReactNode;
  /** Compact identifier that sits with the secondary line — a PIN, a code. */
  chip?: ReactNode;
  /** Compact tile: one or two digits. Omit when there is none. */
  metric?: LiveMetricValue | null;
  metricAriaLabel?: string;
  /** Replaces the metric — a search control, a chip, anything glanceable. */
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] leading-snug font-semibold tracking-tight text-balance">
          {instruction}
        </h2>
        {secondary || chip ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {secondary ? (
              <div className="text-muted-foreground min-w-0 text-sm leading-snug">
                {secondary}
              </div>
            ) : null}
            {chip}
          </div>
        ) : null}
      </div>
      {trailing ??
        (metric?.value ? (
          <LiveMetric value={metric.value} ariaLabel={metricAriaLabel} />
        ) : null)}
    </div>
  );
}

/** Lime square ETA countdown: at most two digits, black on brand lime. */
export function LiveMetric({
  value,
  ariaLabel,
  className,
}: {
  value: string;
  ariaLabel?: string;
  className?: string;
}) {
  const digits = value.replace(/\D/g, "").slice(0, 2) || value.slice(0, 2);
  return (
    <p
      aria-label={ariaLabel ?? digits}
      className={cn(
        "bg-lime text-lime-foreground flex size-12 shrink-0 items-center justify-center rounded-xl text-center text-[22px] leading-none font-semibold tracking-tight tabular-nums",
        className,
      )}
    >
      {digits}
    </p>
  );
}

/** Band 2 — who to look for. The badge is the glanceable identifier. */
export function LiveSheetIdentity({
  name,
  badge,
  detail,
  visual,
  className,
}: {
  name: string;
  /** Plate, unit number, anything scanned at arm's length. */
  badge?: ReactNode;
  detail?: string;
  visual?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {visual}
      <div className="min-w-0 flex-1">
        {badge ? <div>{badge}</div> : null}
        <p
          className={cn(
            "text-muted-foreground truncate text-sm",
            badge && "mt-1",
          )}
        >
          {name}
        </p>
        {detail ? (
          <p className="text-muted-foreground mt-0.5 truncate text-sm">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Band 3 — thumb zone. Every control shares one fill; destinations stay honest. */
export function LiveSheetDock({
  message,
  onMessage,
  actions,
  className,
}: {
  message?: string;
  onMessage?: () => void;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {onMessage ? (
        <button
          type="button"
          onClick={onMessage}
          className="bg-muted text-muted-foreground focus-visible:ring-ring active:bg-accent h-12 min-w-0 flex-1 rounded-full px-4 text-left text-[15px] focus-visible:ring-2 focus-visible:outline-none"
        >
          {message ?? "Send a message"}
        </button>
      ) : null}
      {actions}
    </div>
  );
}
