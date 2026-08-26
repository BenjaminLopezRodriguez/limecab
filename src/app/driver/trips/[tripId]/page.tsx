"use client";

import { use, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/service-app/services";
import {
  driverMay,
  isTerminalStatus,
  isTripStatus,
  type DriverAction,
} from "@/server/limecab/state";
import { api } from "@/trpc/react";

/** Every action the state machine can offer a driver, in ride order. */
const ADVANCE_ACTIONS: {
  action: Exclude<DriverAction, "accept">;
  label: string;
}[] = [
  { action: "arrive", label: "I’ve arrived" },
  { action: "start", label: "Start ride" },
  { action: "complete", label: "Complete ride" },
];

const STATUS_LABEL: Record<string, string> = {
  requested: "Waiting for a driver",
  matched: "Head to pickup",
  arriving: "At the curb",
  in_progress: "Rider on board",
  complete: "Completed",
  cancelled: "Cancelled",
};

/** What the driver is doing right now, above the phase title. */
const STATUS_EYEBROW: Record<string, string> = {
  requested: "Ride offer",
  matched: "Driving to pickup",
  arriving: "Waiting for your rider",
  in_progress: "Driving to destination",
  complete: "Ride finished",
  cancelled: "Ride ended",
};

export default function DriverTripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = use(params);
  const utils = api.useUtils();
  const [taken, setTaken] = useState(false);

  const trip = api.driver.get.useQuery(
    { tripId },
    {
      // No sockets in this build: poll, and stop once the ride can't change.
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status && isTripStatus(status) && isTerminalStatus(status)
          ? false
          : 4_000;
      },
    },
  );

  // The server refuses an off-duty accept; don't offer a button that will fail.
  const me = api.driver.me.useQuery();
  const offDuty = me.data ? !me.data.driver?.available : false;

  const accept = api.driver.accept.useMutation({
    onMutate: () => setTaken(false),
    onSuccess: () => {
      void trip.refetch();
      void utils.driver.inbox.invalidate();
    },
    onError: (error) => {
      if (error.data?.code === "CONFLICT") {
        setTaken(true);
        void trip.refetch();
        void utils.driver.inbox.invalidate();
      }
    },
  });

  const advance = api.driver.advance.useMutation({
    onSuccess: () => {
      void trip.refetch();
      void utils.driver.inbox.invalidate();
    },
  });

  if (trip.error) {
    return (
      <div className="mt-8">
        <p role="alert" className="text-[19px] font-medium">
          We couldn’t open this ride.
        </p>
        <p className="text-muted-foreground mt-1.5 text-[15px]">
          {trip.error.message}
        </p>
        <Button
          size="lg"
          className="mt-7 h-16 w-full text-[17px]"
          render={<Link href="/driver" />}
        >
          Back to inbox
        </Button>
      </div>
    );
  }

  if (!trip.data) {
    return (
      <div className="mt-6" aria-busy="true">
        <div className="bg-muted h-44 w-full animate-pulse rounded-3xl" />
        <div className="bg-muted mt-4 h-16 w-full animate-pulse rounded-3xl" />
        <span className="sr-only">Loading this ride</span>
      </div>
    );
  }

  const ride = trip.data;
  const status = isTripStatus(ride.status) ? ride.status : "cancelled";
  const pending = accept.isPending || advance.isPending;
  const conflictMessage = taken
    ? "Another driver took this ride. Back to the inbox for the next one."
    : null;
  const otherError =
    (!taken && accept.error ? accept.error.message : null) ??
    (advance.error ? advance.error.message : null);

  const canAccept = driverMay(status, "accept");
  const advanceAction = ADVANCE_ACTIONS.find(({ action }) =>
    driverMay(status, action),
  );
  // One primary action at a time. With nothing left to do, going back is it.
  const hasPrimaryAction = canAccept || Boolean(advanceAction);

  return (
    <>
      <header className="mt-2">
        <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
          {STATUS_EYEBROW[status] ?? "Ride"}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
          {STATUS_LABEL[status] ?? status}
        </h1>
        <p className="text-muted-foreground mt-2 text-[15px] tabular-nums">
          {ride.distanceMiles.toFixed(1)} mi · {ride.tripMinutes} min ·{" "}
          <span className="text-foreground font-semibold">
            {formatMoney(ride.totalCents)}
          </span>
        </p>
      </header>

      {ride.pickupPin ? (
        <div className="bg-primary text-primary-foreground mt-6 flex items-center justify-between gap-4 rounded-3xl px-5 py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.14em] uppercase">
              Pickup PIN
            </p>
            <p className="mt-1 text-[15px] opacity-80">
              Read it back to the rider at the curb.
            </p>
          </div>
          <p className="shrink-0 text-5xl font-bold tracking-[0.12em] tabular-nums">
            {ride.pickupPin}
          </p>
        </div>
      ) : null}

      {/* Route rail: dot → line → square, so the job reads as a route. */}
      <div className="ring-border mt-4 grid grid-cols-[auto_1fr] gap-x-4 rounded-3xl px-5 py-5 ring-1">
        <span
          className="border-foreground mt-2 size-3.5 rounded-full border-[3px]"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
            Pickup
          </p>
          <p className="mt-1 text-[19px] leading-snug font-medium tracking-tight">
            {ride.pickupAddress}
          </p>
          {ride.pickupMeetingPoint ? (
            <p className="mt-1.5 text-[17px] leading-snug">
              Meeting point: {ride.pickupMeetingPoint}
            </p>
          ) : null}
        </div>
        <span
          className="bg-border mx-auto my-1.5 h-8 w-0.5 rounded-full"
          aria-hidden="true"
        />
        <span aria-hidden="true" />
        <span
          className="bg-foreground mt-2 size-3.5 rounded-[4px]"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
            Destination
          </p>
          <p className="mt-1 text-[19px] leading-snug font-medium tracking-tight">
            {ride.destinationAddress}
          </p>
        </div>
      </div>

      {(conflictMessage ?? otherError) ? (
        <p role="alert" className="text-destructive mt-4 text-[15px]">
          {conflictMessage ?? otherError}
        </p>
      ) : null}

      {/* Thumb zone: one full-width action, always reachable in a car mount. */}
      <div className="bg-background border-border sticky bottom-0 -mx-5 mt-8 border-t px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {canAccept ? (
          <>
            <Button
              size="lg"
              className="h-16 w-full text-[17px]"
              aria-busy={accept.isPending || undefined}
              aria-describedby={offDuty ? "accept-off-duty" : undefined}
              disabled={pending || offDuty}
              onClick={() => accept.mutate({ tripId })}
            >
              {accept.isPending ? "Accepting…" : "Accept ride"}
            </Button>
            {offDuty ? (
              <p
                id="accept-off-duty"
                className="text-muted-foreground mt-2 text-center text-[15px]"
              >
                Go online from the inbox to accept rides.
              </p>
            ) : null}
          </>
        ) : null}
        {advanceAction ? (
          <Button
            size="lg"
            className="h-16 w-full text-[17px]"
            aria-busy={advance.isPending || undefined}
            disabled={pending}
            onClick={() =>
              advance.mutate({ tripId, action: advanceAction.action })
            }
          >
            {advanceAction.label}
          </Button>
        ) : null}
        <Button
          size="lg"
          variant={hasPrimaryAction ? "ghost" : "default"}
          className={
            hasPrimaryAction ? "mt-1 h-12 w-full" : "h-16 w-full text-[17px]"
          }
          render={<Link href="/driver" />}
        >
          Back to inbox
        </Button>
      </div>
    </>
  );
}
