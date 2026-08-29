"use client";

import { useEffect, useState } from "react";
import {
  CreditCardIcon,
  Share05Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

import { AdaptiveSurface } from "@/components/service-app/adaptive-surface";
import { ConfirmActionSurface } from "@/components/service-app/confirm-action-surface";
import { PrimaryAction } from "@/components/service-app/task-scene";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { DetailButton, DetailLines, TipPanel } from "@/components/limecab/limecab-parts";
import {
  vehicleLabel,
  type PaymentMethod,
  type Pickup,
  type RideProduct,
  type Trip,
} from "@/lib/limecab/domain";
import { AVAILABLE_PROMO, PAYMENT_METHODS } from "@/lib/limecab/mock";
import { FOR_THE_WAY_ITEMS } from "@/lib/limecab/for-the-way";
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
  | "safety"
  | "tip"
  | "more";

const DETAIL_TITLE: Record<DetailKind, string> = {
  fare: "Fare details",
  trip: "Trip details",
  receipt: "Receipt",
  payment: "Payment method",
  promo: "Promo code",
  contact: "Contact your driver",
  safety: "Safety",
  tip: "Add a tip",
  more: "Ride options",
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
  stopLines,
  payment,
  promoApplied,
  onTogglePromo,
  discountCents,
  tipCents,
  onTip,
  onAddStop,
  canAddStop,
  onShareTrip,
  shareLabel = "Share trip",
  onOpen,
  onCancel,
  cancelLabel = "Cancel ride",
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
  stopLines?: string[];
  payment: PaymentMethod;
  promoApplied: boolean;
  onTogglePromo: () => void;
  discountCents: number;
  tipCents: number | null;
  onTip?: (next: number | null) => void;
  onAddStop?: () => void;
  canAddStop?: boolean;
  onShareTrip?: () => void;
  shareLabel?: string;
  onOpen?: (kind: DetailKind) => void;
  onCancel?: () => void;
  cancelLabel?: string;
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
            ...(stopLines ?? []).map((stop, index) => ({
              label: `Stop ${index + 1}`,
              value: stop,
            })),
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
          {trip.driver.name} can&apos;t be reached from this build. Calling and
          messaging need a dispatch connection, which isn&apos;t here. Nothing
          was sent.
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

      {detail === "tip" && onTip ? (
        <div className="flex flex-col gap-3">
          <TipPanel value={tipCents} onTip={onTip} />
          <p className="text-muted-foreground text-xs leading-relaxed">
            Your rating and tip stay on this device. This build has no endpoint
            to send them to, so nothing was submitted.
          </p>
        </div>
      ) : null}

      {detail === "more" ? (
        <div className="flex flex-col gap-2">
          {onAddStop && canAddStop !== false ? (
            <DetailButton
              onPress={() => {
                onClose();
                onAddStop();
              }}
            >
              Add a stop
            </DetailButton>
          ) : null}
          {onTip && onOpen ? (
            <DetailButton onPress={() => onOpen("tip")}>
              {tipCents ? "Change tip" : "Add a tip"}
            </DetailButton>
          ) : null}
          {onShareTrip ? (
            <DetailButton onPress={onShareTrip}>{shareLabel}</DetailButton>
          ) : null}
          {onOpen ? (
            <>
              <DetailButton onPress={() => onOpen("trip")}>
                Trip details
              </DetailButton>
              <DetailButton onPress={() => onOpen("safety")}>
                Safety
              </DetailButton>
            </>
          ) : null}
          {onCancel ? (
            <DetailButton
              onPress={() => {
                onClose();
                onCancel();
              }}
            >
              {cancelLabel}
            </DetailButton>
          ) : null}
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

/**
 * Choosing how to pay — a full overlay, not a compact drawer.
 *
 * It is still an interruption: the ride sheet is suspended behind it and comes
 * back with the choice intact. It takes the screen because the question has a
 * list, a selection, and an "add one" affordance, which is a prepared
 * environment rather than a yes/no.
 */
export function LimeCabPaymentSurface({
  open,
  paymentId,
  onSelect,
  onClose,
}: {
  open: boolean;
  paymentId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open) setAdding(false);
  }, [open]);

  return (
    <AdaptiveSurface.Interrupt
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      id="payment"
      presentation="fullscreen"
      label="Payment method"
      description="Choose how you pay for this ride, or add a method."
    >
      <ul
        role="radiogroup"
        aria-label="Payment methods"
        className="divide-border ring-border divide-y rounded-2xl ring-1"
      >
        {PAYMENT_METHODS.map((method) => (
          <li key={method.id}>
            <button
              type="button"
              role="radio"
              aria-checked={method.id === paymentId}
              onClick={() => onSelect(method.id)}
              className="focus-visible:ring-ring active:bg-accent flex min-h-14 w-full items-center gap-3 px-4 text-left first:rounded-t-2xl last:rounded-b-2xl focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
            >
              <Icon
                icon={CreditCardIcon}
                size={16}
                className="text-muted-foreground shrink-0"
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
                <Icon
                  icon={Tick02Icon}
                  size={20}
                  className="text-lime shrink-0"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {/* Honest-empty: the affordance is real, the processor is not. */}
      <div className="mt-auto flex flex-col gap-3 pt-6">
        {adding ? (
          <p role="status" className="text-muted-foreground text-sm leading-relaxed">
            Adding a card needs a payment processor, which this build
            doesn&apos;t have. Nothing was saved.
          </p>
        ) : null}
        <PrimaryAction variant="outline" onClick={() => setAdding(true)}>
          Add payment method
        </PrimaryAction>
      </div>
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
 * Device share sheet when the browser has one; honest-empty otherwise.
 */
function ShareTripButton({
  trip,
  destinationLine,
}: {
  trip: Trip | null;
  destinationLine: string;
}) {
  const [supported, setSupported] = useState(false);
  const [attempted, setAttempted] = useState(false);
  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  const share = () => {
    if (!supported || !trip) {
      setAttempted(true);
      return;
    }
    void navigator
      .share({
        title: "My LimeCab ride",
        text: `I'm riding with ${trip.driver.name} in a ${vehicleLabel(
          trip.driver.vehicle,
        )}${destinationLine ? `, heading to ${destinationLine}` : ""}.`,
      })
      .catch(() => undefined);
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        className="border-border h-12 w-full"
        onClick={share}
      >
        <Icon icon={Share05Icon} size={16} aria-hidden="true" />
        Share trip details
      </Button>
      {attempted && (!supported || !trip) ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          Sharing uses your phone’s share sheet. This browser doesn’t have one,
          and nothing was sent from here.
        </p>
      ) : null}
    </div>
  );
}

export function LimeCabForTheWaySurface({
  open,
  onSkip,
  onAdd,
}: {
  open: boolean;
  onSkip: () => void;
  onAdd: (itemId: string) => void;
}) {
  return (
    <AdaptiveSurface.Interrupt
      open={open}
      onOpenChange={(next) => {
        if (!next) onSkip();
      }}
      id="for-the-way"
      label="Add something for the ride?"
      description="Coffee, tea, or sparkling water. One stop on the way. Skip to keep the ride as-is."
    >
      <ul className="divide-border ring-border divide-y rounded-2xl ring-1">
        {FOR_THE_WAY_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onAdd(item.id)}
              className="focus-visible:ring-ring active:bg-accent flex min-h-14 w-full items-center justify-between px-4 text-left first:rounded-t-2xl last:rounded-b-2xl focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
            >
              <span className="text-[15px] font-medium tracking-tight">
                {item.label}
              </span>
              <span className="text-muted-foreground text-sm tabular-nums">
                +{formatMoney(item.priceCents)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Button
        variant="ghost"
        className="text-muted-foreground h-11 w-full rounded-xl text-sm font-normal"
        onClick={onSkip}
      >
        No thanks
      </Button>
    </AdaptiveSurface.Interrupt>
  );
}
