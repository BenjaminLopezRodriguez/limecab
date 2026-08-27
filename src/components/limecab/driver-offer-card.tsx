"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { productLabel } from "@/lib/limecab/format";
import { formatMoney } from "@/lib/service-app/services";
import { api } from "@/trpc/react";

const OFFER_SECONDS = 20;

type OpenTrip = {
  id: string;
  productId: string;
  totalCents: number;
  distanceMiles: number;
  tripMinutes: number;
  arrivalMinutes: number;
  pickupAddress: string;
  destinationAddress: string;
};

export function DriverOfferCard({
  trip,
  available,
  onGone,
}: {
  trip: OpenTrip;
  available: boolean;
  onGone: (tripId: string) => void;
}) {
  const router = useRouter();
  const gone = useRef(onGone);
  gone.current = onGone;
  const [left, setLeft] = useState(OFFER_SECONDS);
  const accept = api.driver.accept.useMutation({
    onSuccess: () => {
      router.push(`/driver/trips/${trip.id}`);
    },
  });

  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => {
      const remaining = OFFER_SECONDS - Math.floor((Date.now() - started) / 1000);
      if (remaining <= 0) {
        window.clearInterval(id);
        gone.current(trip.id);
        return;
      }
      setLeft(remaining);
    }, 250);
    return () => window.clearInterval(id);
  }, [trip.id]);

  return (
    <article className="ring-border rounded-3xl px-5 py-5 ring-1">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-4xl font-semibold tracking-[-0.03em] tabular-nums">
          {formatMoney(trip.totalCents)}
        </p>
        <p className="text-muted-foreground shrink-0 text-[15px] tabular-nums">
          {left}s
        </p>
      </div>
      <p className="mt-1 text-[15px] font-medium tabular-nums">
        {productLabel(trip.productId)} · {trip.distanceMiles.toFixed(1)} mi ·{" "}
        {trip.tripMinutes} min
        {trip.arrivalMinutes ? ` · ${trip.arrivalMinutes} min to pickup` : ""}
      </p>

      <Link
        href={`/driver/trips/${trip.id}`}
        className="focus-visible:ring-ring mt-4 grid grid-cols-[auto_1fr] gap-x-3.5 rounded-2xl focus-visible:ring-2 focus-visible:outline-none"
      >
        <span
          className="border-foreground mt-1.5 size-3 rounded-full border-[3px]"
          aria-hidden="true"
        />
        <p className="text-[17px] leading-snug font-medium tracking-tight">
          {trip.pickupAddress}
        </p>
        <span
          className="bg-border mx-auto my-1 h-6 w-0.5 rounded-full"
          aria-hidden="true"
        />
        <span aria-hidden="true" />
        <span
          className="bg-foreground mt-1.5 size-3 rounded-[3px]"
          aria-hidden="true"
        />
        <p className="text-muted-foreground text-[17px] leading-snug tracking-tight">
          {trip.destinationAddress}
        </p>
      </Link>

      {accept.error ? (
        <p role="alert" className="text-destructive mt-3 text-sm">
          {accept.error.message}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-12"
          onClick={() => onGone(trip.id)}
        >
          Decline
        </Button>
        <Button
          type="button"
          className="h-12"
          disabled={!available || accept.isPending}
          onClick={() => accept.mutate({ tripId: trip.id })}
        >
          {accept.isPending ? "Accepting…" : "Accept"}
        </Button>
      </div>
    </article>
  );
}
