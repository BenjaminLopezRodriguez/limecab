"use client";

import {
  DriverTipCard,
  InRideHeadline,
  ShareLocationBanner,
  TripSummaryCard,
} from "@/components/service-app/in-ride-cards";
import { ServiceStatusPanel } from "@/components/service-app/service-status";
import { SheetActions } from "@/components/service-app/service-sheet";
import { PrimaryAction } from "@/components/service-app/task-scene";
import { Button } from "@/components/ui/button";
import type { DetailKind } from "@/components/limecab/limecab-interrupts";
import type { Pickup, RideProduct, Trip } from "@/lib/limecab/domain";
import { courierOrderLabel } from "@/lib/limecab/courier";
import { isHelpProduct } from "@/lib/limecab/help";
import type { Location } from "@/lib/service-app/services";
import {
  glanceLabel,
  serviceStatusView,
  type ServiceStatus,
  type StatusLabels,
} from "@/lib/service-app/status";
import { cn } from "@/lib/utils";

/** States where the rider is still waiting at a curb for a specific car. */
const CURBSIDE = new Set<ServiceStatus["state"]>([
  "assigned",
  "provider_en_route",
  "arriving",
]);

/** The live scene: where the driver is, who they are, and how to stop. */
export function LimeCabStatusScene({
  status,
  pickup,
  pickupLine,
  product,
  destination,
  destinationLine,
  trip,
  showDriver,
  failure,
  cancelError,
  cancellable,
  labels = { provider: "driver", service: "ride" },
  shareLabel = "Share trip",
  liveSubtitle,
  onOpenDetail,
  onShareTrip,
  onAddStop,
  canAddStop = true,
  onTipChange,
  tipCents,
  onBackToQuote,
  onCancel,
}: {
  status: ServiceStatus;
  pickup: Pickup;
  pickupLine: string;
  product: RideProduct | null;
  destination: Location | null;
  destinationLine: string;
  trip: Trip | null;
  showDriver: boolean;
  failure: string | null;
  /** The server refused the cancellation. The ride is still running. */
  cancelError?: string | null;
  cancellable: boolean;
  labels?: StatusLabels;
  shareLabel?: string;
  liveSubtitle?: string;
  onOpenDetail: (kind: DetailKind) => void;
  onShareTrip?: () => void;
  /** In-car only: adding a stop is an interruption, not a new scene. */
  onAddStop?: () => void;
  canAddStop?: boolean;
  onTipChange?: (next: number | null) => void;
  tipCents?: number | null;
  onBackToQuote: () => void;
  onCancel: () => void;
}) {
  const curbside = CURBSIDE.has(status.state);
  // A visit is not a curb: the code is reassurance the rider may ask for, not
  // a gate the helper has to pass.
  const visit = isHelpProduct(product?.id);
  const pin = curbside && trip;
  const courierLive = status.state === "active" && trip?.courier;
  const hasFooter = Boolean(failure) || Boolean(cancelError) || cancellable;
  const inCar =
    status.state === "active" &&
    Boolean(onAddStop) &&
    Boolean(showDriver && trip) &&
    !courierLive &&
    !visit;
  const view = serviceStatusView(status, labels);
  const identified = Boolean(showDriver && trip);
  const meetAt = pickup.meetingPoint ?? pickupLine;
  const faceFooter = Boolean(failure) || Boolean(cancelError);

  if (identified && trip) {
    const metric = view.estimate;
    const headline =
      inCar && metric
        ? `Dropoff at ${glanceLabel(metric)}`
        : curbside
          ? `Meet at ${meetAt}`
          : inCar && destinationLine
            ? `On the way to ${destinationLine}`
            : view.headline;
    const secondary = curbside ? view.detail : undefined;
    const tripTitle =
      inCar && destinationLine
        ? destinationLine
        : curbside
          ? meetAt
          : destinationLine || view.headline;
    const productLabel =
      product?.name ??
      labels.service.charAt(0).toUpperCase() + labels.service.slice(1);
    const vehicleLine = `${trip.driver.vehicle.color} ${trip.driver.vehicle.make} ${trip.driver.vehicle.model}`;

    return (
      <>
        <div aria-live="polite">
          <InRideHeadline>{headline}</InRideHeadline>
          {secondary ? (
            <p className="text-muted-foreground mt-1 text-center text-sm leading-snug">
              {secondary}
            </p>
          ) : null}
          {pin ? (
            <div className="mt-2 flex justify-center">
              <PinChip
                pin={pin.pickupPin}
                label={
                  pin.courier
                    ? `${courierOrderLabel(pin.id)} pickup`
                    : visit
                      ? "Optional code"
                      : "PIN"
                }
                ariaLabel={
                  pin.courier
                    ? `${courierOrderLabel(pin.id)} pickup code ${pin.pickupPin}`
                    : visit
                      ? `Ask for this if you want to: ${pin.pickupPin}`
                      : `Give your ${labels.provider} this code: ${pin.pickupPin}`
                }
              />
            </div>
          ) : null}
        </div>

        {courierLive ? (
          courierLive.proof === "hand" && courierLive.deliveryPin ? (
            <PickupPin
              className="mt-3"
              compact
              pin={courierLive.deliveryPin}
              title={`${courierOrderLabel(trip.id)} · Recipient PIN`}
              detail={`Give this to ${courierLive.recipientName}`}
              provider="recipient"
            />
          ) : (
            <p className="bg-muted/60 mt-3 rounded-2xl px-3 py-2.5 text-sm leading-snug">
              In transit to {courierLive.recipientName}
              {courierLive.proof === "door"
                ? " · leave at door"
                : courierLive.proof === "signature"
                  ? " · signature required"
                  : ""}
            </p>
          )
        ) : null}

        <div className="mt-3 flex flex-col gap-2">
          {onShareTrip ? (
            <ShareLocationBanner label={shareLabel} onShare={onShareTrip} />
          ) : null}
          <TripSummaryCard
            productLabel={productLabel}
            title={tripTitle}
            onOptions={() => onOpenDetail("trip")}
          />
          <DriverTipCard
            name={trip.driver.name}
            rating={trip.driver.rating}
            plate={trip.driver.vehicle.plate}
            vehicleLine={vehicleLine}
            tipCents={tipCents ?? null}
            onTipChange={inCar ? onTipChange : undefined}
            showTip={inCar && Boolean(onTipChange)}
            onMessage={() => onOpenDetail("contact")}
            onOptions={() => onOpenDetail("driver")}
          />
        </div>

        {faceFooter ? (
          <SheetActions>
            {failure ? (
              <PrimaryAction onClick={onBackToQuote}>
                Back to the quote
              </PrimaryAction>
            ) : null}
            {cancelError ? (
              <p role="alert" className="text-destructive text-sm leading-relaxed">
                {cancelError}
              </p>
            ) : null}
          </SheetActions>
        ) : null}
      </>
    );
  }

  return (
    <>
      <ServiceStatusPanel
        status={status}
        labels={labels}
        subtitle={
          liveSubtitle ??
          (product && destination
            ? `${product.name} · ${destinationLine}`
            : undefined)
        }
      />
      {hasFooter ? (
        <SheetActions>
          {failure ? (
            <PrimaryAction onClick={onBackToQuote}>
              Back to the quote
            </PrimaryAction>
          ) : null}
          {cancelError ? (
            <p role="alert" className="text-destructive text-sm leading-relaxed">
              {cancelError}
            </p>
          ) : null}
          {cancellable ? (
            <Button
              variant="ghost"
              className="text-muted-foreground h-11 w-full rounded-xl text-sm font-normal"
              onClick={onCancel}
            >
              Cancel {labels.service}
            </Button>
          ) : null}
        </SheetActions>
      ) : null}
    </>
  );
}

