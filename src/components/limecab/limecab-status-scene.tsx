"use client";

import type { ReactNode } from "react";
import { CallIcon, Message01Icon } from "@hugeicons/core-free-icons";

import { ProviderCard } from "@/components/service-app/provider-card";
import { ServiceStatusPanel } from "@/components/service-app/service-status";
import { SheetActions } from "@/components/service-app/service-sheet";
import { PrimaryAction } from "@/components/service-app/task-scene";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { DetailButton } from "@/components/limecab/limecab-parts";
import type { DetailKind } from "@/components/limecab/limecab-interrupts";
import type { Pickup, RideProduct, Trip } from "@/lib/limecab/domain";
import { courierOrderLabel } from "@/lib/limecab/courier";
import { isHelpProduct } from "@/lib/limecab/help";
import type { Location } from "@/lib/service-app/services";
import type { ServiceStatus, StatusLabels } from "@/lib/service-app/status";
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
  onBackToQuote: () => void;
  onCancel: () => void;
}) {
  const curbside = CURBSIDE.has(status.state);
  // A visit is not a curb: the code is reassurance the rider may ask for, not
  // a gate the helper has to pass.
  const visit = isHelpProduct(product?.id);
  const pin = curbside && trip;
  const courierLive = status.state === "active" && trip?.courier;
  const hasDetails = Boolean(pin) || Boolean(courierLive) || Boolean(showDriver && trip);
  const hasFooter = Boolean(failure) || Boolean(cancelError) || cancellable;

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
        actions={
          hasDetails ? (
            <div className="flex flex-col gap-3">
              {/* The rider's half of the verification the driver is also shown. */}
              {pin ? (
                <PickupPin
                  pin={pin.pickupPin}
                  title={
                    pin.courier
                      ? `${courierOrderLabel(pin.id)} · Pickup`
                      : visit
                        ? "Ask for this if you want to"
                        : undefined
                  }
                  meetAt={visit ? undefined : (pickup.meetingPoint ?? pickupLine)}
                  detail={
                    pin.courier
                      ? `${pin.courier.packageCount === 1 ? "1 package" : `${pin.courier.packageCount} packages`} · show this to your courier`
                      : visit
                        ? "Show this if you want to confirm it’s them."
                        : undefined
                  }
                  provider={labels.provider}
                />
              ) : null}

              {courierLive ? (
                courierLive.proof === "hand" && courierLive.deliveryPin ? (
                  <PickupPin
                    pin={courierLive.deliveryPin}
                    title={`${courierOrderLabel(trip?.id ?? "")} · Recipient PIN`}
                    detail={`Give this to ${courierLive.recipientName}`}
                    provider="recipient"
                  />
                ) : (
                  <p className="bg-muted/60 rounded-2xl px-4 py-3 text-sm leading-relaxed">
                    In transit to {courierLive.recipientName}
                    {courierLive.proof === "door"
                      ? " · leave at door"
                      : courierLive.proof === "signature"
                        ? " · signature required"
                        : ""}
                  </p>
                )
              ) : null}

              {showDriver && trip ? (
                <ProviderCard
                  provider={{
                    id: trip.driver.id,
                    name: trip.driver.name,
                    // The car, not the trim level: colour, make, model — what the
                    // rider actually scans a street for.
                    detail: `${trip.driver.vehicle.color} ${trip.driver.vehicle.make} ${trip.driver.vehicle.model}`,
                    rating: trip.driver.rating,
                  }}
                  badge={<Plate value={trip.driver.vehicle.plate} />}
                  actions={
                    <div className="flex gap-2">
                      <IconAction
                        label={`Message ${trip.driver.name}`}
                        onPress={() => onOpenDetail("contact")}
                      >
                        <Icon icon={Message01Icon} size={18} />
                      </IconAction>
                      <IconAction
                        label={`Call ${trip.driver.name}`}
                        onPress={() => onOpenDetail("contact")}
                      >
                        <Icon icon={CallIcon} size={18} />
                      </IconAction>
                    </div>
                  }
                  // The hero already answers "when"; the card answers "who".
                  eta={status.state === "arriving" ? "Here now" : null}
                />
              ) : null}

              {showDriver && trip ? (
                <div className="grid grid-cols-2 gap-2">
                  <DetailButton onPress={() => onOpenDetail("trip")}>
                    Trip details
                  </DetailButton>
                  <DetailButton onPress={() => onOpenDetail("safety")}>
                    Safety
                  </DetailButton>
                </div>
              ) : null}

              {onShareTrip && showDriver && trip ? (
                <DetailButton onPress={onShareTrip}>{shareLabel}</DetailButton>
              ) : null}
            </div>
          ) : undefined
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

/** The plate, set apart so it reads from the kerb at a glance. */
function Plate({ value }: { value: string }) {
  return (
    <span
      aria-label={`Licence plate ${value}`}
      className="bg-foreground text-background rounded-md px-2 py-1 text-[15px] leading-none font-semibold tracking-[0.08em] tabular-nums"
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
      className="ring-border focus-visible:ring-ring active:bg-accent inline-flex size-11 shrink-0 items-center justify-center rounded-full ring-1 focus-visible:ring-2 focus-visible:outline-none [&_svg]:size-[18px]"
    >
      {children}
    </button>
  );
}

/**
 * The code the rider reads out at the curb.
 *
 * It is the largest thing on the screen for the few seconds it matters,
 * because the rider is looking at a phone at arm's length beside a road.
 */
function PickupPin({
  pin,
  meetAt,
  provider,
  title,
  detail,
}: {
  pin: string;
  meetAt?: string;
  provider: string;
  title?: string;
  detail?: string;
}) {
  return (
    <div className="bg-accent text-accent-foreground rounded-2xl px-4 py-3">
      <p className="text-[11px] tracking-[0.12em] uppercase opacity-70">
        {title ?? `Give your ${provider} this code`}
      </p>
      <p className="mt-1.5 text-[40px] leading-none font-semibold tracking-[0.14em] tabular-nums">
        {pin}
      </p>
      <p className="mt-2.5 text-sm opacity-80">
        {detail ?? (meetAt ? `Meet at ${meetAt}` : null)}
      </p>
    </div>
  );
}
