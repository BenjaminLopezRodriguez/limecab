"use client";

import type { ReactNode } from "react";

import { PrimaryAction } from "@/components/service-app/task-scene";
import { Separator } from "@/components/ui/separator";
import { formatMoney, splitAddress, type Quote } from "@/lib/service-app/services";

/**
 * "Do you want to request this?" — one question, one primary action.
 *
 * The app owns pricing, payment, and the request call. This renders the
 * decision and hands the tap back through `onConfirm`, which should run
 * through `surface.transition({ intent: "progress", task })` so the
 * confirmation is acknowledged immediately and the request runs under the
 * transition.
 */
export function QuotePanel({
  title,
  address,
  quote,
  confirmLabel,
  busy = false,
  error,
  disabled = false,
  footnote,
  extra,
  onConfirm,
}: {
  title: string;
  address?: string;
  quote: Quote;
  /** Defaults to "Request · $total". */
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
  disabled?: boolean;
  footnote?: ReactNode;
  /** Slot between the price lines and the action — promo codes, payment method. */
  extra?: ReactNode;
  onConfirm: () => void;
}) {
  const { line, locality } = splitAddress(address ?? "");
  const total = formatMoney(quote.totalCents, quote.currency);

  return (
    <div>
      <h2 className="text-[17px] font-medium tracking-tight">{title}</h2>
      {line ? <p className="mt-1 text-[15px] tracking-tight">{line}</p> : null}
      {locality ? (
        <p className="text-muted-foreground text-sm">{locality}</p>
      ) : null}

      <dl className="mt-5 space-y-2.5 text-sm">
        {quote.lines.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="tabular-nums">{row.value}</dd>
          </div>
        ))}
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="font-medium">Estimated total</dt>
          <dd className="font-medium tabular-nums">{total}</dd>
        </div>
      </dl>

      {extra ? <div className="mt-5">{extra}</div> : null}

      {error ? (
        <div role="alert" className="mt-5">
          <p className="text-[15px] leading-relaxed font-medium">
            Couldn&apos;t submit your request.
          </p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {error}
          </p>
        </div>
      ) : null}

      <PrimaryAction
        className="mt-5"
        disabled={busy || disabled}
        onClick={onConfirm}
      >
        {error ? "Try again" : (confirmLabel ?? `Request · ${total}`)}
      </PrimaryAction>

      {footnote ? (
        <p className="text-muted-foreground mt-3 text-center text-xs leading-relaxed">
          {footnote}
        </p>
      ) : null}
    </div>
  );
}
