"use client";

import type { ReactNode } from "react";
import {
  ArrowRight01Icon,
  CreditCardIcon,
  Tag01Icon,
} from "@hugeicons/core-free-icons";

import { PrimaryAction } from "@/components/service-app/task-scene";
import { SurfaceSkeleton } from "@/components/service-app/surface-skeleton";
import { SheetActions } from "@/components/service-app/service-sheet";
import { DetailLines } from "@/components/limecab/limecab-parts";
import { Icon } from "@/components/ui/icon";
import type { DetailKind } from "@/components/limecab/limecab-interrupts";
import {
  clockTime,
  type PaymentMethod,
  type RideProduct,
} from "@/lib/limecab/domain";
import { AVAILABLE_PROMO } from "@/lib/limecab/mock";
import { formatMoney } from "@/lib/service-app/services";
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
  onEditPickup: () => void;
  onOpenDetail: (kind: DetailKind) => void;
  onConfirm: () => void;
}) {
  if (!ready) {
    return <SurfaceSkeleton lines={4} showAction label={pricingLabel} />;
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-medium tracking-tight">
            {product.name}
          </h2>
          <p className="text-muted-foreground text-sm tabular-nums">
            {etaLine ??
              `${clockTime(product.etaMinutes + quoteMinutes)} dropoff · ${product.etaMinutes} min away`}
          </p>
        </div>
        <p className="shrink-0 text-[28px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
          {formatMoney(payableCents)}
        </p>
      </div>

      <Itinerary
        className="mt-4"
        pickup={pickupLine}
        destination={destinationLine}
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
              ? `Request ${product.name} · ${formatMoney(payableCents)}`
              : signInLabel}
        </PrimaryAction>
        <p className="text-muted-foreground text-center text-xs leading-relaxed">
          Fares are estimates. Nothing is charged in this demo.
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

/** Pickup → destination, on the same dot→line→square rail as the search. */
function Itinerary({
  pickup,
  destination,
  pickupLabel = "Pickup",
  destinationLabel = "Destination",
  onEditPickup,
  onEditDestination,
  className,
}: {
  pickup: string;
  destination: string;
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
      <div aria-hidden="true" className="border-border ml-[5px] h-4 border-l" />
      <ItineraryRow
        kind="destination"
        label={destinationLabel}
        value={destination}
        onPress={onEditDestination}
      />
    </div>
  );
}

function ItineraryRow({
  kind,
  label,
  value,
  onPress,
}: {
  kind: "pickup" | "destination";
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
