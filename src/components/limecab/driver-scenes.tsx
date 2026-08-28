"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Call02Icon,
  Location01Icon,
  Navigation03Icon,
  PowerIcon,
} from "@hugeicons/core-free-icons";

import { ProviderCard } from "@/components/service-app/provider-card";
import { SheetActions } from "@/components/service-app/service-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { courierOrderLabel, isCourierProduct } from "@/lib/limecab/courier";
import { driverAppQuestion, type DriverAppState } from "@/lib/limecab/driver-state";
import { productLabel } from "@/lib/limecab/format";
import { formatMoney, splitAddress } from "@/lib/service-app/services";
import { cn } from "@/lib/utils";

/**
 * The driver's scenes. Every one of them is read at a glance from a dash
 * mount: the number that decides something is the largest thing on screen,
 * and the one action that answers the scene sits in the thumb zone at 56px+.
 *
 * None of them owns a headline string — `driverAppQuestion` does.
 */

export type OfferTrip = {
  id: string;
  productId: string;
  totalCents: number;
  distanceMiles: number;
  tripMinutes: number;
  arrivalMinutes: number;
  pickupAddress: string;
  destinationAddress: string;
};

export type JobTrip = OfferTrip & {
  status: string;
  pickupMeetingPoint: string | null;
  pickupPin: string | null;
  riderName: string | null;
  riderPhone: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  packageCount: number;
  deliveryProof: string | null;
};

/** Every advance the state machine can offer, with the words for it. */
export type AdvanceAction = "arrive" | "start" | "complete";

const ADVANCE_FOR: Record<
  Extract<DriverAppState, "to_pickup" | "at_pickup" | "on_trip">,
  AdvanceAction
> = {
  to_pickup: "arrive",
  at_pickup: "start",
  on_trip: "complete",
};

export function advanceActionFor(state: DriverAppState): AdvanceAction | null {
  return state === "to_pickup" || state === "at_pickup" || state === "on_trip"
    ? ADVANCE_FOR[state]
    : null;
}

/* ------------------------------------------------------------------ duty */

/**
 * Offline and online are the same peek: a status line, today's take, and the
 * heading filter. Only the copy and the one loud action change — the map must
 * not so much as blink when duty flips.
 */
export function DriverDutyScene({
  scene,
  todayCents,
  headingAddress,
  busy,
  error,
  onGoOnline,
  onGoOffline,
  onOpenHeading,
}: {
  scene: Extract<DriverAppState, "offline" | "online">;
  todayCents: number;
  headingAddress: string | null;
  busy: boolean;
  error: string | null;
  onGoOnline: () => void;
  onGoOffline: () => void;
  onOpenHeading: () => void;
}) {
  const online = scene === "online";
  const question = driverAppQuestion(scene);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[17px] font-medium tracking-tight">
          <span
            className={cn(
              "size-2.5 shrink-0 rounded-full",
              online
                ? "bg-lime motion-safe:animate-pulse"
                : "bg-muted-foreground/60",
            )}
            aria-hidden="true"
          />
          {online ? question.question : "Off duty"}
        </p>
        {/* Drivers optimise for this number, so it is on every idle frame. */}
        <Link
          href="/driver/profile/earnings"
          className="focus-visible:ring-ring rounded-full text-[21px] font-semibold tracking-[-0.03em] tabular-nums focus-visible:ring-2 focus-visible:outline-none"
        >
          {formatMoney(todayCents)}
          <span className="text-muted-foreground ml-1 text-[13px] font-medium tracking-normal">
            today
          </span>
        </Link>
      </div>

      <button
        type="button"
        onClick={onOpenHeading}
        className="ring-border hover:bg-muted focus-visible:ring-ring mt-2 flex min-h-10 w-fit max-w-full items-center gap-1.5 rounded-full px-3 text-[15px] font-medium ring-1 focus-visible:ring-2 focus-visible:outline-none"
      >
        <Icon icon={Location01Icon} size={16} aria-hidden="true" />
        <span className="truncate">
          {headingAddress
            ? `Heading to ${splitAddress(headingAddress).line}`
            : "Anywhere"}
        </span>
      </button>

      <SheetActions>
        {/* Beside the action that failed, not above the fold of a peek. */}
        {error ? (
          <p role="alert" className="text-destructive pb-1 text-[15px]">
            {error}
          </p>
        ) : null}
        {online ? (
          <Button
            variant="ghost"
            className="text-muted-foreground h-14 w-full text-[15px]"
            disabled={busy}
            onClick={onGoOffline}
          >
            <Icon icon={PowerIcon} size={18} aria-hidden="true" />
            Go offline
          </Button>
        ) : (
          <Button
            size="lg"
            className="h-16 w-full text-[19px]"
            aria-busy={busy || undefined}
            disabled={busy}
            onClick={onGoOnline}
          >
            <Icon icon={PowerIcon} size={20} aria-hidden="true" />
            {question.action}
          </Button>
        )}
      </SheetActions>
    </>
  );
}

