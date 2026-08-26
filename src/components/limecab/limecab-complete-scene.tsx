"use client";

import { StarIcon } from "@hugeicons/core-free-icons";

import { CompletionPanel } from "@/components/service-app/completion-panel";
import { PrimaryAction } from "@/components/service-app/task-scene";
import { DetailButton } from "@/components/limecab/limecab-parts";
import { Icon } from "@/components/ui/icon";
import { RouteRail } from "@/components/limecab/limecab-status-scene";
import type { DetailKind } from "@/components/limecab/limecab-interrupts";
import { TIP_PRESETS, type Trip } from "@/lib/limecab/domain";
import { courierProofLabel } from "@/lib/limecab/courier";
import { formatMoney } from "@/lib/service-app/services";
import { cn } from "@/lib/utils";

/** Arrival: the total, then the two things only the rider can add. */
export function LimeCabCompleteScene({
  pickupLine,
  destinationLine,
  trip,
  rating,
  onRate,
  tipCents,
  onTip,
  onDone,
  onOpenDetail,
  headline = "You've arrived",
  totalLabel = "Trip total",
  providerNoun = "your driver",
}: {
  pickupLine: string;
  destinationLine: string;
  trip: Trip | null;
  rating: number | null;
  onRate: (next: number) => void;
  tipCents: number | null;
  onTip: (next: number | null) => void;
  onDone: () => void;
  onOpenDetail: (kind: DetailKind) => void;
  headline?: string;
  totalLabel?: string;
  providerNoun?: string;
}) {
  const fare = trip?.fare;

  return (
    <CompletionPanel
      headline={headline}
      summary={`${trip?.tripMinutes ?? 0} min · ${trip?.distanceMiles ?? 0} mi`}
      totalCents={(fare?.totalCents ?? 0) + (tipCents ?? 0)}
      totalLabel={totalLabel}
      lines={
        fare
          ? [
              { label: "Base fare", value: formatMoney(fare.baseCents) },
              {
                label: `Distance · ${trip?.distanceMiles ?? 0} mi`,
                value: formatMoney(fare.distanceCents),
              },
              {
                label: `Time · ${trip?.tripMinutes ?? 0} min`,
                value: formatMoney(fare.timeCents),
              },
              { label: "Booking fee", value: formatMoney(fare.bookingCents) },
              ...(tipCents
                ? [{ label: "Tip", value: formatMoney(tipCents) }]
                : []),
            ]
          : undefined
      }
      detail={
        <div className="flex flex-col gap-4">
          <RouteRail pickup={pickupLine} destination={destinationLine} />
          {trip?.courier ? (
            <div className="bg-muted/60 rounded-2xl p-4">
              <p className="text-[15px] font-medium tracking-tight">
                {courierProofLabel(trip.courier.proof)}
              </p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {trip.courier.packageCount === 1
                  ? "1 package"
                  : `${trip.courier.packageCount} packages`}{" "}
                · {trip.courier.recipientName}
              </p>
            </div>
          ) : null}
          <RatePanel
            name={trip?.driver.name ?? providerNoun}
            value={rating}
            onRate={onRate}
          />
          <TipPanel value={tipCents} onTip={onTip} />
          {/* Honest: nothing here leaves the device in this build. */}
          <p className="text-muted-foreground text-xs leading-relaxed">
            Your rating and tip stay on this device. This build has no endpoint
            to send them to, so nothing was submitted.
          </p>
        </div>
      }
      actions={
        <div className="bg-card border-border sticky bottom-0 -mx-5 flex flex-col gap-2 border-t px-5 pt-3 pb-1 md:-mx-6 md:px-6">
          <PrimaryAction onClick={onDone}>Done</PrimaryAction>
          <DetailButton onPress={() => onOpenDetail("receipt")}>
            View receipt
          </DetailButton>
        </div>
      }
    />
  );
}

/** Flat tip amounts. Percentages make the rider do arithmetic to be kind. */
function TipPanel({
  value,
  onTip,
}: {
  value: number | null;
  onTip: (next: number | null) => void;
}) {
  return (
    <div className="bg-muted/60 rounded-2xl p-4">
      <p className="text-[15px] font-medium tracking-tight">
        {value ? "Tip added to your total" : "Add a tip?"}
      </p>
      <div className="mt-3 flex gap-2">
        {TIP_PRESETS.map((amount) => {
          const selected = value === amount;
          return (
            <button
              key={amount}
              type="button"
              aria-pressed={selected}
              onClick={() => onTip(selected ? null : amount)}
              className={cn(
                "ring-border focus-visible:ring-ring h-12 flex-1 rounded-full text-[15px] font-semibold tabular-nums ring-1 focus-visible:ring-2 focus-visible:outline-none",
                selected
                  ? "bg-accent ring-foreground text-foreground ring-2"
                  : "bg-card active:bg-accent",
              )}
            >
              {formatMoney(amount)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RatePanel({
  name,
  value,
  onRate,
}: {
  name: string;
  value: number | null;
  onRate: (next: number) => void;
}) {
  return (
    <div className="bg-muted/60 rounded-2xl p-4">
      <p className="text-[15px] font-medium tracking-tight">
        {value ? "Thanks for the feedback" : `How was your ride with ${name}?`}
      </p>
      <div
        className="mt-2 flex gap-1"
        role="radiogroup"
        aria-label="Rate your ride"
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            onClick={() => onRate(star)}
            className="focus-visible:ring-ring flex size-12 items-center justify-center rounded-xl focus-visible:ring-2 focus-visible:outline-none"
          >
            <Icon
              icon={StarIcon}
              size={32}
              className={cn(
                value !== null && star <= value
                  ? "text-lime"
                  : "text-muted-foreground",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
