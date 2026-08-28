"use client";

import { useMemo, type ReactNode } from "react";
import {
  ArrowRight01Icon,
  Car01Icon,
  CreditCardIcon,
  SparklesIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";

import { PrimaryAction } from "@/components/service-app/task-scene";
import { SheetActions } from "@/components/service-app/service-sheet";
import { Icon } from "@/components/ui/icon";
import {
  clockTime,
  type PaymentMethod,
  type Pickup,
  type RideProduct,
} from "@/lib/limecab/domain";
import { IMMEDIATE_RIDE_PRODUCTS, quoteFor } from "@/lib/limecab/mock";
import { formatMoney, type Location } from "@/lib/service-app/services";
import { cn } from "@/lib/utils";

const PRODUCT_ICON: Record<string, ReactNode> = {
  lime: <Icon icon={Car01Icon} size={24} />,
  "lime-xl": <Icon icon={UserGroupIcon} size={24} />,
  "lime-comfort": <Icon icon={SparklesIcon} size={24} />,
  "lime-pool": <Icon icon={UserGroupIcon} size={24} />,
};

const UNAVAILABLE = "Not in your city yet";

type PricedRide = {
  product: RideProduct;
  totalCents: number;
  badge: string | null;
};

/** The comparison scene: every tier, priced against the same route. */
export function LimeCabRideSelectScene({
  pickup,
  destination,
  estimate,
  product,
  payment,
  onSelect,
  onConfirm,
  onOpenPayment,
}: {
  pickup: Pickup;
  destination: Location | null;
  estimate: { miles: number; minutes: number } | null;
  product: RideProduct | null;
  payment: PaymentMethod;
  onSelect: (option: RideProduct) => void;
  onConfirm: () => void;
  onOpenPayment: () => void;
}) {
  const rides = useMemo<PricedRide[]>(() => {
    if (!destination) return [];
    const priced = IMMEDIATE_RIDE_PRODUCTS.map((entry) => ({
      product: entry,
      totalCents: quoteFor(entry, pickup, destination).fare.totalCents,
    }));

    // The two comparisons riders actually make, taken from the data rather
    // than decided in advance. Marking them is the whole reason the tiers sit
    // in one list instead of behind a picker.
    const sellable = priced.filter((row) => row.product.status === "available");
    const cheapest = best(sellable, (row) => row.totalCents);
    const fastest = best(sellable, (row) => row.product.etaMinutes);

    return priced.map((row) => ({
      ...row,
      badge:
        row === fastest && row !== cheapest
          ? "Fastest"
          : row === cheapest
            ? "Cheapest"
            : null,
    }));
  }, [destination, pickup]);

  const selected = rides.find((row) => row.product.id === product?.id) ?? null;
  const ready = selected?.product.status === "available";

  return (
    <>
      <h2 className="font-heading text-[22px] font-semibold tracking-[-0.02em]">
        Choose a ride
      </h2>

      <ul className="-mx-5 mt-4 flex flex-col md:-mx-6">
        {rides.map((row) => (
          <li key={row.product.id}>
            <RideRow
              ride={row}
              tripMinutes={estimate?.minutes ?? 0}
              selected={row.product.id === product?.id}
              onSelect={() => onSelect(row.product)}
            />
          </li>
        ))}
      </ul>

      {ready && selected ? (
        <SheetActions>
          <button
            type="button"
            onClick={onOpenPayment}
            aria-label={`Payment: ${payment.detail}. Change`}
            className="focus-visible:ring-ring flex min-h-11 w-full items-center gap-3 rounded-xl text-left focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
          >
            <Icon
              icon={CreditCardIcon}
              size={16}
              className="text-muted-foreground shrink-0"
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-sm">
              {payment.detail}
            </span>
            <Icon
              icon={ArrowRight01Icon}
              size={16}
              className="text-muted-foreground shrink-0"
              aria-hidden="true"
            />
          </button>
          <PrimaryAction onClick={onConfirm}>
            {`Confirm ${selected.product.name} · ${formatMoney(selected.totalCents)}`}
          </PrimaryAction>
        </SheetActions>
      ) : null}
    </>
  );
}

/** One tier: what it is, when it gets there, what it costs. */
function RideRow({
  ride,
  tripMinutes,
  selected,
  onSelect,
}: {
  ride: PricedRide;
  tripMinutes: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { product, badge, totalCents } = ride;
  const available = product.status === "available";
  const dropoff = clockTime(product.etaMinutes + tripMinutes);
  const detail = available
    ? `${product.etaMinutes} min away · ${dropoff} dropoff`
    : UNAVAILABLE;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={
        available
          ? `${product.name}. ${product.description}. ${product.seats} seats. ${detail}. ${formatMoney(totalCents)}.${badge ? ` ${badge}.` : ""}`
          : `${product.name}. ${UNAVAILABLE}.`
      }
      className={cn(
        "relative flex w-full items-center gap-3 overflow-hidden px-5 py-3 text-left md:px-6",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
        selected
          ? "bg-accent before:bg-foreground before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']"
          : "hover:bg-accent/60 active:bg-accent",
        !available && "opacity-60",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-2xl [&_svg]:size-6",
          selected
            ? "bg-lime text-lime-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {PRODUCT_ICON[product.id]}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[17px] font-semibold tracking-tight">
            {product.name}
          </span>
          <span
            aria-hidden="true"
            className="text-muted-foreground flex shrink-0 items-center gap-0.5 text-xs tabular-nums"
          >
            <Icon icon={UserGroupIcon} size={14} />
            {product.seats}
          </span>
          {badge && available ? (
            <span className="bg-lime text-lime-foreground shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="text-muted-foreground mt-0.5 block truncate text-sm tabular-nums">
          {detail}
        </span>
      </span>

      {available ? (
        <span className="shrink-0 text-[17px] font-semibold tabular-nums">
          {formatMoney(totalCents)}
        </span>
      ) : null}
    </button>
  );
}

/** Lowest scoring row, or null for an empty list. */
function best<T>(rows: T[], score: (row: T) => number): T | null {
  return rows.reduce<T | null>(
    (winner, row) =>
      winner === null || score(row) < score(winner) ? row : winner,
    null,
  );
}
