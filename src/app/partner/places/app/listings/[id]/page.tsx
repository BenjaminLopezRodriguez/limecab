"use client";

import { notFound } from "next/navigation";
import { use } from "react";

import { DriverSubpage } from "@/components/limecab/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MOCK_PARTNER_LISTINGS,
  PLACE_LISTING_KIND_LABEL,
} from "@/lib/partner/places-listings";

export default function EditPlaceListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const listing = MOCK_PARTNER_LISTINGS.find((row) => row.id === id);
  if (!listing) notFound();

  return (
    <DriverSubpage
      backHref="/partner/places/app"
      backLabel="Back to desk"
      title={listing.name}
    >
      <p className="text-muted-foreground text-[15px]">
        {PLACE_LISTING_KIND_LABEL[listing.kind]} · {listing.address}
      </p>
      <p className="text-muted-foreground mt-1 text-[13px] uppercase tracking-[0.12em]">
        {listing.status}
      </p>

      <form
        className="mt-6 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-[15px] font-medium">Name</span>
          <Input defaultValue={listing.name} className="h-14 text-[17px]" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[15px] font-medium">Address</span>
          <Input defaultValue={listing.address} className="h-14 text-[17px]" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[15px] font-medium">Rate</span>
          <Input
            defaultValue={listing.priceLabel}
            className="h-14 text-[17px]"
          />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" size="lg" className="h-16 flex-1 text-[17px]">
            Save changes
          </Button>
          {listing.status === "draft" ? (
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="h-16 flex-1 text-[17px]"
            >
              Publish listing
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="h-16 flex-1 text-[17px]"
            >
              Pause listing
            </Button>
          )}
        </div>
      </form>
    </DriverSubpage>
  );
}
