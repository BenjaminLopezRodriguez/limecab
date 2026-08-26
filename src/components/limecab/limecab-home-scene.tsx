"use client";

import {
  Briefcase01Icon,
  Clock01Icon,
  Home01Icon,
  Location01Icon,
} from "@hugeicons/core-free-icons";

import { LocationTrigger } from "@/components/service-app/location-trigger";
import { SavedPlaces } from "@/components/service-app/saved-places";
import { Icon } from "@/components/ui/icon";
import { SAVED_PLACES } from "@/lib/limecab/mock";
import type { Location, Place } from "@/lib/service-app/services";

/** Which glyph a place gets. Product semantics — the kit stays generic. */
function placeIcon(place: Place) {
  if (place.id === "home") return <Icon icon={Home01Icon} size={18} />;
  if (place.id === "work") return <Icon icon={Briefcase01Icon} size={18} />;
  if (place.source === "recent") return <Icon icon={Clock01Icon} size={18} />;
  return <Icon icon={Location01Icon} size={18} />;
}

const SAVED = SAVED_PLACES.filter((place) => place.source === "saved");
const RECENT = SAVED_PLACES.filter((place) => place.source === "recent");

/**
 * The first screen: where the rider usually goes.
 *
 * Pickup lives on the map card (tap to adjust) and later in the ride flow —
 * home does not repeat it as a row above "Where to?".
 */
export function LimeCabHomeScene({
  destination,
  destinationHint = "Where to?",
  title,
  onSearch,
  onChooseLocation,
}: {
  destination: Location | null;
  destinationHint?: string;
  /** Optional scene eyebrow, e.g. "Send a package". */
  title?: string;
  onSearch: (target: "destination") => void;
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
      {title ? (
        <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{title}</h2>
      ) : null}
      <LocationTrigger
        size="lg"
        hint={destinationHint}
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
