"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { DriverSubpage } from "@/components/limecab/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PLACE_LISTING_KIND_LABEL,
  type PlaceListingKind,
} from "@/lib/partner/places-listings";
import { cn } from "@/lib/utils";

const KINDS: PlaceListingKind[] = ["room", "venue", "parking"];

function parseKind(raw: string | null): PlaceListingKind {
  if (raw === "parking" || raw === "venue" || raw === "room") return raw;
  return "room";
}

export default function NewPlaceListingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialKind = parseKind(searchParams.get("kind"));
  const [kind, setKind] = useState<PlaceListingKind>(initialKind);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");

  const unitHint = useMemo(() => {
    if (kind === "parking") return "e.g. $6/hr or $18/day";
    if (kind === "venue") return "e.g. $450/event or $120/hr";
    return "e.g. $85/hr";
  }, [kind]);

  return (
    <DriverSubpage
      backHref="/partner/places/app"
      backLabel="Back to desk"
      title="New listing"
    >
      <p className="text-muted-foreground text-[15px] leading-relaxed">
        Published listings appear when riders search on Spaces & Station.
      </p>

      <fieldset className="mt-6">
        <legend className="mb-3 text-[15px] font-medium">Listing type</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {KINDS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              aria-pressed={kind === option}
              className={cn(
                "bg-card ring-border rounded-2xl px-4 py-3 text-left ring-1 transition-colors",
                kind === option
                  ? "ring-ring bg-accent ring-2"
                  : "hover:bg-accent/40",
              )}
            >
              <span className="block text-[15px] font-semibold tracking-tight">
                {PLACE_LISTING_KIND_LABEL[option]}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <form
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          router.push("/partner/places/app");
        }}
      >
        <Field label="Name">
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              kind === "parking" ? "Lot 7 — Dodger Stadium" : "Boardroom A"
            }
            className="h-14 text-[17px]"
          />
        </Field>
        <Field label="Address">
          <Input
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="800 N Alameda St, Los Angeles"
            className="h-14 text-[17px]"
          />
        </Field>
        <Field label="Rate">
          <Input
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={unitHint}
            className="h-14 text-[17px]"
          />
        </Field>
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          Saves as a draft until you sign in and publish.
        </p>
        <Button type="submit" size="lg" className="h-16 w-full text-[17px]">
          Save draft
        </Button>
      </form>
    </DriverSubpage>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[15px] font-medium">{label}</span>
      {children}
    </label>
  );
}