/* ----------------------------------------------------------------- offer */

/**
 * The moment the whole app exists for. Fare first, deadhead second, street
 * strings third — that is the order a driver decides in, in about two
 * seconds. Accept is the only primary; the countdown is the decline.
 */
export function DriverOfferScene({
  trip,
  secondsLeft,
  totalSeconds,
  busy,
  onAccept,
  onDecline,
}: {
  trip: OfferTrip;
  secondsLeft: number;
  totalSeconds: number;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const courier = isCourierProduct(trip.productId);
  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <p className="text-[52px] leading-none font-semibold tracking-[-0.04em] tabular-nums">
          {formatMoney(trip.totalCents)}
        </p>
        <p className="text-muted-foreground shrink-0 pb-1 text-[17px] font-medium tabular-nums">
          {secondsLeft}s
        </p>
      </div>

      <p className="mt-2 text-[17px] font-medium tracking-tight tabular-nums">
        {productLabel(trip.productId)} · {trip.distanceMiles.toFixed(1)} mi ·{" "}
        {trip.tripMinutes} min
      </p>
      {/* The second decision input: how much unpaid driving comes first. */}
      <p className="text-lime mt-1 text-[19px] font-semibold tracking-tight tabular-nums">
        {trip.arrivalMinutes} min away
      </p>

      <RouteRail
        pickup={trip.pickupAddress}
        destination={trip.destinationAddress}
        courier={courier}
        className="mt-4"
      />

      {/* A refused accept dismisses the offer, so the reason belongs on the
          peek the driver lands back on — never on the next ride's card. */}

      {/* Determinate: the denominator is real, so the bar is honest. */}
      <div
        className="bg-muted mt-4 h-2 overflow-hidden rounded-full"
        role="timer"
        aria-label={`${secondsLeft} seconds to decide`}
      >
        <div
          className="bg-lime h-full rounded-full transition-[width] duration-200 ease-linear"
          style={{
            width: `${Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100))}%`,
          }}
        />
      </div>

      <Button
        size="lg"
        className="mt-3 h-16 w-full text-[19px]"
        aria-busy={busy || undefined}
        disabled={busy}
        onClick={onAccept}
      >
        {busy ? "Taking this ride…" : "Accept"}
      </Button>
      <Button
        variant="ghost"
        className="text-muted-foreground mt-1 h-12 w-full"
        disabled={busy}
        onClick={onDecline}
      >
        Decline
      </Button>
    </>
  );
}

/* ------------------------------------------------------------------- job */

