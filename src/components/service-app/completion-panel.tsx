"use client";

import type { ReactNode } from "react";

import { LiveSheetHeader } from "@/components/service-app/live-sheet";
import { formatMoney, formatMoneyMetric } from "@/lib/service-app/services";
import { cn } from "@/lib/utils";

/**
 * CompletionPanel — "What happened?"
 *
 * Results first. The headline and the outcome come before any control,
 * because the user's question on arrival is what they got, not what to do
 * next. Rebook, rate, and support live in `actions`, below the fold of
 * attention.
 */
export function CompletionPanel({
  headline,
  summary,
  lines,
  totalCents,
  totalLabel = "Total",
  currency = "USD",
  detail,
  actions,
  className,
}: {
  headline: string;
  summary?: string;
  /** Receipt lines: label/value pairs the app has already formatted. */
  lines?: { label: string; value: string }[];
  totalCents?: number;
  totalLabel?: string;
  currency?: string;
  /** Slot between the summary and the receipt — a rating prompt, a map thumb. */
  detail?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col", className)}>
      <LiveSheetHeader
        instruction={headline}
        secondary={summary}
        metric={
          typeof totalCents === "number" ? formatMoneyMetric(totalCents, currency) : null
        }
        metricAriaLabel={
          typeof totalCents === "number"
            ? `${totalLabel} ${formatMoney(totalCents, currency)}`
            : undefined
        }
      />

      {detail ? <div className="mt-5">{detail}</div> : null}

      {lines && lines.length > 0 ? (
        <dl className="mt-5 flex flex-col gap-2">
          {lines.map((line) => (
            <div key={line.label} className="flex items-baseline gap-3">
              <dt className="text-muted-foreground text-sm">{line.label}</dt>
              <dd className="ml-auto text-sm tabular-nums">{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {actions ? <div className="mt-6 flex flex-col gap-2">{actions}</div> : null}
    </section>
  );
}
