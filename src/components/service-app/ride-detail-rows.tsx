"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Trailing pill for ride-details action rows. */
export function RideDetailPill({
  label,
  onPress,
  className,
}: {
  label: string;
  onPress?: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={cn("h-9 shrink-0 rounded-full px-4", className)}
      onClick={onPress}
    >
      {label}
    </Button>
  );
}

export function RideDetailDivider() {
  return <div className="bg-border h-px" />;
}

/** Icon + copy + optional trailing action — Uber ride-details rows. */
export function RideDetailRow({
  icon,
  title,
  subtitle,
  trailing,
  link,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  link?: { label: string; onPress?: () => void };
  onPress?: () => void;
}) {
  const body = (
    <>
      <span
        aria-hidden="true"
        className="text-muted-foreground inline-flex size-7 shrink-0 items-center justify-center"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold tracking-tight">
          {title}
        </span>
        {subtitle ? (
          <span className="text-muted-foreground mt-0.5 block text-sm">
            {subtitle}
          </span>
        ) : null}
        {link ? (
          <button
            type="button"
            onClick={link.onPress}
            className="text-muted-foreground mt-2 inline-flex items-center gap-1 text-sm"
          >
            {link.label}
            <span aria-hidden="true">›</span>
          </button>
        ) : null}
      </span>
      {trailing}
    </>
  );

  if (onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        className="flex w-full items-center gap-3 py-4 text-left"
      >
        {body}
      </button>
    );
  }

  return <div className="flex items-center gap-3 py-4">{body}</div>;
}
