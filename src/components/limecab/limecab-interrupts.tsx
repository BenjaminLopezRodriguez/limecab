"use client";

import { useEffect, useState } from "react";
import { Check, CreditCard, Share2 } from "lucide-react";

import { AdaptiveSurface } from "@/components/service-app/adaptive-surface";
import { ConfirmActionSurface } from "@/components/service-app/confirm-action-surface";
import { PrimaryAction } from "@/components/service-app/task-scene";
import { Button } from "@/components/ui/button";
import { DetailLines } from "@/components/limecab/limecab-parts";
import {
  vehicleLabel,
  type PaymentMethod,
  type Pickup,
  type RideProduct,
  type Trip,
} from "@/lib/limecab/domain";
import { AVAILABLE_PROMO, PAYMENT_METHODS } from "@/lib/limecab/mock";
import { formatMoney } from "@/lib/service-app/services";

/**
 * Progressive density: the live scene answers "where are we and when", and
 * everything the rider might *also* want — the fare breakdown, the plate, the
 * receipt — sits one deliberate tap away instead of crowding the answer.
 */
export type DetailKind =
  | "fare"
  | "trip"
  | "receipt"
  | "payment"
  | "promo"
  | "contact"
  | "safety";

const DETAIL_TITLE: Record<DetailKind, string> = {
  fare: "Fare details",
  trip: "Trip details",
  receipt: "Receipt",
  payment: "Payment method",
  promo: "Promo code",
  contact: "Contact your driver",
  safety: "Safety",
};

const CANCEL_REASONS = [
  "Driver was too far away",
  "Wait was too long",
  "Booked by mistake",
  "Plans changed",
  "Price was too high",
] as const;

/** A tier the rider asked for that this city doesn't have yet. */
export function LimeCabUnavailableSurface({
  product,
  onDismiss,
}: {
  product: RideProduct | null;
  onDismiss: () => void;
}) {
  return (
    <ConfirmActionSurface
      open={product !== null}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
      id="ride-unavailable"
      title={`${product?.name ?? "This ride"} isn't live yet`}
      description={
        product
          ? `${product.description}. We'll let you know when it reaches your city.`
          : undefined
      }
      confirmLabel="Back to rides"
      cancelLabel={null}
      onConfirm={onDismiss}
    />
  );
}

/* Disclosure, not a step: the ride surface is suspended behind this and
   restored untouched when it closes. */