export function DriverJobScene({
  scene,
  trip,
  courier,
  pickupCode,
  onPickupCode,
  deliveryCode,
  onDeliveryCode,
  busy,
  error,
  onAdvance,
}: {
  scene: Extract<DriverAppState, "to_pickup" | "at_pickup" | "on_trip">;
  trip: JobTrip;
  courier: boolean;
  pickupCode: string;
  onPickupCode: (next: string) => void;
  deliveryCode: string;
  onDeliveryCode: (next: string) => void;
  busy: boolean;
  error: string | null;
  onAdvance: () => void;
}) {
  const question = driverAppQuestion(scene, courier);
  const heading = scene === "on_trip" ? trip.destinationAddress : trip.pickupAddress;
  const proof = trip.deliveryProof;
  const showPin = !courier && Boolean(trip.pickupPin) && scene !== "on_trip";

  return (
    <>
      <p className="text-lime text-xs font-semibold tracking-[0.14em] uppercase">
        {courier ? courierOrderLabel(trip.id) : productLabel(trip.productId)} ·{" "}
        {formatMoney(trip.totalCents)}
      </p>
      <h2 className="mt-1 text-[26px] leading-tight font-semibold tracking-[-0.03em]">
        {question.question}
      </h2>

      <div className="mt-3 flex items-start gap-3">
        <span
          className={cn(
            "mt-1.5 size-3 shrink-0",
            scene === "on_trip"
              ? "bg-foreground rounded-[3px]"
              : "border-foreground rounded-full border-[3px]",
          )}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[19px] leading-snug font-medium tracking-tight">
            {heading}
          </p>
          {scene !== "on_trip" && trip.pickupMeetingPoint ? (
            <p className="text-muted-foreground mt-0.5 text-[15px] leading-snug">
              {trip.pickupMeetingPoint}
            </p>
          ) : null}
        </div>
      </div>

      {showPin ? (
        <div className="bg-lime text-lime-foreground mt-3 flex items-center justify-between gap-4 rounded-2xl px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.14em] uppercase">
              Pickup PIN
            </p>
            <p className="mt-0.5 text-[15px] opacity-80">
              Read it back at the curb.
            </p>
          </div>
          <p className="shrink-0 text-4xl font-bold tracking-[0.1em] tabular-nums">
            {trip.pickupPin}
          </p>
        </div>
      ) : null}

      {/* Rider identity: who to look for, and how to reach them. */}
      {!courier && trip.riderName ? (
        <ProviderCard
          className="mt-3"
          compact
          provider={{ id: trip.id, name: trip.riderName }}
          eta={scene === "at_pickup" ? "Waiting at the curb" : null}
          actions={
            // No masked numbers in this build, so the affordance only exists
            // when there is a real number behind it.
            trip.riderPhone ? (
              <Button
                variant="outline"
                size="icon-lg"
                nativeButton={false}
                aria-label={`Call ${trip.riderName}`}
                render={<a href={`tel:${trip.riderPhone}`} />}
              >
                <Icon icon={Call02Icon} size={18} aria-hidden="true" />
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {courier && trip.recipientName ? (
        <div className="bg-muted/60 mt-3 rounded-2xl px-4 py-3">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
            {scene === "on_trip" ? "Deliver to" : "Recipient"}
          </p>
          <p className="mt-0.5 text-[17px] font-medium tracking-tight">
            {trip.recipientName}
          </p>
          <p className="text-muted-foreground text-[15px] tabular-nums">
            {trip.packageCount === 1
              ? "1 package"
              : `${trip.packageCount} packages`}
            {proof === "door"
              ? " · leave at door"
              : proof === "signature"
                ? " · signature required"
                : ""}
          </p>
        </div>
      ) : null}

      <NavigateLink address={heading} className="mt-3" />

      <SheetActions>
        {/* The code field *is* the answer to this scene's question, so it
            only exists on the scene that asks it. */}
        {courier && scene === "at_pickup" ? (
          <CodeField
            label="Merchant pickup code"
            value={pickupCode}
            onChange={onPickupCode}
          />
        ) : null}
        {courier && scene === "on_trip" && proof === "hand" ? (
          <CodeField
            label="Recipient PIN"
            value={deliveryCode}
            onChange={onDeliveryCode}
          />
        ) : null}
        {error ? (
          <p role="alert" className="text-destructive pb-1 text-[15px]">
            {error}
          </p>
        ) : null}
        <Button
          size="lg"
          className="h-16 w-full text-[19px]"
          aria-busy={busy || undefined}
          disabled={busy}
          onClick={onAdvance}
        >
          {question.action}
        </Button>
      </SheetActions>
    </>
  );
}

/* -------------------------------------------------------------- complete */

/** The fare, for a beat, then straight back into the hunt. */
export function DriverCompleteScene({
  trip,
  todayCents,
  courier,
  onDone,
}: {
  trip: JobTrip;
  todayCents: number;
  courier: boolean;
  onDone: () => void;
}) {
  const question = driverAppQuestion("complete", courier);
  return (
    <>
      <p className="text-lime text-xs font-semibold tracking-[0.14em] uppercase">
        {courier ? "Delivered" : "Ride finished"}
      </p>
      <p className="mt-1 text-[52px] leading-none font-semibold tracking-[-0.04em] tabular-nums">
        {formatMoney(trip.totalCents)}
      </p>
      <p className="text-muted-foreground mt-2 text-[17px] leading-snug">
        {splitAddress(trip.destinationAddress).line}
      </p>
      <p className="mt-3 text-[17px] font-medium tracking-tight tabular-nums">
        {formatMoney(todayCents)}
        <span className="text-muted-foreground ml-1 font-normal">today</span>
      </p>

      <SheetActions>
        <Button size="lg" className="h-16 w-full text-[19px]" onClick={onDone}>
          {question.action}
        </Button>
      </SheetActions>
    </>
  );
}

/* ------------------------------------------------------------------ bits */

function CodeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="block pb-2">
      <span className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
        {label}
      </span>
      <Input
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={8}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="0000"
        className="mt-1.5 h-14 rounded-2xl text-center text-2xl font-semibold tracking-[0.2em] tabular-nums"
      />
    </label>
  );
}

/**
 * No turn-by-turn in this build. Handing the address to the phone's own maps
 * app is what a lot of drivers do anyway, and it is honest about the gap.
 */
function NavigateLink({
  address,
  className,
}: {
  address: string;
  className?: string;
}) {
  return (
    <a
      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "ring-border hover:bg-muted focus-visible:ring-ring flex min-h-11 w-fit items-center gap-2 rounded-full px-4 text-[15px] font-semibold tracking-tight ring-1 focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      <Icon icon={Navigation03Icon} size={18} aria-hidden="true" />
      Open in Maps
    </a>
  );
}

/** dot → line → square. The same route language the rider app uses. */
export function RouteRail({
  pickup,
  destination,
  courier = false,
  className,
}: {
  pickup: string;
  destination: string;
  courier?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-[auto_1fr] gap-x-3.5", className)}>
      <span
        className="border-foreground mt-1.5 size-3 rounded-full border-[3px]"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
          {courier ? "Merchant" : "Pickup"}
        </p>
        <p className="text-[17px] leading-snug font-medium tracking-tight">
          {pickup}
        </p>
      </div>
      <span
        className="bg-border mx-auto my-1 h-5 w-0.5 rounded-full"
        aria-hidden="true"
      />
      <span aria-hidden="true" />
      <span
        className="bg-foreground mt-1.5 size-3 rounded-[3px]"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
          {courier ? "Deliver to" : "Destination"}
        </p>
        <p className="text-[17px] leading-snug tracking-tight">{destination}</p>
      </div>
    </div>
  );
}

/** A tap target on the canvas, not sheet content: it never answers a scene. */
export function MapControl({
  label,
  href,
  onPress,
  className,
  children,
}: {
  label: string;
  href?: string;
  onPress?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const classes = cn(
    "bg-card ring-border focus-visible:ring-ring relative inline-flex size-11 items-center justify-center rounded-full shadow-[0_4px_16px_rgba(26,24,20,0.12)] ring-1 touch-manipulation focus-visible:ring-2 focus-visible:outline-none",
    className,
  );
  if (href) {
    return (
      <Link href={href} aria-label={label} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={onPress} className={classes}>
      {children}
    </button>
  );
}
