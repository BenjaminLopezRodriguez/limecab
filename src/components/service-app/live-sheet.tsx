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

/** Stacked numeral + unit. Callers pass a short number, never a sentence. */
export type LiveMetricValue = {
  value: string;
  unit?: string;
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
  /** Compact tile: a short number and optional unit. Omit when there is none. */
  metric?: LiveMetricValue | null;
  metricAriaLabel?: string;
  /** Replaces the metric — a search control, a chip, anything glanceable. */
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">
        <h2 className="text-[17px] leading-snug font-semibold tracking-tight text-balance">
          {instruction}
        </h2>
        {secondary || chip ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {secondary ? (
              <div className="text-muted-foreground min-w-0 text-sm leading-relaxed">
                {secondary}
              </div>
            ) : null}
            {chip}
          </div>
        ) : null}
      </div>
      {trailing ??
        (metric?.value ? (
          <LiveMetric
            value={metric.value}
            unit={metric.unit}
            ariaLabel={metricAriaLabel}
          />
        ) : null)}
    </div>
  );
}

/** Highest-contrast object on the sheet: the answer, not a caption. */
export function LiveMetric({
  value,
  unit,
  ariaLabel,
  className,
}: {
  value: string;
  unit?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const spoken = ariaLabel ?? (unit ? `${value} ${unit}` : value);
  return (
    <p
      aria-label={spoken}
      className={cn(
        "bg-foreground text-background flex size-20 shrink-0 flex-col items-center justify-center rounded-2xl text-center font-semibold tracking-tight tabular-nums",
        className,
      )}
    >
      <span
        className={cn(
          "leading-none",
          value.length <= 2 ? "text-[32px]" : "text-[26px]",
        )}
      >
        {value}
      </span>
      {unit ? (
        <span className="mt-0.5 text-[11px] leading-none font-medium tracking-wide">
          {unit}
        </span>
      ) : null}
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