/**
 * Pickup → destination on the dot→line→square rail used everywhere a paired
 * origin and destination appear. Read-only here: a live ride is not edited.
 */
export function RouteRail({
  pickup,
  destination,
  className,
}: {
  pickup: string;
  destination: string;
  className?: string;
}) {
  if (!pickup && !destination) return null;
  return (
    <div className={cn("bg-muted/60 rounded-2xl p-3", className)}>
      <RouteRailRow kind="pickup" label="Pickup" value={pickup} />
      <div aria-hidden="true" className="border-border ml-[5px] h-4 border-l" />
      <RouteRailRow
        kind="destination"
        label="Destination"
        value={destination}
      />
    </div>
  );
}

function RouteRailRow({
  kind,
  label,
  value,
}: {
  kind: "pickup" | "destination";
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="sr-only">{label}: </span>
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
    </div>
  );
}

/**
 * The code the rider reads out at the curb — a chip, not a billboard.
 * The metric and the plate outrank it; it still has to be there.
 */
function PinChip({
  pin,
  label,
  ariaLabel,
}: {
  pin: string;
  label: string;
  ariaLabel: string;
}) {
  return (
    <span
      aria-label={ariaLabel}
      className="bg-accent text-accent-foreground inline-flex shrink-0 items-baseline gap-1.5 rounded-full px-2.5 py-1"
    >
      <span className="text-[10px] font-medium tracking-[0.12em] uppercase opacity-70">
        {label}
      </span>
      <span className="text-[13px] leading-none font-semibold tracking-[0.08em] tabular-nums">
        {pin}
      </span>
    </span>
  );
}

/**
 * The code the rider reads out at the curb.
 *
 * Used when the PIN *is* the job — a courier handing off to a recipient —
 * not on the arriving face, where it is a chip in the header.
 */
function PickupPin({
  pin,
  meetAt,
  provider,
  title,
  detail,
  compact = false,
  className,
}: {
  pin: string;
  meetAt?: string;
  provider: string;
  title?: string;
  detail?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-accent text-accent-foreground rounded-2xl px-4",
        compact ? "py-2.5" : "py-3",
        className,
      )}
    >
      <p className="text-[11px] tracking-[0.12em] uppercase opacity-70">
        {title ?? `Give your ${provider} this code`}
      </p>
      <p
        className={cn(
          "leading-none font-semibold tracking-[0.14em] tabular-nums",
          compact ? "mt-1 text-[28px]" : "mt-1.5 text-[40px]",
        )}
      >
        {pin}
      </p>
      {!compact || detail ? (
        <p className={cn("opacity-80", compact ? "mt-1.5 text-xs" : "mt-2.5 text-sm")}>
          {detail ?? (meetAt ? `Meet at ${meetAt}` : null)}
        </p>
      ) : null}
    </div>
  );
}