export function LimeCabDetailSurface({
  detail,
  onClose,
  quote,
  product,
  trip,
  pickup,
  pickupLine,
  destinationLine,
  payment,
  paymentId,
  onSelectPayment,
  promoApplied,
  onTogglePromo,
  discountCents,
  tipCents,
}: {
  detail: DetailKind | null;
  onClose: () => void;
  quote: {
    fare: { totalCents: number };
    panel: { lines: { label: string; value: string }[] };
  } | null;
  product: RideProduct | null;
  trip: Trip | null;
  pickup: Pickup;
  pickupLine: string;
  destinationLine: string;
  payment: PaymentMethod;
  paymentId: string;
  onSelectPayment: (id: string) => void;
  promoApplied: boolean;
  onTogglePromo: () => void;
  discountCents: number;
  tipCents: number | null;
}) {
  return (
    <AdaptiveSurface.Interrupt
      open={detail !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      id="ride-detail"
      label={DETAIL_TITLE[detail ?? "fare"]}
    >
      {detail === "fare" && quote && product ? (
        <DetailLines
          lines={[
            ...quote.panel.lines,
            { label: "Estimated total", value: formatMoney(quote.fare.totalCents), strong: true },
          ]}
          footnote="Estimates. The final fare follows the route actually driven."
        />
      ) : null}

      {detail === "trip" && trip ? (
        <DetailLines
          lines={[
            { label: "Ride", value: product?.name ?? "Lime" },
            { label: "Driver", value: trip.driver.name },
            { label: "Vehicle", value: vehicleLabel(trip.driver.vehicle) },
            { label: "Pickup", value: pickupLine },
            { label: "Meet at", value: pickup.meetingPoint ?? pickupLine },
            { label: "Destination", value: destinationLine },
            { label: "Distance", value: `${trip.distanceMiles} mi` },
            { label: "Trip time", value: `~${trip.tripMinutes} min` },
            { label: "Payment", value: payment.detail },
            {
              label: "Estimated total",
              value: formatMoney(trip.fare.totalCents - discountCents),
              strong: true,
            },
          ]}
        />
      ) : null}

      {detail === "receipt" && trip ? (
        <DetailLines
          lines={[
            { label: "Base fare", value: formatMoney(trip.fare.baseCents) },
            { label: `Distance · ${trip.distanceMiles} mi`, value: formatMoney(trip.fare.distanceCents) },
            { label: `Time · ${trip.tripMinutes} min`, value: formatMoney(trip.fare.timeCents) },
            { label: "Booking fee", value: formatMoney(trip.fare.bookingCents) },
            ...(discountCents
              ? [{ label: AVAILABLE_PROMO.label, value: `−${formatMoney(discountCents)}` }]
              : []),
            ...(tipCents
              ? [{ label: `Tip for ${trip.driver.name}`, value: formatMoney(tipCents) }]
              : []),
            {
              label: "Trip total",
              value: formatMoney(trip.fare.totalCents - discountCents + (tipCents ?? 0)),
              strong: true,
            },
          ]}
          footnote={`Trip ${trip.id} · ${product?.name ?? "Lime"} with ${trip.driver.name}.`}
        />
      ) : null}

      {detail === "payment" ? (
        <ul className="divide-border ring-border divide-y rounded-2xl ring-1">
          {PAYMENT_METHODS.map((method) => (
            <li key={method.id}>
              <button
                type="button"
                role="radio"
                aria-checked={method.id === paymentId}
                onClick={() => onSelectPayment(method.id)}
                className="focus-visible:ring-ring active:bg-accent flex min-h-14 w-full items-center gap-3 px-4 text-left first:rounded-t-2xl last:rounded-b-2xl focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
              >
                <CreditCard
                  className="text-muted-foreground size-4 shrink-0"
                  strokeWidth={1.7}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium tracking-tight">
                    {method.label}
                  </span>
                  <span className="text-muted-foreground block truncate text-sm">
                    {method.detail}
                  </span>
                </span>
                {method.id === paymentId ? (
                  <Check
                    className="text-primary size-5 shrink-0"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {detail === "promo" ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {promoApplied
              ? `${AVAILABLE_PROMO.label} is applied to this ride.`
              : `Code ${AVAILABLE_PROMO.code} is available on your account.`}
          </p>
          <PrimaryAction onClick={onTogglePromo}>
            {promoApplied
              ? "Remove credit"
              : `Apply ${formatMoney(AVAILABLE_PROMO.amountCents)} credit`}
          </PrimaryAction>
        </div>
      ) : null}

      {detail === "contact" && trip ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          Calling and messaging {trip.driver.name} needs a dispatch connection,
          which this build doesn&apos;t have. Nothing was sent.
        </p>
      ) : null}

      {detail === "safety" ? (
        <div className="flex flex-col gap-3">
          <DetailLines
            lines={[
              { label: "Trip", value: trip?.id ?? "—" },
              { label: "Driver", value: trip?.driver.name ?? "—" },
              { label: "Vehicle", value: trip ? trip.driver.vehicle.plate : "—" },
            ]}
            footnote="Emergency calling needs a live trip service, so this build has none. Sharing hands these details to your own phone's share sheet — nothing is sent from here."
          />
          <ShareTripButton trip={trip} destinationLine={destinationLine} />
        </div>
      ) : null}

      <Button
        variant="ghost"
        className="border-border h-12 w-full rounded-xl"
        onClick={onClose}
      >
        Close
      </Button>
    </AdaptiveSurface.Interrupt>
  );
}

export function LimeCabCancelSurfaces({
  stage,
  trip,
  onDismiss,
  onConfirm,
  onFinish,
}: {
  stage: "confirm" | "reason" | null;
  trip: Trip | null;
  onDismiss: () => void;
  onConfirm: () => void;
  onFinish: (reason?: string) => void;
}) {
  return (
    <>
      <ConfirmActionSurface
        open={stage === "confirm"}
        onOpenChange={(open) => {
          if (!open) onDismiss();
        }}
        id="cancel-ride"
        intent="destructive"
        title="Cancel this ride?"
        description={
          trip
            ? `${trip.driver.name} stops heading to you. You won't be charged.`
            : "We'll stop looking for a driver. You won't be charged."
        }
        confirmLabel="Cancel ride"
        cancelLabel="Keep ride"
        // The ride is cancelled here. The reason is asked *after*, because
        // making the rider answer a survey before we stop the car would be
        // holding the cancellation hostage.
        onConfirm={onConfirm}
        onCancel={onDismiss}
      />

      <AdaptiveSurface.Interrupt
        open={stage === "reason"}
        onOpenChange={(open) => {
          if (!open) onFinish();
        }}
        id="cancel-reason"
        label="Ride cancelled"
        description="What happened? This helps us send a better driver next time."
      >
        <ul className="divide-border ring-border divide-y rounded-2xl ring-1">
          {CANCEL_REASONS.map((reason) => (
            <li key={reason}>
              <button
                type="button"
                onClick={() => onFinish(reason)}
                className="focus-visible:ring-ring active:bg-accent flex min-h-14 w-full items-center px-4 text-left text-[15px] first:rounded-t-2xl last:rounded-b-2xl focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
              >
                {reason}
              </button>
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
          className="text-muted-foreground h-11 w-full rounded-xl text-sm font-normal"
          onClick={() => onFinish()}
        >
          Skip
        </Button>
      </AdaptiveSurface.Interrupt>
    </>
  );
}

/**
 * The one genuinely real control here: the platform share sheet. Rendered only
 * where the browser actually supports it, so it never looks like a feature
 * this build doesn't have.
 */
function ShareTripButton({
  trip,
  destinationLine,
}: {
  trip: Trip | null;
  destinationLine: string;
}) {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  if (!supported || !trip) return null;

  const share = () =>
    void navigator
      .share({
        title: "My LimeCab ride",
        text: `I'm riding with ${trip.driver.name} in a ${vehicleLabel(
          trip.driver.vehicle,
        )}${destinationLine ? `, heading to ${destinationLine}` : ""}.`,
      })
      .catch(() => undefined);

  return (
    <Button
      variant="ghost"
      className="border-border h-12 w-full rounded-xl"
      onClick={share}
    >
      <Share2 className="size-4" strokeWidth={1.7} aria-hidden="true" />
      Share trip details
    </Button>
  );
}
