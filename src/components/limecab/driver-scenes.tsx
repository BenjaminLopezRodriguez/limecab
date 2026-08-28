"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import {
  Analytics01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  Call02Icon,
  HandIcon,
  Loading03Icon,
  Location01Icon,
  Menu01Icon,
  Navigation03Icon,
  PromotionIcon,
  Shield01Icon,
  SlidersHorizontalIcon,
  SteeringIcon,
} from "@hugeicons/core-free-icons";

import { ProviderCard } from "@/components/service-app/provider-card";
import { SheetActions } from "@/components/service-app/service-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { courierOrderLabel, isCourierProduct } from "@/lib/limecab/courier";
import {
  helpVisitLabel,
  isCareProduct,
  isHelpProduct,
} from "@/lib/limecab/help";
import {
  parseShopList,
  shopItemCountLabel,
} from "@/lib/limecab/shop-list";
import { daypart } from "@/lib/limecab/daypart";
import {
  driverAppQuestion,
  driverJobKind,
  type DriverAppState,
  type DriverJobKind,
} from "@/lib/limecab/driver-state";
import { productLabel } from "@/lib/limecab/format";
import type { RestStop } from "@/lib/limecab/rest-stops";
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
  /** Lime Shop's list, as stored. Null on every other job. */
  itemList?: string | null;
  /** When a Help visit is due. Null on a job that starts now. */
  scheduledAt?: Date | string | null;
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
  /** True when the rider has a PIN. The digits never leave the server. */
  pinRequired: boolean;
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
 * Off duty is a *home*, not a dimmed dash.
 *
 * The driver is in the house: they read a page, glance at where it is busy on
 * a map card, and then decide. Only the lime pill takes them on duty — not the
 * map, not the card's expand control, not a row.
 *
 * The headline pair is its own component because it sits in the shell's header
 * slot, *above* the map card, which is the whole point of the composition.
 */
export function DriverOfflineHeadline({
  onOpenSafety,
  onOpenPreferences,
}: {
  onOpenSafety: () => void;
  onOpenPreferences: () => void;
}) {
  return (
    <div className="pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="flex justify-end gap-2">
        <MapControl label="Safety toolkit" onPress={onOpenSafety}>
          <Icon icon={Shield01Icon} size={20} aria-hidden="true" />
        </MapControl>
        <MapControl label="Driving preferences" onPress={onOpenPreferences}>
          <Icon icon={SlidersHorizontalIcon} size={20} aria-hidden="true" />
        </MapControl>
      </div>
      <h1 className="mt-3 text-[36px] leading-[1.05] font-semibold tracking-[-0.04em]">
        You’re offline
      </h1>
      <p className="mt-1 text-[21px] font-semibold tracking-[-0.02em]">
        Ready to go?
      </p>
    </div>
  );
}

/**
 * The rest of the offline page: what there is to know, then the one loud
 * thing to do. `areaLabel` is the locality the driver's own cell actually
 * names — there is no invented neighbourhood here, and no promise of money.
 */
