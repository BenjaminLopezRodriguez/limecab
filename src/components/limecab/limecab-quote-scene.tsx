"use client";

import type { ReactNode } from "react";
import {
  ArrowRight01Icon,
  CreditCardIcon,
  Tag01Icon,
} from "@hugeicons/core-free-icons";

import { PrimaryAction } from "@/components/service-app/task-scene";
import { LiveSheetHeader } from "@/components/service-app/live-sheet";
import { SurfaceSkeleton } from "@/components/service-app/surface-skeleton";
import { SheetActions } from "@/components/service-app/service-sheet";
import { DetailLines } from "@/components/limecab/limecab-parts";
import { Icon } from "@/components/ui/icon";
import type { DetailKind } from "@/components/limecab/limecab-interrupts";
import {
  clockTime,
  ridePickupCopy,
  type PaymentMethod,
  type RideProduct,
} from "@/lib/limecab/domain";
import { AVAILABLE_PROMO } from "@/lib/limecab/mock";
import { formatMoney, formatMoneyMetric } from "@/lib/service-app/services";
import { cn } from "@/lib/utils";

/** The fare, everything that changes it, and the one button that commits. */
export function LimeCabQuoteScene({
  ready,
  product,
  quoteMinutes,
  payableCents,
  fareLines,
  pickupLine,
  destinationLine,
  stopLines,
  pickupLabel = "Pickup",
  destinationLabel = "Destination",
  payment,
  promoApplied,
  busy,
  error,
  signedIn,
  signInLabel = "Sign in to request a ride",
  pricingLabel = "Pricing your ride",
  etaLine,
  confirmLabel,
  footnote,
  onEditPickup,
  onOpenDetail,
  onConfirm,
}: {
  ready: boolean;
  product: RideProduct;
  quoteMinutes: number;
  payableCents: number;
  /** The breakdown behind the total, already formatted. */
  fareLines: { label: string; value: string }[];
  pickupLine: string;
  destinationLine: string;
  /** Intermediate stops on the route rail, e.g. a For the Way cafe. */
  stopLines?: string[];
  pickupLabel?: string;
  destinationLabel?: string;
  payment: PaymentMethod;
  promoApplied: boolean;
  busy: boolean;
  error?: string | null;
  /** Booking needs an account; browsing and pricing do not. */
  signedIn: boolean;
  signInLabel?: string;
  pricingLabel?: string;
  /** Overrides the default “dropoff · eta” line. */
  etaLine?: string;
  /** Overrides “Request {product} · price”. */
  confirmLabel?: string;
  footnote?: string;
  onEditPickup: () => void;
  onOpenDetail: (kind: DetailKind) => void;
  onConfirm: () => void;
}) {
  if (!ready) {
    return <SurfaceSkeleton lines={4} showAction label={pricingLabel} />;
  }

  return (
    <div className="flex min-h-full flex-col">
      <LiveSheetHeader
        instruction={product.name}
        secondary={
          etaLine ??
          `${clockTime(product.etaMinutes + quoteMinutes)} dropoff · ${ridePickupCopy(product)}`
        }
        metric={formatMoneyMetric(payableCents)}
        metricAriaLabel={`Total ${formatMoney(payableCents)}`}
      />

      <Itinerary
        className="mt-4"
        pickup={pickupLine}
        destination={destinationLine}
        stops={stopLines}
        pickupLabel={pickupLabel}
        destinationLabel={destinationLabel}
        onEditPickup={onEditPickup}
      />

      <DetailLines className="mt-4" lines={fareLines} />

      <div className="divide-border ring-border mt-4 divide-y rounded-2xl ring-1">
        <SettingRow
          icon={<Icon icon={CreditCardIcon} size={16} />}
          label="Payment"
          value={payment.detail}
          onPress={() => onOpenDetail("payment")}
        />
        <SettingRow
          icon={<Icon icon={Tag01Icon} size={16} />}
          label="Promo"
          value={
            promoApplied
              ? `−${formatMoney(AVAILABLE_PROMO.amountCents)} applied`
              : "Add a code"
          }
          onPress={() => onOpenDetail("promo")}
        />
      </div>

      {error ? (
        <div role="alert" className="mt-4">
          <p className="text-[15px] leading-relaxed font-medium">
            Couldn&apos;t submit your request.
          </p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {error}
          </p>
        </div>
      ) : null}

      <SheetActions>
        <PrimaryAction disabled={busy} onClick={onConfirm}>
          {error
            ? "Try again"
            : signedIn
              ? (confirmLabel ??
                `Request ${product.name} · ${formatMoney(payableCents)}`)
              : signInLabel}
        </PrimaryAction>
        <p className="text-muted-foreground text-center text-xs leading-relaxed">
          {footnote ?? "Fares are estimates. Nothing is charged in this demo."}
        </p>
      </SheetActions>
    </div>
  );
}

/** A settings-style row: what it is now, and that it can be changed. */
function SettingRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={`${label}: ${value}. Change`}
      className="focus-visible:ring-ring active:bg-accent flex min-h-14 w-full items-center gap-3 px-4 text-left first:rounded-t-2xl last:rounded-b-2xl focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className="text-muted-foreground shrink-0 [&_svg]:size-4"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px]">{value}</span>
      <Icon
        icon={ArrowRight01Icon}
        size={16}
        className="text-muted-foreground shrink-0"
        aria-hidden="true"
      />
    </button>
  );
}

/** Pickup → optional stops → destination, same rail language as search. */
function Itinerary({
  pickup,
  destination,
  stops = [],
  pickupLabel = "Pickup",
  destinationLabel = "Destination",
  onEditPickup,
  onEditDestination,
  className,
}: {
  pickup: string;
  destination: string;
  stops?: string[];
  pickupLabel?: string;
  destinationLabel?: string;
  onEditPickup?: () => void;
  onEditDestination?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("bg-muted/60 rounded-2xl p-3", className)}>
      <ItineraryRow
        kind="pickup"
        label={pickupLabel}
        value={pickup}
        onPress={onEditPickup}
      />
      {stops.map((stop, index) => (
        <div key={`${stop}:${index}`}>
          <div
            aria-hidden="true"
            className="border-border ml-[5px] h-4 border-l"
          />
          <ItineraryRow
            kind="stop"
            label={stops.length === 1 ? "Stop" : `Stop ${index + 1}`}
            value={stop}
          />
        </div>
      ))}
      {/* A visit has one address: pickup and destination are the same house,
          and drawing a line from it to itself would invent a journey. */}
      {destination ? (
        <>
          <div
            aria-hidden="true"
            className="border-border ml-[5px] h-4 border-l"
          />
          <ItineraryRow
            kind="destination"
            label={destinationLabel}
            value={destination}
            onPress={onEditDestination}
          />
        </>
      ) : null}
    </div>
  );
}

function ItineraryRow({
  kind,
  label,
  value,
  onPress,
}: {
  kind: "pickup" | "stop" | "destination";
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const body = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "size-2.5 shrink-0",
          kind === "pickup"
            ? "bg-lime rounded-full"
            : kind === "stop"
              ? "border-foreground rounded-full border"
              : "bg-foreground rounded-[3px]",
        )}
      />
      <span className="min-w-0 flex-1 truncate text-sm">
        {value || "Not set"}
      </span>
    </>
  );

  if (!onPress) {
    return (
      <div className="flex items-center gap-3">
        <span className="sr-only">{label}: </span>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={`${label}: ${value}. Change`}
      className="focus-visible:ring-ring flex w-full items-center gap-3 rounded-lg text-left focus-visible:ring-2 focus-visible:outline-none"
    >
      {body}
    </button>
  );
}
