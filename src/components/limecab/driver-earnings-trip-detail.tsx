"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Alert01Icon,
  Call02Icon,
  Message01Icon,
  Notification01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

import { RouteRail } from "@/components/limecab/limecab-status-scene";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Icon } from "@/components/ui/icon";
import { formatTripWhen, productLabel } from "@/lib/limecab/format";
import { formatMoney, obscureAddress } from "@/lib/service-app/services";
import { cn } from "@/lib/utils";

const RECEIPT =
  "bg-card ring-border overflow-hidden rounded-lg shadow-[0_1px_2px_rgba(26,24,20,0.05)] ring-1";

const RESOLUTION_CONTROL =
  "bg-card ring-border focus-visible:ring-ring flex size-14 items-center justify-center rounded-full shadow-[0_2px_8px_rgba(26,24,20,0.1)] ring-1 touch-manipulation focus-visible:ring-2 focus-visible:outline-none hover:bg-accent/40 active:bg-accent";

type ResolutionSheet = "notify" | "message" | "emergency";

type EarningsTrip = {
  id: string;
  productId: string;
  pickupAddress: string;
  destinationAddress: string;
  totalCents: number;
  baseCents: number;
  distanceCents: number;
  timeCents: number;
  bookingCents: number;
  distanceMiles: number;
  tripMinutes: number;
  completedAt: Date | null;
  requestedAt: Date;
};

export function DriverEarningsTripDetail({ trip }: { trip: EarningsTrip }) {
  const [sheet, setSheet] = useState<ResolutionSheet | null>(null);
  const when = trip.completedAt ?? trip.requestedAt;
  const pickupArea = obscureAddress(trip.pickupAddress);
  const destinationArea = obscureAddress(trip.destinationAddress);

  return (
    <>
      <div className="flex flex-col items-center text-center">
        <p className="text-5xl font-semibold tracking-[-0.04em] tabular-nums">
          {formatMoney(trip.totalCents)}
        </p>
        <p className="text-muted-foreground mt-2 text-sm tabular-nums">
          {productLabel(trip.productId)} · {formatTripWhen(when)}
        </p>
        <p className="text-muted-foreground mt-1 text-sm tabular-nums">
          {trip.tripMinutes} min · {trip.distanceMiles.toFixed(1)} mi
        </p>

        <div className={cn(RECEIPT, "mt-8 w-full text-left")}>
          <div className="p-4">
            <RouteRail
              pickup={pickupArea}
              destination={destinationArea}
              className="bg-transparent p-0"
            />
            <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
              Exact addresses stay private after the trip ends.
            </p>
          </div>
          <div className="border-border border-t p-4">
            <dl className="space-y-2 text-sm tabular-nums">
              <FareLine label="Base" value={formatMoney(trip.baseCents)} />
              <FareLine
                label={`Distance · ${trip.distanceMiles.toFixed(1)} mi`}
                value={formatMoney(trip.distanceCents)}
              />
              <FareLine
                label={`Time · ${trip.tripMinutes} min`}
                value={formatMoney(trip.timeCents)}
              />
              <FareLine
                label="Booking fee"
                value={formatMoney(trip.bookingCents)}
              />
            </dl>
            <div className="border-border mt-4 flex items-baseline justify-between gap-4 border-t border-dashed pt-4">
              <span className="text-[15px] font-semibold tracking-tight">
                You earned
              </span>
              <span className="text-[17px] font-semibold tabular-nums">
                {formatMoney(trip.totalCents)}
              </span>
            </div>
          </div>
        </div>

        <TripResolutionActions onOpen={setSheet} />
      </div>

      <ResolutionSheetDrawer
        sheet={sheet}
        tripId={trip.id}
        onClose={() => setSheet(null)}
      />
    </>
  );
}

function FareLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function TripResolutionActions({
  onOpen,
}: {
  onOpen: (sheet: ResolutionSheet) => void;
}) {
  return (
    <div
      className="mt-10 flex items-center justify-center gap-6"
      aria-label="Trip resolution"
    >
      <ResolutionActionButton
        label="Notify support about this fare"
        icon={Notification01Icon}
        onClick={() => onOpen("notify")}
      />
      <ResolutionActionButton
        label="Message support"
        icon={Message01Icon}
        onClick={() => onOpen("message")}
      />
      <ResolutionActionButton
        label="Safety and emergency"
        icon={Alert01Icon}
        destructive
        onClick={() => onOpen("emergency")}
      />
    </div>
  );
}

function ResolutionActionButton({
  label,
  icon,
  onClick,
  destructive = false,
}: {
  label: string;
  icon: IconSvgElement;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        RESOLUTION_CONTROL,
        destructive &&
          "text-destructive hover:bg-destructive/10 active:bg-destructive/10",
      )}
    >
      <Icon icon={icon} size={24} aria-hidden="true" />
    </button>
  );
}

function ResolutionSheetDrawer({
  sheet,
  tripId,
  onClose,
}: {
  sheet: ResolutionSheet | null;
  tripId: string;
  onClose: () => void;
}) {
  const subject = encodeURIComponent(`Trip ${tripId}`);
  const fareBody = encodeURIComponent(
    `Fare follow-up for trip ${tripId}\n\nWhat looked wrong:\n`,
  );
  const messageBody = encodeURIComponent(
    `Question about trip ${tripId}\n\n`,
  );

  return (
    <Drawer
      open={sheet !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      modal
      showSwipeHandle
    >
      <DrawerContent className="pb-[max(1rem,env(safe-area-inset-bottom))]">
        {sheet === "notify" ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Fare follow-up</DrawerTitle>
              <DrawerDescription>
                Something off with this payout? Tell us and we&apos;ll attach
                this trip automatically.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <Button
                size="lg"
                className="h-16 w-full text-[17px]"
                nativeButton={false}
                render={
                  <a
                    href={`mailto:drivers@limecab.app?subject=${subject}&body=${fareBody}`}
                  />
                }
              >
                Email fare support
              </Button>
            </DrawerFooter>
          </>
        ) : null}

        {sheet === "message" ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Message support</DrawerTitle>
              <DrawerDescription>
                Questions about this trip? The drivers team replies by email.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <Button
                size="lg"
                className="h-16 w-full text-[17px]"
                nativeButton={false}
                render={
                  <a
                    href={`mailto:drivers@limecab.app?subject=${subject}&body=${messageBody}`}
                  />
                }
              >
                Start an email
              </Button>
            </DrawerFooter>
          </>
        ) : null}

        {sheet === "emergency" ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Safety</DrawerTitle>
              <DrawerDescription>
                If anyone is hurt, call 911 first. Then reach LimeCab safety
                if you need help with this trip.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter className="gap-2">
              <Button
                variant="destructive"
                size="lg"
                className="h-16 w-full gap-2.5 text-[17px]"
                nativeButton={false}
                render={<a href="tel:911" />}
              >
                <Icon icon={Call02Icon} size={22} aria-hidden="true" />
                Call 911
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="h-14 w-full text-[17px]"
                nativeButton={false}
                render={
                  <a href={`mailto:safety@limecab.app?subject=${subject}`} />
                }
              >
                Report to LimeCab safety
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="text-muted-foreground h-12 w-full text-[15px]"
                nativeButton={false}
                render={<Link href="/driver/profile/safety" />}
              >
                Safety settings
              </Button>
            </DrawerFooter>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
