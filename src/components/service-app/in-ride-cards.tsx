"use client";

import type { ReactNode } from "react";
import {
  Message01Icon,
  MoreHorizontalIcon,
  Share05Icon,
  StarIcon,
} from "@hugeicons/core-free-icons";

import { TipPanel } from "@/components/limecab/limecab-parts";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/** Rounded card container for stacked in-ride surfaces. */
export function InRideCard({
  children,
  className,
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "banner";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-3",
        variant === "banner"
          ? "bg-accent/80 text-accent-foreground"
          : "bg-muted/60",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function InRideHeadline({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "text-center text-[15px] leading-snug font-semibold tracking-tight text-balance",
        className,
      )}
    >
      {children}
    </h2>
  );
}

/** Prominent share CTA — sits above trip summary during live rides. */
export function ShareLocationBanner({
  label,
  onShare,
}: {
  label: string;
  onShare?: () => void;
}) {
  return (
    <InRideCard variant="banner" className="flex items-center gap-3">
      <Icon icon={Share05Icon} size={20} aria-hidden="true" />
      <span className="min-w-0 flex-1 text-[15px] font-semibold tracking-tight">
        {label}
      </span>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="bg-background/20 hover:bg-background/30 h-9 shrink-0 rounded-full px-4"
        onClick={onShare}
      >
        Share
      </Button>
    </InRideCard>
  );
}

/** Product label + destination headline; overflow opens ride details. */
export function TripSummaryCard({
  productLabel,
  title,
  onOptions,
}: {
  productLabel: string;
  title: string;
  onOptions?: () => void;
}) {
  return (
    <InRideCard className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs tracking-tight">
          {productLabel}
        </p>
        <p className="mt-0.5 truncate text-[15px] font-semibold tracking-tight">
          {title}
        </p>
      </div>
      <button
        type="button"
        onClick={onOptions}
        aria-label="Ride options"
        className="bg-background text-muted-foreground focus-visible:ring-ring inline-flex size-9 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
      >
        <Icon icon={MoreHorizontalIcon} size={18} />
      </button>
    </InRideCard>
  );
}

/** Driver identity + optional inline tip + message entry. */
export function DriverTipCard({
  name,
  rating,
  plate,
  vehicleLine,
  tipCents,
  onTipChange,
  onMessage,
  onOptions,
  showTip,
  tipNote = "We'll deliver your tip after the ride.",
}: {
  name: string;
  rating: number;
  plate: string;
  vehicleLine: string;
  tipCents: number | null;
  onTipChange?: (next: number | null) => void;
  onMessage?: () => void;
  onOptions?: () => void;
  showTip?: boolean;
  tipNote?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <InRideCard className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative shrink-0">
            <span
              aria-hidden="true"
              className="bg-accent text-accent-foreground flex size-12 items-center justify-center rounded-full text-[17px] font-semibold"
            >
              {initial}
            </span>
            <span className="bg-card ring-border absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums ring-1">
              <Icon icon={StarIcon} size={10} className="text-lime" />
              {rating.toFixed(2)}
            </span>
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-tight">
              {showTip ? `Tip ${name}?` : name}
            </p>
            <p className="text-muted-foreground mt-0.5 truncate text-sm">
              {vehicleLine}
            </p>
            <p className="mt-0.5 text-[20px] leading-none font-semibold tracking-[0.12em] tabular-nums">
              {plate}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOptions}
          aria-label="Driver options"
          className="bg-background text-muted-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-full"
        >
          <Icon icon={MoreHorizontalIcon} size={18} />
        </button>
      </div>

      {showTip && onTipChange ? (
        <>
          <div className="flex flex-wrap gap-2">
            <span className="bg-lime/15 text-foreground inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold">
              Choose tip
            </span>
          </div>
          <TipPanel value={tipCents} onTip={onTipChange} />
          <p className="text-muted-foreground -mt-1 text-xs leading-relaxed">
            {tipNote}
          </p>
        </>
      ) : null}

      {onMessage ? (
        <Button
          type="button"
          variant="secondary"
          className="h-11 w-full rounded-full"
          onClick={onMessage}
        >
          <Icon icon={Message01Icon} size={18} aria-hidden="true" />
          Message
        </Button>
      ) : null}
    </InRideCard>
  );
}
