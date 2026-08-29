"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { TIP_PRESETS } from "@/lib/limecab/domain";
import { formatMoney } from "@/lib/service-app/services";
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
      className="text-muted-foreground border-border h-11 w-full rounded-full border text-sm font-normal"
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

/** Flat tip amounts. Percentages make the rider do arithmetic to be kind. */
export function TipPanel({
  value,
  onTip,
}: {
  value: number | null;
  onTip: (next: number | null) => void;
}) {
  return (
    <div className="bg-muted/60 rounded-2xl p-4">
      <p className="text-[15px] font-medium tracking-tight">
        {value ? "Tip added to your total" : "Add a tip?"}
      </p>
      <div className="mt-3 flex gap-2">
        {TIP_PRESETS.map((amount) => {
          const selected = value === amount;
          return (
            <button
              key={amount}
              type="button"
              aria-pressed={selected}
              onClick={() => onTip(selected ? null : amount)}
              className={cn(
                "ring-border focus-visible:ring-ring h-12 flex-1 rounded-full text-[15px] font-semibold tabular-nums ring-1 focus-visible:ring-2 focus-visible:outline-none",
                selected
                  ? "bg-accent ring-foreground text-foreground ring-2"
                  : "bg-card active:bg-accent",
              )}
            >
              {formatMoney(amount)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
