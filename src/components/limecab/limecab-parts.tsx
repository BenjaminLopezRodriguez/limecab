"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The affordance that discloses a detail surface. Never the primary action. */
export function DetailButton({
  onPress,
  children,
}: {
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      className="text-muted-foreground border-border h-11 w-full rounded-xl border text-sm font-normal"
      onClick={onPress}
    >
      {children}
    </Button>
  );
}

/** A label/value ledger. Amounts share precision so the column reads. */
export function DetailLines({
  lines,
  footnote,
  className,
}: {
  lines: { label: string; value: string; strong?: boolean }[];
  footnote?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dl className="flex flex-col gap-2.5">
        {lines.map((row) => (
          <div
            key={row.label}
            className={cn(
              "flex items-baseline gap-3 text-sm",
              row.strong && "border-border mt-1 border-t pt-3",
            )}
          >
            <dt
              className={cn(
                "text-muted-foreground",
                row.strong && "text-foreground font-medium",
              )}
            >
              {row.label}
            </dt>
            <dd
              className={cn(
                "ml-auto tabular-nums",
                row.strong && "text-[15px] font-medium",
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {footnote ? (
        <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
          {footnote}
        </p>
      ) : null}
    </div>
  );
}
