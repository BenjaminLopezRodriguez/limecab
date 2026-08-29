"use client";

import type { ReactNode } from "react";
import {
  MoreHorizontalIcon,
  PlusSignIcon,
  StarIcon,
} from "@hugeicons/core-free-icons";

import {
  LiveSheetDock,
  LiveSheetHeader,
  LiveSheetIdentity,
} from "@/components/service-app/live-sheet";
import { ServiceStatusPanel } from "@/components/service-app/service-status";
import { SheetActions } from "@/components/service-app/service-sheet";
import { PrimaryAction } from "@/components/service-app/task-scene";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { DetailKind } from "@/components/limecab/limecab-interrupts";
import type { Pickup, RideProduct, Trip } from "@/lib/limecab/domain";
import { courierOrderLabel } from "@/lib/limecab/courier";
import { vehiclePaintClass } from "@/lib/limecab/vehicle-paint";
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
  shareLabel: _shareLabel = "Share trip",
  liveSubtitle,
  onOpenDetail,
  onShareTrip: _onShareTrip,
  onAddStop,
  canAddStop = true,
  onTip: _onTip,
  tipCents: _tipCents,
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
  onTip?: () => void;
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
    const instruction = curbside
      ? `Meet at ${meetAt}`
      : inCar && destinationLine
        ? `On the way to ${destinationLine}`
        : view.headline;
    const secondary = curbside ? view.detail : undefined;
    const metric = view.estimate;
    const paint = vehiclePaintClass(trip.driver.vehicle.color);

    return (
      <>
        <div aria-live="polite">
          <LiveSheetHeader
            instruction={instruction}
            secondary={secondary}
            chip={
              pin ? (
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
              ) : null
            }
            metric={metric}
            metricAriaLabel={
              metric
                ? view.estimateLabel
                  ? `${view.estimateLabel} ${glanceLabel(metric)}`
                  : glanceLabel(metric)
                : undefined
            }
          />
        </div>

        {courierLive ? (
          courierLive.proof === "hand" && courierLive.deliveryPin ? (
            <PickupPin
              className="mt-4"
              compact
              pin={courierLive.deliveryPin}
              title={`${courierOrderLabel(trip.id)} · Recipient PIN`}
              detail={`Give this to ${courierLive.recipientName}`}
              provider="recipient"
            />
          ) : (
            <p className="bg-muted/60 mt-4 rounded-2xl px-4 py-3 text-sm leading-relaxed">
              In transit to {courierLive.recipientName}
              {courierLive.proof === "door"
                ? " · leave at door"
                : courierLive.proof === "signature"
                  ? " · signature required"
                  : ""}
            </p>
          )
        ) : null}

        <LiveSheetIdentity
          className="mt-5"
          name={trip.driver.name}
          badge={
            <span className="flex items-center gap-3">
              <Plate value={trip.driver.vehicle.plate} hero />
              {paint ? (
                <span
                  aria-hidden="true"
                  className={cn("h-10 w-12 shrink-0 rounded-xl", paint)}
                />
              ) : null}
            </span>
          }
          detail={`${trip.driver.vehicle.color} ${trip.driver.vehicle.make} ${trip.driver.vehicle.model}`}
          visual={
            <IdentityVisual
              name={trip.driver.name}
              rating={trip.driver.rating}
            />
          }
        />

        <LiveSheetDock
          className="mt-5"
          message="Send a message"
          onMessage={() => onOpenDetail("contact")}
          actions={
            <>
              {inCar && onAddStop && canAddStop ? (
                <IconAction label="Add a stop" onPress={onAddStop}>
                  <Icon icon={PlusSignIcon} size={18} />
                </IconAction>
              ) : null}
              <IconAction
                label="Ride options"
                onPress={() => onOpenDetail("more")}
              >
                <Icon icon={MoreHorizontalIcon} size={18} />
              </IconAction>
            </>
          }
        />

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

function IdentityVisual({
  name,
  rating,
}: {
  name: string;
  rating: number;
}) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <span className="relative shrink-0">
      <span
        aria-hidden="true"
        className="bg-accent text-accent-foreground flex size-14 items-center justify-center overflow-hidden rounded-full text-[19px] font-semibold tracking-tight"
      >
        {initial}
      </span>
      <span className="bg-card ring-border absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums ring-1">
        <Icon icon={StarIcon} size={10} className="text-lime" />
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

/** The plate, set apart so it reads from the kerb at a glance. */
function Plate({ value, hero = false }: { value: string; hero?: boolean }) {
  return (
    <span
      aria-label={`Licence plate ${value}`}
      className={
        hero
          ? "block text-[28px] leading-none font-semibold tracking-[0.14em] tabular-nums"
          : "bg-foreground text-background rounded-md px-2 py-1 text-[15px] leading-none font-semibold tracking-[0.08em] tabular-nums"
      }
    >
      {value}
    </span>
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

/** A round icon-only affordance. Label is spoken, never drawn. */
function IconAction({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      className="bg-muted text-muted-foreground focus-visible:ring-ring active:bg-accent inline-flex size-12 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none [&_svg]:size-[18px]"
    >
      {children}
    </button>
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