export function DriverOfflineHome({
  areaLabel,
  busy,
  error,
  onGoOnline,
  onOpenTrends,
}: {
  areaLabel: string | null;
  busy: boolean;
  error: string | null;
  onGoOnline: () => void;
  onOpenTrends: () => void;
}) {
  const question = driverAppQuestion("offline");
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={onOpenTrends}
        className="focus-visible:ring-ring group mt-5 flex w-full items-start gap-3 rounded-2xl text-left focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[26px] leading-none font-semibold tracking-[-0.03em]">
            Opportunities
          </span>
          <span className="text-muted-foreground mt-4 flex items-center gap-1.5 text-[13px] font-medium">
            <Icon icon={Analytics01Icon} size={15} aria-hidden="true" />
            Earnings
          </span>
          <span className="mt-1 block text-[19px] leading-snug font-semibold tracking-[-0.02em]">
            {areaLabel
              ? `Earnings trends in ${areaLabel}`
              : "Not enough trips yet"}
          </span>
        </span>
        <span className="bg-muted group-hover:bg-accent flex size-9 shrink-0 items-center justify-center rounded-full">
          <Icon icon={ArrowRight01Icon} size={18} aria-hidden="true" />
        </span>
      </button>

      {/* The one loud thing, in the thumb zone. */}
      <div className="mt-6 md:mt-auto md:pt-8">
        {error ? (
          <p role="alert" className="text-destructive pb-2 text-[15px]">
            {error}
          </p>
        ) : null}
        <Button
          size="lg"
          className="bg-lime text-lime-foreground hover:bg-lime/85 h-16 w-full rounded-full text-[19px]"
          aria-busy={busy || undefined}
          disabled={busy}
          onClick={onGoOnline}
        >
          {busy ? (
            <Icon
              icon={Loading03Icon}
              size={22}
              className="motion-safe:animate-spin"
              aria-hidden="true"
            />
          ) : (
            <>
              <Icon icon={SteeringIcon} size={22} aria-hidden="true" />
              {question.action}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * On duty and hunting. The peek is *status*, not a question with two
 * primaries: the map is the subject, and the only thing this row says is what
 * time of day it is and where the two ways deeper are.
 *
 * Going offline is deliberately not here — it lives on the circle in
 * Recommended, so a knee on a dash mount cannot end a shift.
 */
export function DriverHuntingPeek({
  onOpenPreferences,
  onOpenRecommended,
}: {
  onOpenPreferences: () => void;
  onOpenRecommended: () => void;
}) {
  const part = daypart();
  return (
    <div className="flex items-center gap-3">
      <PeekIcon label="Driving preferences" onPress={onOpenPreferences}>
        <Icon icon={SlidersHorizontalIcon} size={22} aria-hidden="true" />
      </PeekIcon>
      <div className="min-w-0 flex-1 text-center">
        <p className="text-[21px] leading-tight font-semibold tracking-[-0.02em]">
          {part.headline}
        </p>
        <p className="text-muted-foreground mt-0.5 text-[15px] leading-snug">
          {part.sub}
        </p>
      </div>
      <PeekIcon label="Recommended for you" onPress={onOpenRecommended}>
        <Icon icon={Menu01Icon} size={22} aria-hidden="true" />
      </PeekIcon>
    </div>
  );
}

function PeekIcon({
  label,
  onPress,
  selected = false,
  children,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected || undefined}
      onClick={onPress}
      className={cn(
        "focus-visible:ring-ring flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none",
        selected ? "bg-accent text-accent-foreground" : "hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

/**
 * The hunting peek, opened out. Uber calls it "Recommended for you"; what it
 * actually is, is the place a shift ends — so the stop control is a circle in
 * the thumb zone with a destructive ring, not a ghost row anyone can brush.
 *
 * Rows with nothing true to say are honest about it. Nothing here invents a
 * promotion, a quest, or a busy neighbourhood.
 */
export function DriverRecommendedScene({
  busy,
  error,
  headingAddress,
  onClose,
  onOpenTrends,
  onOpenHeading,
  onOpenPreferences,
  onGoOffline,
}: {
  busy: boolean;
  error: string | null;
  headingAddress: string | null;
  onClose: () => void;
  onOpenTrends: () => void;
  onOpenHeading: () => void;
  onOpenPreferences: () => void;
  onGoOffline: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3">
        <PeekIcon label="Back to the map" onPress={onClose}>
          <Icon icon={ArrowDown01Icon} size={22} aria-hidden="true" />
        </PeekIcon>
        <p className="min-w-0 flex-1 text-center text-[21px] font-semibold tracking-[-0.02em]">
          Recommended for you
        </p>
        <PeekIcon label="Recommended for you" onPress={onClose} selected>
          <Icon icon={Menu01Icon} size={22} aria-hidden="true" />
        </PeekIcon>
      </div>

      <p className="text-muted-foreground mt-5 text-center text-[13px] font-semibold tracking-[0.08em] uppercase">
        Later today
      </p>

      <div className="ring-border mt-3 divide-y divide-[var(--border)] overflow-hidden rounded-2xl ring-1">
        <button
          type="button"
          onClick={onOpenTrends}
          className="hover:bg-muted focus-visible:ring-ring flex min-h-16 w-full items-center gap-3.5 px-4 text-left focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
        >
          <Icon icon={Analytics01Icon} size={22} aria-hidden="true" />
          <span className="flex-1 text-[17px] font-medium tracking-tight">
            See earnings trends
          </span>
          <Icon
            icon={ArrowRight01Icon}
            size={18}
            className="text-muted-foreground"
            aria-hidden="true"
          />
        </button>
        {/* The heading filter lives here rather than as a third chip on the
            peek: a driver on a dash mount cannot aim at three of them. */}
        <button
          type="button"
          onClick={onOpenHeading}
          className="hover:bg-muted focus-visible:ring-ring flex min-h-16 w-full items-center gap-3.5 px-4 text-left focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
        >
          <Icon icon={Location01Icon} size={22} aria-hidden="true" />
          <span className="flex-1 truncate text-[17px] font-medium tracking-tight">
            Heading
          </span>
          <span className="text-muted-foreground max-w-[45%] truncate text-[15px]">
            {headingAddress ? splitAddress(headingAddress).line : "Anywhere"}
          </span>
          <Icon
            icon={ArrowRight01Icon}
            size={18}
            className="text-muted-foreground"
            aria-hidden="true"
          />
        </button>
        {/* No promotions exist in this build, so the row says so rather than
            rendering a chevron into an empty screen. */}
        <div className="flex min-h-16 items-center gap-3.5 px-4">
          <Icon
            icon={PromotionIcon}
            size={22}
            className="text-muted-foreground"
            aria-hidden="true"
          />
          <span className="text-muted-foreground flex-1 text-[17px] tracking-tight">
            No promotions right now
          </span>
        </div>
      </div>

      <SheetActions>
        {error ? (
          <p role="alert" className="text-destructive pb-1 text-[15px]">
            {error}
          </p>
        ) : null}
        <div className="flex items-center gap-4">
          <PeekIcon label="Driving preferences" onPress={onOpenPreferences}>
            <Icon icon={SlidersHorizontalIcon} size={22} aria-hidden="true" />
          </PeekIcon>
          <div className="flex flex-1 flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={onGoOffline}
              disabled={busy}
              aria-busy={busy || undefined}
              className="border-destructive text-destructive hover:bg-destructive/5 focus-visible:ring-destructive flex size-[72px] touch-manipulation items-center justify-center rounded-full border-[3px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-70"
            >
              <Icon
                icon={busy ? Loading03Icon : HandIcon}
                size={30}
                className={cn(busy && "motion-safe:animate-spin")}
                aria-hidden="true"
              />
              <span className="sr-only">Go offline</span>
            </button>
            <span
              className="text-destructive text-[13px] font-semibold tracking-[0.08em] uppercase"
              aria-hidden="true"
            >
              Go offline
            </span>
          </div>
          {/* Balances the sliders so the circle sits on the centre line. */}
          <span className="size-11 shrink-0" aria-hidden="true" />
        </div>
      </SheetActions>
    </>
  );
}

/* ---------------------------------------------------------------- trends */

export type TrendCell = {
  h3: string;
  label: string | null;
  latitude: number;
  longitude: number;
  miles: number | null;
  current: boolean;
  buckets: number[][];
};

/** 4am first: a driver's day does not start at midnight. */
const CHART_HOURS = Array.from({ length: 24 }, (_, i) => (i + 4) % 24);

const DAY_NAMES = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

/**
 * Trends. The driver's own completed trips, by area and hour — never a
 * forecast, never other people's work, and never a seeded neighbourhood. A
 * driver with no history gets one card that says exactly that.
 */
export function DriverTrendsScene({
  cells,
  day,
  onDay,
  expanded,
  onSeeCharts,
  onFocusCell,
  onGoOnline,
  offline,
  busy,
}: {
  cells: TrendCell[];
  day: number;
  onDay: (day: number) => void;
  expanded: boolean;
  onSeeCharts: () => void;
  onFocusCell: (cell: TrendCell) => void;
  onGoOnline: () => void;
  offline: boolean;
  busy: boolean;
}) {
  const here = cells.find((cell) => cell.current) ?? cells[0] ?? null;
  const hour = new Date().getHours();

  return (
    <>
      {expanded ? (
        <>
          <div className="flex items-center gap-3">
            <PeekIcon label="Back to the map" onPress={onSeeCharts}>
              <Icon icon={ArrowDown01Icon} size={22} aria-hidden="true" />
            </PeekIcon>
            <p className="min-w-0 flex-1 text-center text-[21px] font-semibold tracking-[-0.02em]">
              Earnings Trends
            </p>
            <span className="size-11 shrink-0" aria-hidden="true" />
          </div>
          {/* Today first: a driver scrolling to find Friday on a Friday is a
              chip row that has been sorted for the calendar, not for them. */}
          <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
            {DAY_NAMES.map(
              (_, offset) => (new Date().getDay() + offset) % 7,
            ).map((index) => (
              <button
                key={index}
                type="button"
                onClick={() => onDay(index)}
                aria-pressed={index === day}
                className={cn(
                  "focus-visible:ring-ring min-h-10 shrink-0 rounded-full px-4 text-[15px] font-medium tracking-tight focus-visible:ring-2 focus-visible:outline-none",
                  index === day
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {DAY_NAMES[index]}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {cells.length === 0 ? (
              <TrendsEmptyCard />
            ) : (
              cells.map((cell) => (
                <div
                  key={cell.h3}
                  className="ring-border rounded-2xl p-4 ring-1"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[19px] font-semibold tracking-[-0.02em]">
                        {cell.label ?? "Your area"}
                      </p>
                      <p className="text-muted-foreground text-[15px] tabular-nums">
                        {cell.current
                          ? "Current area"
                          : cell.miles != null
                            ? `${cell.miles.toFixed(1)} mi`
                            : "Nearby"}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Show ${cell.label ?? "this area"} on the map`}
                      onClick={() => onFocusCell(cell)}
                      className="bg-lime/20 text-foreground hover:bg-lime/35 focus-visible:ring-ring flex size-9 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <Icon icon={ArrowUp01Icon} size={18} aria-hidden="true" />
                    </button>
                  </div>
                  <HourlyBars
                    hours={cell.buckets[day] ?? []}
                    currentHour={cell.current ? hour : null}
                    className="mt-3"
                  />
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-center text-[21px] font-semibold tracking-[-0.02em]">
            Earnings Trends
          </p>
          <p className="text-muted-foreground mt-0.5 text-center text-[15px]">
            {here?.label ?? "Your area"} · Showing trip trends
          </p>
          <div className="ring-border mt-4 rounded-2xl p-4 ring-1">
            <p className="text-[17px] font-semibold tracking-tight">
              Hourly trends
            </p>
            <p className="text-muted-foreground mt-0.5 text-[13px]">
              {here
                ? "This hour is highlighted"
                : "Trends fill in as you complete trips"}
            </p>
            <HourlyBars
              hours={here?.buckets[day] ?? []}
              currentHour={hour}
              className="mt-3"
            />
          </div>
          <SheetActions>
            {offline ? (
              <Button
                size="lg"
                className="bg-lime text-lime-foreground hover:bg-lime/85 h-14 w-full rounded-full text-[17px]"
                disabled={busy}
                aria-busy={busy || undefined}
                onClick={onGoOnline}
              >
                <Icon icon={SteeringIcon} size={20} aria-hidden="true" />
                Go online
              </Button>
            ) : null}
          </SheetActions>
        </>
      )}
    </>
  );
}

function TrendsEmptyCard() {
  return (
    <div className="ring-border rounded-2xl p-4 ring-1">
      <p className="text-[19px] font-semibold tracking-[-0.02em]">Your area</p>
      <p className="text-muted-foreground mt-0.5 text-[15px]">
        Trends fill in as you complete trips.
      </p>
      <HourlyBars hours={[]} currentHour={null} className="mt-3" />
    </div>
  );
}

/**
 * Twenty-four flex bars. No chart library for a bar per hour — and no y axis
 * either, because the number a driver would read off one is trips, and the
 * shape is the whole message.
 */
export function HourlyBars({
  hours,
  currentHour,
  className,
}: {
  hours: number[];
  currentHour: number | null;
  className?: string;
}) {
  const peak = Math.max(0, ...hours);
  const average = hours.length
    ? hours.reduce((sum, n) => sum + n, 0) / hours.length
    : 0;

  return (
    <div className={className}>
      <div className="flex h-16 items-end gap-[3px]" aria-hidden="true">
        {CHART_HOURS.map((hour) => {
          const value = hours[hour] ?? 0;
          const busy = value > 0 && value >= average;
          return (
            <span
              key={hour}
              className={cn(
                "flex-1 rounded-[2px]",
                hour === currentHour
                  ? "bg-lime"
                  : busy
                    ? "bg-foreground/55"
                    : "bg-muted-foreground/25",
              )}
              // A flat floor when there is nothing yet: an empty chart is
              // still a chart, and it is not pretending to be data.
              style={{ height: `${peak ? 12 + (value / peak) * 88 : 12}%` }}
            />
          );
        })}
      </div>
      <div className="text-muted-foreground mt-1.5 flex justify-between text-[11px] font-medium tabular-nums">
        <span>4 AM</span>
        <span>12 PM</span>
        <span>7 PM</span>
        <span>3 AM</span>
      </div>
    </div>
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
  stack = [],
  secondsLeft,
  totalSeconds,
  busy,
  onFocus,
  onAccept,
  onDecline,
}: {
  trip: OfferTrip;
  stack?: OfferTrip[];
  secondsLeft: number;
  totalSeconds: number;
  busy: boolean;
  onFocus?: (tripId: string) => void;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const courier = isCourierProduct(trip.productId);
  const shopItems = parseShopList(trip.itemList);
  const help = isHelpProduct(trip.productId);
  const care = isCareProduct(trip.productId);
  const behind = stack.filter((entry) => entry.id !== trip.id);
  return (
    <>
      {behind.length > 0 ? (
        <div className="mb-3">
          <p className="text-muted-foreground mb-2 text-[11px] font-medium tracking-[0.12em] uppercase">
            {stack.length} rides
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {stack.map((entry) => {
              const front = entry.id === trip.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={front}
                  aria-label={`${formatMoney(entry.totalCents)}, ${entry.arrivalMinutes} minutes away`}
                  onClick={() => onFocus?.(entry.id)}
                  className={cn(
                    "focus-visible:ring-ring shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold tracking-tight tabular-nums ring-1 focus-visible:ring-2 focus-visible:outline-none",
                    front
                      ? "bg-lime text-lime-foreground ring-lime-foreground/20"
                      : "bg-card ring-border",
                  )}
                >
                  {formatMoney(entry.totalCents)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="flex items-end justify-between gap-3">
        <p className="text-[52px] leading-none font-semibold tracking-[-0.04em] tabular-nums">
          {formatMoney(trip.totalCents)}
        </p>
        <p className="text-muted-foreground shrink-0 pb-1 text-[17px] font-medium tabular-nums">
          {secondsLeft}s
        </p>
      </div>

      {/* A visit is decided on fare, then Care-or-tasks, then the clock —
          it has no miles and no "4 min away" to weigh. */}
      {help ? (
        <>
          <p
            className={cn(
              "mt-2 tracking-tight",
              care
                ? "text-[26px] leading-tight font-semibold"
                : "text-[17px] font-medium",
            )}
          >
            {care ? "Care · in the home" : "Help · light tasks"}
          </p>
          <p className="text-lime mt-1 text-[19px] font-semibold tracking-tight tabular-nums">
            {scheduledLabel(trip.scheduledAt) ?? "Scheduled visit"}
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-[17px] font-medium tracking-tight tabular-nums">
            {shopItems.length > 0
              ? `Shop · ${shopItemCountLabel(shopItems.length)}`
              : productLabel(trip.productId)}{" "}
            · {trip.distanceMiles.toFixed(1)} mi · {trip.tripMinutes} min
          </p>
          {/* The second decision input: how much unpaid driving comes first. */}
          <p className="text-lime mt-1 text-[19px] font-semibold tracking-tight tabular-nums">
            {trip.arrivalMinutes} min away
          </p>
        </>
      )}

      {/* One address for a visit: the rail would draw a road from the house
          to itself. */}
      {help ? (
        <p className="mt-4 text-[17px] leading-snug font-medium tracking-tight">
          {trip.pickupAddress}
        </p>
      ) : (
        <RouteRail
          pickup={trip.pickupAddress}
          destination={trip.destinationAddress}
          courier={courier}
          className="mt-4"
        />
      )}

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
  queued = [],
  kind,
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
  queued?: JobTrip[];
  kind: DriverJobKind;
  pickupCode: string;
  onPickupCode: (next: string) => void;
  deliveryCode: string;
  onDeliveryCode: (next: string) => void;
  busy: boolean;
  error: string | null;
  onAdvance: () => void;
}) {
  const question = driverAppQuestion(scene, kind);
  const courier = kind === "courier" || kind === "shop";
  const shop = kind === "shop";
  const help = kind === "help";
  const care = isCareProduct(trip.productId);
  const heading =
    scene === "on_trip" && kind !== "help"
      ? trip.destinationAddress
      : trip.pickupAddress;
  const proof = trip.deliveryProof;
  // The sheet *is* the job: a Shop courier who cannot read the list has
  // nothing to buy. The server refuses to save a Shop trip without one.
  const shopItems = parseShopList(trip.itemList);

  return (
    <>
      <p className="text-lime text-xs font-semibold tracking-[0.14em] uppercase">
        {help
          ? care
            ? "Care visit"
            : "Help · light tasks"
          : courier
            ? courierOrderLabel(trip.id)
            : productLabel(trip.productId)}{" "}
        · {formatMoney(trip.totalCents)}
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
          {queued.length > 0 ? (
            <p className="text-muted-foreground mt-2 text-[15px] leading-snug">
              {queued.length} queued · next{" "}
              {splitAddress(queued[0]!.pickupAddress).line}
            </p>
          ) : null}
          {scene !== "on_trip" && !help && trip.pickupMeetingPoint ? (
            <p className="text-muted-foreground mt-0.5 text-[15px] leading-snug">
              {trip.pickupMeetingPoint}
            </p>
          ) : null}
        </div>
      </div>

      {/* Rider identity: who to look for, and how to reach them. */}
      {!courier && trip.riderName ? (
        <ProviderCard
          className="mt-3"
          compact
          provider={{ id: trip.id, name: trip.riderName }}
          eta={
            scene !== "at_pickup"
              ? null
              : help
                ? "Expecting you at home"
                : "Waiting at the curb"
          }
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

      {help ? (
        <div className="bg-muted/60 mt-3 rounded-2xl px-4 py-3">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
            {care ? "Care visit" : "The visit"}
          </p>
          {scheduledLabel(trip.scheduledAt) ? (
            <p className="mt-0.5 text-[17px] font-medium tracking-tight tabular-nums">
              {scheduledLabel(trip.scheduledAt)}
            </p>
          ) : null}
          {/* What needs doing, as the rider wrote it. */}
          {trip.pickupMeetingPoint ? (
            <p className="text-muted-foreground mt-1 text-[15px] leading-snug">
              {trip.pickupMeetingPoint}
            </p>
          ) : null}
          {care ? (
            <p className="text-muted-foreground mt-1.5 text-[15px] leading-snug">
              Care rules apply. Not medical care. Call 911 in an emergency.
            </p>
          ) : null}
        </div>
      ) : null}

      {shop ? (
        <div className="bg-muted/60 mt-3 rounded-2xl px-4 py-3">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
            Shopping list · {shopItemCountLabel(shopItems.length)}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {shopItems.map((item, index) => (
              <li key={index}>
                <p className="text-[17px] leading-snug font-medium tracking-tight">
                  {item.label}
                </p>
                {item.note ? (
                  <p className="text-muted-foreground text-[15px] leading-snug">
                    {item.note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
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
            {shop
              ? shopItemCountLabel(shopItems.length)
              : trip.packageCount === 1
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
        {courier && !shop && scene === "at_pickup" ? (
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

/* ---------------------------------------------------------- pickup pin */

/**
 * Start ride, when this rider has a PIN. The job sheet has grown into an
 * overlay: one question, the digits the rider reads out, and the same
 * primary. The PIN itself is never on this screen.
 */
export function DriverPickupPinScene({
  riderName,
  value,
  onChange,
  busy,
  error,
  onBack,
  onConfirm,
}: {
  riderName: string | null;
  value: string;
  onChange: (next: string) => void;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const who = riderName ?? "the rider";
  return (
    <>
      <div className="flex items-center gap-3">
        <PeekIcon label="Back to the job" onPress={onBack}>
          <Icon icon={ArrowDown01Icon} size={22} aria-hidden="true" />
        </PeekIcon>
        <p className="min-w-0 flex-1 text-center text-[21px] font-semibold tracking-[-0.02em]">
          Security PIN
        </p>
        <span className="size-11 shrink-0" aria-hidden="true" />
      </div>

      <p className="text-lime mt-6 text-xs font-semibold tracking-[0.14em] uppercase">
        Before you start
      </p>
      <h2 className="mt-1 text-[26px] leading-tight font-semibold tracking-[-0.03em]">
        Ask {who} for their PIN
      </h2>
      <p className="text-muted-foreground mt-2 text-[17px] leading-snug">
        They have it in the app. Enter it to start the ride.
      </p>

      <div className="mt-6">
        <CodeField
          label="Rider PIN"
          value={value}
          onChange={onChange}
          autoFocus
        />
      </div>

      <SheetActions>
        {error ? (
          <p role="alert" className="text-destructive pb-1 text-[15px]">
            {error}
          </p>
        ) : null}
        <Button
          size="lg"
          className="h-16 w-full text-[19px]"
          aria-busy={busy || undefined}
          disabled={busy || value.trim().length < 4}
          onClick={onConfirm}
        >
          Start ride
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
  onDone,
}: {
  trip: JobTrip;
  todayCents: number;
  onDone: () => void;
}) {
  const kind = driverJobKind(trip);
  const courier = kind !== "ride";
  const question = driverAppQuestion("complete", kind);
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
      {/* Honest-empty: there is no reimbursement path in this build, so there
          is no "I spent $42" field to fill in and nothing to upload. */}
      {kind === "shop" ? (
        <p className="text-muted-foreground mt-2 text-[15px] leading-snug">
          Item cost stays between you and the store in this build.
        </p>
      ) : null}

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
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="block pb-2">
      <span className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
        {label}
      </span>
      <Input
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        maxLength={8}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
        placeholder="0000"
        className="mt-1.5 h-14 rounded-2xl text-center text-2xl font-semibold tracking-[0.2em] tabular-nums"
      />
    </label>
  );
}

export type { RestStop };

/**
 * The visit window, as the driver reads it. A row's timestamp arrives as a
 * Date or as JSON's string; neither is invented when it is absent.
 */
function scheduledLabel(at: Date | string | null | undefined): string | null {
  if (!at) return null;
  const when = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(when.getTime())) return null;
  return helpVisitLabel(when);
}

const CATEGORY_LABEL: Record<string, string> = {
  coffee: "Coffee",
  rest_area: "Rest area",
  grocery: "Grocery",
  supermarket: "Supermarket",
  pharmacy: "Pharmacy",
};

function formatStopDistance(meters: number): string {
  return meters < 161
    ? `${Math.round(meters)} m`
    : `${(meters / 1609.344).toFixed(1)} mi`;
}

function mapsHref({
  address,
  latitude,
  longitude,
  ios,
}: {
  address: string;
  latitude?: number;
  longitude?: number;
  ios: boolean;
}): string {
  const hasCoords =
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);
  const dest = hasCoords
    ? `${latitude},${longitude}`
    : encodeURIComponent(address);
  return ios
    ? `https://maps.apple.com/?daddr=${dest}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

/**
 * Confirm strip for a rest-stop tap. One question: this stop? Primary hands
 * off to the phone's maps app — there is no in-app route.
 */
export function RestStopScene({ stop }: { stop: RestStop }) {
  const name = stop.shortName ?? splitAddress(stop.address).line;
  const meta = [
    stop.address,
    stop.category ? CATEGORY_LABEL[stop.category] : null,
    stop.distanceMeters != null
      ? formatStopDistance(stop.distanceMeters)
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex min-h-full flex-col gap-3">
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">
        This stop?
      </p>
      <p className="min-h-11 text-[15px] leading-snug font-medium tracking-tight">
        {name}
      </p>
      <p className="text-muted-foreground -mt-1 text-sm leading-snug">{meta}</p>
      <SheetActions>
        <NavigateLink
          address={stop.address}
          latitude={stop.latitude}
          longitude={stop.longitude}
          className="bg-primary text-primary-foreground hover:bg-primary/80 h-12 w-full justify-center ring-0"
        />
      </SheetActions>
    </div>
  );
}

/**
 * No turn-by-turn in this build. Handing the destination to the phone's own
 * maps app is what a lot of drivers do anyway, and it is honest about the gap.
 */
export function NavigateLink({
  address,
  latitude,
  longitude,
  className,
}: {
  address: string;
  latitude?: number;
  longitude?: number;
  className?: string;
}) {
  const ios = useSyncExternalStore(
    () => () => undefined,
    () => /iPad|iPhone|iPod/.test(navigator.userAgent),
    () => false,
  );
  return (
    <a
      href={mapsHref({ address, latitude, longitude, ios })}
      target="_blank"
      rel="noreferrer"
      aria-label="Open in Maps"
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
  busy,
  className,
  children,
}: {
  label: string;
  href?: string;
  onPress?: () => void;
  busy?: boolean;
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
    <button
      type="button"
      aria-label={label}
      // Absent rather than "false": an idle control is not busy, and
      // `busy ?? undefined` would keep the attribute on every button.
      aria-busy={busy ? true : undefined}
      onClick={onPress}
      className={classes}
    >
      {children}
    </button>
  );
}
