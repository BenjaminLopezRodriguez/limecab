"use client";

import {
  Airplane01Icon,
  Briefcase01Icon,
  Clock01Icon,
  Home01Icon,
  Location01Icon,
} from "@hugeicons/core-free-icons";

import { LocationTrigger } from "@/components/service-app/location-trigger";
import { SavedPlaces } from "@/components/service-app/saved-places";
import { VoiceMicButton } from "@/components/limecab/limecab-voice-banner";
import { Icon } from "@/components/ui/icon";
import { SAVED_PLACES, TRAVEL_SPOTS } from "@/lib/limecab/mock";
import type { Location, Place } from "@/lib/service-app/services";
import { cn } from "@/lib/utils";

/** Which glyph a place gets. Product semantics — the kit stays generic. */
function placeIcon(place: Place) {
  if (place.id === "home") return <Icon icon={Home01Icon} size={18} />;
  if (place.id === "work") return <Icon icon={Briefcase01Icon} size={18} />;
  if (place.id === "lax") return <Icon icon={Airplane01Icon} size={18} />;
  if (place.source === "recent") return <Icon icon={Clock01Icon} size={18} />;
  return <Icon icon={Location01Icon} size={18} />;
}

const SAVED = SAVED_PLACES.filter((place) => place.source === "saved");
const RECENT = SAVED_PLACES.filter((place) => place.source === "recent");
const AIRPORT = TRAVEL_SPOTS.find((place) => place.id === "lax")!;
const CURATED = TRAVEL_SPOTS.filter((place) => place.id !== "lax");

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
  traveling,
  onTravelingChange,
  onSearch,
  onVoice,
  onChooseLocation,
}: {
  destination: Location | null;
  destinationHint?: string;
  /** Optional scene eyebrow, e.g. "Send a package". */
  title?: string;
  traveling: boolean;
  onTravelingChange: (next: boolean) => void;
  onSearch: (target: "destination") => void;
  onVoice: () => void;
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
      ) : traveling ? (
        <h2 className="text-[20px] font-semibold tracking-[-0.02em]">
          In Los Angeles
        </h2>
      ) : null}
      <LocationTrigger
        size="lg"
        hint={destinationHint}
        label={destination?.address}
        onPress={() => onSearch("destination")}
        end={<VoiceMicButton onPress={onVoice} />}
      />
      <p className="text-muted-foreground -mt-2 px-1 text-xs">
        Ride, send, or get
      </p>

      {traveling ? (
        <>
          <SavedPlaces
            title="Airport"
            variant="rows"
            places={[AIRPORT]}
            iconFor={placeIcon}
            onSelect={choose}
          />
          <SavedPlaces
            title="Spots nearby"
            variant="rows"
            places={CURATED}
            iconFor={placeIcon}
            onSelect={choose}
          />
        </>
      ) : null}

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

      <button
        type="button"
        role="switch"
        aria-checked={traveling}
        aria-label={traveling ? "Stop traveling" : "I'm traveling"}
        onClick={() => onTravelingChange(!traveling)}
        className={cn(
          "text-muted-foreground mt-1 self-start px-1 text-sm",
          "focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:outline-none",
        )}
      >
        {traveling ? "Not traveling" : "I'm traveling"}
      </button>
    </div>
  );
}
