"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Add01Icon,
  Analytics01Icon,
  ArrowExpand01Icon,
  ArrowRight01Icon,
  CarParking01Icon,
  Loading03Icon,
  MeetingRoomIcon,
  SlidersHorizontalIcon,
} from "@hugeicons/core-free-icons";

import { SheetActions } from "@/components/service-app/service-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  MOCK_PARTNER_LISTINGS,
  PLACE_LISTING_KIND_LABEL,
  type PlaceListing,
} from "@/lib/partner/places-listings";
import { placesPartnerQuestion } from "@/lib/partner/places-state";
import { cn } from "@/lib/utils";

/** Canvas control — same shape as the driver's `MapControl`. */
export function PlacesMapControl({
  label,
  onPress,
  href,
  busy,
  className,
  children,
}: {
  label: string;
  onPress?: () => void;
  href?: string;
  busy?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const shell = cn(
    "bg-card ring-border focus-visible:ring-ring flex size-11 items-center justify-center rounded-full shadow-[0_4px_16px_rgba(26,24,20,0.12)] ring-1 focus-visible:ring-2 focus-visible:outline-none",
    className,
  );
  if (href) {
    return (
      <a href={href} aria-label={label} className={shell}>
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={busy ?? undefined}
      disabled={busy}
      onClick={onPress}
      className={shell}
    >
      {children}
    </button>
  );
}

/** Paused desk headline — sits above the map card like `DriverOfflineHeadline`. */
export function PlacesPausedHeadline({
  onOpenListings,
}: {
  onOpenListings: () => void;
}) {
  return (
    <div className="pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="flex justify-end gap-2">
        <PlacesMapControl label="Listing settings" onPress={onOpenListings}>
          <Icon icon={SlidersHorizontalIcon} size={20} aria-hidden="true" />
        </PlacesMapControl>
        <PlacesMapControl
          label="Add a listing"
          href="/partner/places/app/listings/new"
        >
          <Icon icon={Add01Icon} size={20} aria-hidden="true" />
        </PlacesMapControl>
      </div>
      <h1 className="mt-3 text-[36px] leading-[1.05] font-semibold tracking-[-0.04em]">
        You&apos;re offline
      </h1>
      <p className="mt-1 text-[21px] font-semibold tracking-[-0.02em]">
        Ready to take bookings?
      </p>
    </div>
  );
}

/** The paused home body — opportunities, then one loud primary in the thumb zone. */
export function PlacesPausedHome({
  areaLabel,
  liveCount,
  bookingHint,
  busy,
  error,
  onGoLive,
  onOpenBookings,
}: {
  areaLabel: string | null;
  liveCount: number;
  bookingHint: string | null;
  busy: boolean;
  error: string | null;
  onGoLive: () => void;
  onOpenBookings: () => void;
}) {
  const question = placesPartnerQuestion("paused");
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={onOpenBookings}
        className="focus-visible:ring-ring group mt-5 flex w-full items-start gap-3 rounded-2xl text-left focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[26px] leading-none font-semibold tracking-[-0.03em]">
            Opportunities
          </span>
          <span className="text-muted-foreground mt-4 flex items-center gap-1.5 text-[13px] font-medium">
            <Icon icon={Analytics01Icon} size={15} aria-hidden="true" />
            Bookings
          </span>
          <span className="mt-1 block text-[19px] leading-snug font-semibold tracking-[-0.02em]">
            {bookingHint ??
              (areaLabel
                ? `Riders searching near ${areaLabel}`
                : "Not enough bookings yet")}
          </span>
          <span className="text-muted-foreground mt-1 block text-[14px]">
            {liveCount === 1
              ? "1 listing live"
              : `${liveCount} listings live`}
          </span>
        </span>
        <span className="bg-muted group-hover:bg-accent flex size-9 shrink-0 items-center justify-center rounded-full">
          <Icon icon={ArrowRight01Icon} size={18} aria-hidden="true" />
        </span>
      </button>

      <div className="mt-6 md:mt-auto md:pt-8">
        {error ? (
          <p role="alert" className="text-destructive pb-2 text-[15px]">
            {error}
          </p>
        ) : null}
        <Button
          size="lg"
          className="bg-lime text-lime-foreground hover:bg-lime/85 h-16 w-full rounded-full text-[19px]"
          aria-busy={busy ?? undefined}
          disabled={busy}
          onClick={onGoLive}
        >
          {busy ? (
            <Icon
              icon={Loading03Icon}
              size={22}
              className="motion-safe:animate-spin"
              aria-hidden="true"
            />
          ) : (
            question.action
          )}
        </Button>
      </div>
    </div>
  );
}

/** Live desk peek — status, not a question with two primaries. */
export function PlacesLivePeek({
  onOpenListings,
  onGoOffline,
  busy,
}: {
  onOpenListings: () => void;
  onGoOffline: () => void;
  busy: boolean;
}) {
  const question = placesPartnerQuestion("live");
  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <p className="text-[21px] leading-tight font-semibold tracking-[-0.02em]">
          {question.question}
        </p>
        <p className="text-muted-foreground mt-0.5 text-[15px] leading-snug">
          Spaces & Station riders can book your live listings
        </p>
      </div>
      <SheetActions>
        <Button
          type="button"
          variant="secondary"
          className="h-14 w-full rounded-full text-[17px]"
          onClick={onOpenListings}
        >
          Your listings
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground h-12 w-full text-[15px]"
          aria-busy={busy ?? undefined}
          disabled={busy}
          onClick={onGoOffline}
        >
          {question.exit}
        </Button>
      </SheetActions>
    </div>
  );
}

