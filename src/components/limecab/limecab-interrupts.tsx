"use client";

import { useEffect, useState } from "react";
import {
  CreditCardIcon,
  Location01Icon,
  Message01Icon,
  Share05Icon,
  StarIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

import { AdaptiveSurface } from "@/components/service-app/adaptive-surface";
import {
  ChoiceCopy,
  ChoiceGlyph,
  ChoiceList,
  ChoiceRow,
} from "@/components/service-app/choice-list";
import { ConfirmActionSurface } from "@/components/service-app/confirm-action-surface";
import {
  RideDetailDivider,
  RideDetailPill,
  RideDetailRow,
} from "@/components/service-app/ride-detail-rows";
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
import { shareTripDetails } from "@/lib/limecab/share-trip";
import { formatMoney } from "@/lib/service-app/services";

/**
 * Progressive density: the live scene answers "where are we and when", and
 * everything the rider might *also* want — the fare breakdown, the plate, the
 * receipt — sits one deliberate tap away instead of crowding the answer.
 */
export type DetailKind =
  | "fare"
  | "trip"
  | "driver"
  | "receipt"
  | "payment"
  | "promo"
  | "contact"
  | "safety"
  | "tip"
  | "more";

const DETAIL_TITLE: Record<DetailKind, string> = {
  fare: "Fare details",
  trip: "Ride details",
  driver: "Driver details",
  receipt: "Receipt",
  payment: "Payment method",
  promo: "Promo code",
  contact: "Message your driver",
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
  onEditDestination,
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
  onEditDestination?: () => void;
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
        <RideDetailsPanel
          destinationLine={destinationLine}
          arrivalLabel={
            trip.tripMinutes ? `About ${trip.tripMinutes} min remaining` : undefined
          }
          fare={formatMoney(trip.fare.totalCents - discountCents)}
          payment={payment}
          onEditDestination={onEditDestination}
          onAddStop={
            onAddStop && canAddStop !== false
              ? () => {
                  onClose();
                  onAddStop();
                }
              : undefined
          }
          onSwitchPayment={onOpen ? () => onOpen("payment") : undefined}
          onShare={
            onShareTrip ??
            (() => {
              shareTripDetails(trip, destinationLine);
            })
          }
          onCancel={
            onCancel
              ? () => {
                  onClose();
                  onCancel();
                }
              : undefined
          }
          cancelLabel={cancelLabel}
        />
      ) : null}

      {detail === "driver" && trip ? (
        <DriverDetailsPanel
          trip={trip}
          tipCents={tipCents}
          onTip={onTip}
          onMessage={onOpen ? () => onOpen("contact") : undefined}
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

function RideDetailsPanel({
  destinationLine,
  arrivalLabel,
  fare,
  payment,
  onEditDestination,
  onAddStop,
  onSwitchPayment,
  onShare,
  onCancel,
  cancelLabel = "Cancel ride",
}: {
  destinationLine: string;
  arrivalLabel?: string;
  fare: string;
  payment: PaymentMethod;
  onEditDestination?: () => void;
  onAddStop?: () => void;
  onSwitchPayment?: () => void;
  onShare?: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  return (
    <div className="flex flex-col">
      <RideDetailRow
        icon={<Icon icon={Location01Icon} size={18} />}
        title={destinationLine || "Destination"}
        subtitle={arrivalLabel}
        trailing={
          <span className="flex shrink-0 gap-2">
            {onEditDestination ? (
              <RideDetailPill label="Edit" onPress={onEditDestination} />
            ) : null}
            {onAddStop ? (
              <RideDetailPill label="Add stop" onPress={onAddStop} />
            ) : null}
          </span>
        }
      />
      <RideDetailDivider />
      <RideDetailRow
        icon={<Icon icon={CreditCardIcon} size={18} />}
        title={fare}
        subtitle={payment.detail}
        trailing={
          onSwitchPayment ? (
            <RideDetailPill label="Switch" onPress={onSwitchPayment} />
          ) : null
        }
      />
      <RideDetailDivider />
      <RideDetailRow
        icon={<Icon icon={Share05Icon} size={18} />}
        title="Share trip status"
        trailing={
          onShare ? <RideDetailPill label="Share" onPress={onShare} /> : null
        }
      />
      {onCancel ? (
        <Button
          variant="ghost"
          className="text-destructive mt-4 h-12 w-full rounded-xl"
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
      ) : null}
    </div>
  );
}

function DriverDetailsPanel({
  trip,
  tipCents,
  onTip,
  onMessage,
}: {
  trip: Trip;
  tipCents: number | null;
  onTip?: (next: number | null) => void;
  onMessage?: () => void;
}) {
  const initial = trip.driver.name.trim().charAt(0).toUpperCase();
  const vehicleLine = vehicleLabel(trip.driver.vehicle);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="shrink-0 text-center">
          <span
            aria-hidden="true"
            className="bg-accent text-accent-foreground flex size-[72px] items-center justify-center rounded-full text-[28px] font-semibold"
          >
            {initial}
          </span>
          <p className="text-muted-foreground mt-1 flex items-center justify-center gap-0.5 text-xs">
            <Icon icon={StarIcon} size={10} className="text-lime" />
            {trip.driver.rating.toFixed(2)}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[32px] leading-none font-semibold tracking-[0.06em] tabular-nums">
            {trip.driver.vehicle.plate}
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            {trip.driver.name} · {vehicleLine}
          </p>
        </div>
      </div>

      {onMessage ? (
        <Button
          type="button"
          variant="secondary"
          className="h-12 w-full rounded-full"
          onClick={onMessage}
        >
          <Icon icon={Message01Icon} size={18} aria-hidden="true" />
          Message {trip.driver.name.split(" ")[0]}
        </Button>
      ) : null}

      {onTip ? (
        <div className="flex flex-col gap-2">
          <p className="text-[15px] font-semibold tracking-tight">
            Tip {trip.driver.name.split(" ")[0]}?
          </p>
          <TipPanel value={tipCents} onTip={onTip} />
          <p className="text-muted-foreground text-xs leading-relaxed">
            We&apos;ll deliver your tip after the ride.
          </p>
        </div>
      ) : null}
    </div>
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
      <ChoiceList role="radiogroup" aria-label="Payment methods">
        {PAYMENT_METHODS.map((method) => (
          <ChoiceRow
            key={method.id}
            role="radio"
            aria-checked={method.id === paymentId}
            selected={method.id === paymentId}
            onClick={() => onSelect(method.id)}
          >
            <ChoiceGlyph>
              <Icon icon={CreditCardIcon} size={24} />
            </ChoiceGlyph>
            <ChoiceCopy title={method.label} detail={method.detail} />
            {method.id === paymentId ? (
              <Icon
                icon={Tick02Icon}
                size={20}
                className="text-lime shrink-0"
                aria-hidden="true"
              />
            ) : null}
          </ChoiceRow>
        ))}
      </ChoiceList>

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
        <ChoiceList>
          {CANCEL_REASONS.map((reason) => (
            <ChoiceRow key={reason} onClick={() => onFinish(reason)}>
              <ChoiceCopy title={reason} />
            </ChoiceRow>
          ))}
        </ChoiceList>
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
  const [attempted, setAttempted] = useState(false);

  const share = () => {
    if (!trip || !shareTripDetails(trip, destinationLine)) {
      setAttempted(true);
    }
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
      {attempted ? (
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
      <ChoiceList>
        {FOR_THE_WAY_ITEMS.map((item) => (
          <ChoiceRow key={item.id} onClick={() => onAdd(item.id)}>
            <ChoiceCopy title={item.label} />
            <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
              +{formatMoney(item.priceCents)}
            </span>
          </ChoiceRow>
        ))}
      </ChoiceList>
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
