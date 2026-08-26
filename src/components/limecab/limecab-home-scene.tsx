"use client";

import { Briefcase, Clock, House, MapPin } from "lucide-react";

import { LocationTrigger } from "@/components/service-app/location-trigger";
import { SavedPlaces } from "@/components/service-app/saved-places";
import { SAVED_PLACES } from "@/lib/limecab/mock";
import type { Pickup } from "@/lib/limecab/domain";
import type { Location, Place } from "@/lib/service-app/services";

/** Which glyph a place gets. Product semantics — the kit stays generic. */
function placeIcon(place: Place) {
  if (place.id === "home") return <House strokeWidth={1.75} />;
  if (place.id === "work") return <Briefcase strokeWidth={1.75} />;
  if (place.source === "recent") return <Clock strokeWidth={1.75} />;
  return <MapPin strokeWidth={1.75} />;
}

const SAVED = SAVED_PLACES.filter((place) => place.source === "saved");
const RECENT = SAVED_PLACES.filter((place) => place.source === "recent");

/** The first screen: where the rider is, and where they usually go. */
export function LimeCabHomeScene({
  pickup,
  pickupLine,
  destination,
  onSearch,
  onChooseLocation,
}: {
  pickup: Pickup;
  pickupLine: string;
  destination: Location | null;
  onSearch: (target: "pickup" | "destination") => void;
  onChooseLocation: (result: Location) => void;
}) {
  const choose = (place: Place) =>
    onChooseLocation({
      address: place.address,
      latitude: place.latitude ?? undefined,
      longitude: place.longitude ?? undefined,
    });

  return (
    <div className="flex flex-col gap-4">
      <PickupRow
        label={pickupLine}
        onPress={() => onSearch("pickup")}
        following={pickup.followsDevice ?? false}
      />
      <LocationTrigger
        size="lg"
        hint="Where to?"
        label={destination?.address}
        onPress={() => onSearch("destination")}
      />
      <SavedPlaces
        title="Saved places"
        places={SAVED}
        iconFor={placeIcon}
        onSelect={choose}
      />
      <SavedPlaces
        title="Recent"
        variant="rows"
        places={RECENT}
        iconFor={placeIcon}
        onSelect={choose}
        className="mt-1"
      />
    </div>
  );
}

/** Pickup is editable from the first screen — it is not just "wherever I am". */
function PickupRow({
  label,
  following,
  onPress,
}: {
  label: string;
  following: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={`Pickup: ${following ? "Current location" : label}. Change`}
      className="focus-visible:ring-ring group flex min-h-11 w-full items-center gap-2.5 rounded-2xl text-left focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className="bg-primary ring-primary/25 size-2.5 shrink-0 rounded-full ring-4"
      />
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium tracking-tight">
        {following ? "Current location" : label}
      </span>
      <span className="text-muted-foreground shrink-0 text-sm group-hover:underline">
        Change
      </span>
    </button>
  );
}