/** Listings sheet — one row per listing, driver offer-card density. */
export function PlacesListingsScene({
  listings,
  filter,
  onFilter,
}: {
  listings: PlaceListing[];
  filter: "all" | PlaceListing["kind"];
  onFilter: (next: "all" | PlaceListing["kind"]) => void;
}) {
  const filters = [
    { id: "all" as const, label: "All" },
    { id: "room" as const, label: "Rooms" },
    { id: "venue" as const, label: "Venues" },
    { id: "parking" as const, label: "Parking" },
  ];
  const rows =
    filter === "all"
      ? listings
      : listings.filter((row) => row.kind === filter);

  return (
    <>
      <h2 className="text-[22px] font-semibold tracking-[-0.02em]">
        Your listings
      </h2>
      <p className="text-muted-foreground mt-1 text-[15px] leading-snug">
        Rooms, venues, and parking lots riders see on Spaces & Station.
      </p>

      <div
        role="tablist"
        aria-label="Filter listings"
        className="mt-4 flex flex-wrap gap-2"
      >
        {filters.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            onClick={() => onFilter(tab.id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13px] font-semibold tracking-tight transition-colors",
              filter === tab.id
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {rows.map((listing) => (
          <li key={listing.id}>
            <Link
              href={`/partner/places/app/listings/${listing.id}`}
              className="bg-card ring-border hover:bg-accent/40 focus-visible:ring-ring flex min-h-[4.5rem] items-start gap-3 rounded-2xl p-3.5 ring-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <span
                aria-hidden
                className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-full"
              >
                <Icon
                  icon={
                    listing.kind === "parking"
                      ? CarParking01Icon
                      : MeetingRoomIcon
                  }
                  size={20}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-[17px] font-semibold tracking-tight">
                    {listing.name}
                  </span>
                  <ListingStatus status={listing.status} />
                </span>
                <span className="text-muted-foreground block text-sm leading-snug">
                  {PLACE_LISTING_KIND_LABEL[listing.kind]} · {listing.address}
                </span>
                <span className="text-foreground mt-1 block text-[15px] font-medium tabular-nums">
                  {listing.priceLabel}
                </span>
              </span>
              <Icon
                icon={ArrowRight01Icon}
                size={18}
                className="text-muted-foreground mt-1 shrink-0"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>

      {rows.length === 0 ? (
        <p className="text-muted-foreground mt-6 text-center text-[15px]">
          No listings in this filter yet.
        </p>
      ) : null}

      <SheetActions>
        <Button
          size="lg"
          className="h-16 w-full rounded-full text-[17px]"
          render={<Link href="/partner/places/app/listings/new" />}
        >
          Add listing
        </Button>
      </SheetActions>
    </>
  );
}

export function PlacesMapExpandControl({
  onPress,
}: {
  onPress: () => void;
}) {
  return (
    <PlacesMapControl
      label="Open the map"
      onPress={onPress}
      className="absolute top-3 right-3 z-10"
    >
      <Icon icon={ArrowExpand01Icon} size={18} aria-hidden="true" />
    </PlacesMapControl>
  );
}

function ListingStatus({
  status,
}: {
  status: PlaceListing["status"];
}) {
  const label =
    status === "live" ? "Live" : status === "draft" ? "Draft" : "Paused";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight",
        status === "live"
          ? "bg-lime/20 text-lime-foreground"
          : "bg-secondary text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

/** Mock demand copy — honest when we have no real booking index yet. */
export function placesBookingHint(liveCount: number): string | null {
  if (liveCount === 0) return null;
  if (liveCount >= 2) return "2 riders searched near you today";
  return "1 rider searched near you today";
}

export function placesAreaLabel(): string {
  return "Downtown LA";
}

export { MOCK_PARTNER_LISTINGS as placesListingsSeed };
